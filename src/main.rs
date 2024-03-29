#![feature(get_mut_unchecked, try_blocks, exit_status_error)]
mod interaction;
pub mod util;

use anyhow::Result;
use bonsaidb::local::{
    config::{Builder, StorageConfiguration},
    AsyncDatabase,
};
use futures::StreamExt;
use interaction::handle_interaction;
use sentry::integrations::anyhow::capture_anyhow;
use sqlx::{mysql::MySqlPoolOptions, MySql, Pool};
use std::{env, sync::Arc};
use tokio_cron_scheduler::{Job, JobScheduler};
use twilight_cache_inmemory::{InMemoryCache, ResourceType};
use twilight_gateway::{
    stream::{self, ShardEventStream},
    Config, Event, Intents, ShardId,
};
use twilight_http::Client as HttpClient;
use twilight_model::{
    application::interaction::Interaction,
    gateway::payload::incoming::ChannelUpdate,
    id::{
        marker::{ApplicationMarker, UserMarker},
        Id,
    },
};
use twilight_standby::Standby;
use util::animethemes;

async fn update_commands(info: ClusterData) -> Result<(usize, usize)> {
    let client = info.http.interaction(info.application_id);
    let globals = client.global_commands().await?.model().await?;
    let mut deleted = 0;
    for global in globals.iter().filter(|x| {
        interaction::CREATE_COMMANDS
            .iter()
            .any(|y| y.name != x.name)
    }) {
        deleted += 1;
        client.delete_global_command(global.id.unwrap()).await?;
    }

    let list = client
        .set_global_commands(&interaction::CREATE_COMMANDS)
        .await?
        .model()
        .await?;
    Ok((list.len(), deleted))
}

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();
    let token = env::var("DISCORD_TOKEN")?;
    let bonsai = Arc::new(
        AsyncDatabase::open::<()>(StorageConfiguration::new(env::var("BONSAI_FILE")?)).await?,
    );
    let pool = MySqlPoolOptions::new()
        .max_connections(20)
        .connect(&env::var("DATABASE_URL")?)
        .await?;

    let options = sentry::ClientOptions {
        dsn: env::var("SENTRY_DSN").ok().map(|dsn| dsn.parse().unwrap()),
        release: sentry::release_name!(),
        ..Default::default()
    };
    let _guard = sentry::init(options);

    let scheduler = JobScheduler::new().await?;
    {
        let bonsai = bonsai.clone();
        println!("Updating AnimeThemes local cache");
        if let Err(error) = animethemes::update_database(bonsai.clone()).await {
            eprintln!("AnimeThemes cache failed {}", error);
        } else {
            println!("Updated AnimeThemes local cache");
        }
        scheduler
            .add(Job::new_async("0 0 0 * * *", move |_uuid, _l| {
                let bonsai = bonsai.clone();
                Box::pin(async move {
                    if let Err(error) = animethemes::update_database(bonsai).await {
                        eprintln!("AnimeThemes cache failed {}", error);
                    } else {
                        println!("Updated AnimeThemes cache")
                    }
                })
            })?)
            .await?;
    }

    {
        let scheduler = scheduler.clone();
        tokio::spawn(async move {
            if let Err(e) = scheduler.start().await {
                eprintln!("Scheduler error: {:?}", e);
            }
        });
    }

    // Specify intents requesting events about things like new and updated
    // messages in a guild and direct messages.
    let intents = Intents::GUILD_MESSAGES | Intents::DIRECT_MESSAGES;
    let config = Config::new(token.clone(), intents);

    // The http client is seperate from the gateway, so startup a new
    // one, also use Arc such that it can be cloned to other threads.
    let http = Arc::new(HttpClient::new(token));
    let standby = Arc::new(Standby::new());

    let application_id = {
        let response = http.current_user_application().await?;
        response.model().await?.id
    };
    let bot_id = {
        let response = http.current_user().await?;
        response.model().await?.id
    };

    // Since we only care about messages, make the cache only process messages.
    let cache = Arc::new(
        InMemoryCache::builder()
            .resource_types(ResourceType::CHANNEL)
            .build(),
    );

    let info = ClusterData {
        http: http.clone(),
        standby: standby.clone(),
        bot_id,
        application_id,
        cache,
        pool,
        bonsai,
        scheduler,
    };

    {
        let (updated, deleted) = update_commands(info.clone()).await?;
        println!("Updated {updated} commands and deleted {deleted} commands.");
    }

    // Start a single shard.
    let mut shards =
        stream::create_range(0..1, 1, config, |_, builder| builder.build()).collect::<Vec<_>>();

    // Create a stream to collect all of the shards and poll them for their next
    // Discord gateway events.
    let mut stream = ShardEventStream::new(shards.iter_mut());

    // Startup an event loop to process each event in the event stream as they
    // come in.
    while let Some((shard, event)) = stream.next().await {
        match event {
            Ok(event) => {
                // Update the cache.
                info.cache.update(&event);

                // Spawn a new task to handle the event
                tokio::spawn(handle_event(shard.id(), event, info.clone()));
            }
            Err(source) => {
                println!("error receiving event {}", source);

                // An error may be fatal when something like invalid privileged
                // intents are specified or the Discord token is invalid.
                if source.is_fatal() {
                    break;
                }

                continue;
            }
        };
    }
    Ok(())
}

async fn handle_event(shard: ShardId, event: Event, info: ClusterData) -> Result<()> {
    let _results = info.standby.process(&event);
    match event {
        Event::MessageCreate(msg) if msg.content.ends_with("ping") => {
            info.http
                .create_message(msg.channel_id)
                .content("Pong!")?
                .await?;
        }
        Event::InteractionCreate(interaction) => {
            let handler = handle_interaction(shard, interaction.clone(), info.clone()).await;
            if let Err(err) = handler {
                capture_anyhow(&err);
                eprintln!(
                    "Error found on interaction {}\nError: {:?}",
                    interaction.id, err
                );
            }
        }
        _ => {}
    }

    Ok(())
}

#[derive(Clone)]
pub struct ClusterData {
    pub http: Arc<HttpClient>,
    pub application_id: Id<ApplicationMarker>,
    pub bot_id: Id<UserMarker>,
    pub standby: Arc<Standby>,
    pub cache: Arc<InMemoryCache>,
    pub pool: Pool<MySql>,
    pub bonsai: Arc<AsyncDatabase>,
    pub scheduler: JobScheduler,
}

impl ClusterData {
    pub async fn is_nsfw_interaction(&self, interaction: &Interaction) -> Result<bool> {
        if interaction.is_dm() {
            return Ok(false);
        }
        let channel_id = interaction.channel.as_ref().expect("no channel id").id;
        if let Some(channel) = self.cache.channel(channel_id) {
            Ok(channel.nsfw.unwrap_or(false))
        } else {
            let channel = ChannelUpdate(self.http.channel(channel_id).await?.model().await?);
            self.cache.update(&channel);
            Ok(channel.0.nsfw.unwrap_or(false))
        }
    }
}
