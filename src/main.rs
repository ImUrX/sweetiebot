#![feature(get_mut_unchecked, try_blocks, exit_status_error)]
mod interaction;
pub mod util;
use anyhow::Result;
use dotenvy::dotenv;
use futures::stream::StreamExt;
use interaction::handle_interaction;
use sqlx::mysql::MySqlPoolOptions;
use std::{env, sync::Arc};
use tokio_cron_scheduler::{Job, JobScheduler};
use twilight_cache_inmemory::{InMemoryCache, ResourceType};
use twilight_gateway::{
    cluster::{Cluster, ShardScheme},
    Event, Intents,
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

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();
    let token = env::var("DISCORD_TOKEN")?;
    let pool = MySqlPoolOptions::new()
        .max_connections(20)
        .connect(&env::var("DATABASE_URL")?)
        .await?;
    let scheduler = JobScheduler::new().await?;
    {
        if let Err(error) = animethemes::update_database().await {
            println!("AnimeThemes dump failed {}", error);
        }
        scheduler
            .add(Job::new_async("0 0 0 * * *", move |_uuid, _l| {
                Box::pin(async move {
                    if let Err(error) = animethemes::update_database().await {
                        println!("AnimeThemes dump failed {}", error);
                    } else {
                        println!("Updated AnimeThemes dump")
                    }
                })
            })?)
            .await?;
    }

    // Start a single shard.
    let scheme = ShardScheme::Range {
        from: 0,
        to: 0,
        total: 1,
    };

    // Specify intents requesting events about things like new and updated
    // messages in a guild and direct messages.
    let intents = Intents::GUILD_MESSAGES | Intents::DIRECT_MESSAGES;

    let (cluster, mut events) = Cluster::builder(token.clone(), intents)
        .shard_scheme(scheme)
        .build()
        .await?;

    let cluster = Arc::new(cluster);

    // Start up the cluster
    let cluster_spawn = cluster.clone();

    tokio::spawn(async move {
        cluster_spawn.up().await;
    });

    // The http client is seperate from the gateway, so startup a new
    // one, also use Arc such that it can be cloned to other threads.
    let http = Arc::new(HttpClient::new(token));
    let standby = Arc::new(Standby::new());

    let application_id = {
        let response = http.current_user_application().exec().await?;
        response.model().await?.id
    };
    let bot_id = {
        let response = http.current_user().exec().await?;
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
    };
    // Startup an event loop to process each event in the event stream as they
    // come in.
    while let Some((shard_id, event)) = events.next().await {
        // Update the cache.
        info.cache.update(&event);

        // Spawn a new task to handle the event
        tokio::spawn(handle_event(shard_id, event, info.clone()));
    }

    Ok(())
}

async fn handle_event(shard_id: u64, event: Event, info: ClusterData) -> Result<()> {
    let _results = info.standby.process(&event);
    match event {
        Event::MessageCreate(msg) if msg.content.ends_with("ping") => {
            info.http
                .create_message(msg.channel_id)
                .content("Pong!")?
                .exec()
                .await?;
        }
        Event::InteractionCreate(interaction) => {
            let handler = handle_interaction(shard_id, interaction.clone(), info.clone()).await;
            if let Err(err) = handler {
                eprintln!(
                    "Error found on interaction {:?}\nError: {:?}",
                    interaction, err
                );
            }
        }
        Event::ShardConnected(_) => println!("Connected on shard {}", shard_id),
        Event::ShardDisconnected(reason) => println!(
            "Disconnected on shard {} because of {:?}",
            shard_id, reason.reason
        ),
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
}

impl ClusterData {
    pub async fn is_nsfw_interaction(&self, interaction: &Interaction) -> Result<bool> {
        if interaction.is_dm() {
            return Ok(false);
        }
        let channel_id = interaction.channel_id.expect("no channel id");
        if let Some(channel) = self.cache.channel(channel_id) {
            Ok(channel.nsfw.unwrap_or(false))
        } else {
            let channel = ChannelUpdate(self.http.channel(channel_id).exec().await?.model().await?);
            self.cache.update(&channel);
            Ok(channel.0.nsfw.unwrap_or(false))
        }
    }
}
