#![feature(get_mut_unchecked, is_some_with, try_blocks)]
mod interaction;
pub mod util;
use anyhow::{Context, Result};
use dotenv::dotenv;
use futures::stream::StreamExt;
use interaction::handle_interaction;
use std::{env, sync::Arc};
use twilight_cache_inmemory::{InMemoryCache, ResourceType};
use twilight_gateway::{
    cluster::{Cluster, ShardScheme},
    Event, Intents,
};
use twilight_http::Client as HttpClient;
use twilight_model::{
    application::interaction::Interaction,
    id::{
        marker::{ApplicationMarker, ChannelMarker, UserMarker},
        Id,
    },
};
use twilight_standby::Standby;

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();
    let token = env::var("DISCORD_TOKEN")?;

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
    let cache = InMemoryCache::builder()
        .resource_types(ResourceType::MESSAGE)
        .build();

    let info = ClusterData {
        http: http.clone(),
        standby: standby.clone(),
        bot_id,
        application_id,
    };
    // Startup an event loop to process each event in the event stream as they
    // come in.
    while let Some((shard_id, event)) = events.next().await {
        // Update the cache.
        cache.update(&event);

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
}

impl ClusterData {
    pub async fn is_nsfw_interaction(&self, interaction: &Interaction) -> bool {
        let nsfw: Result<bool> = try {
            !interaction.is_dm()
                && self
                    .http
                    .channel(interaction.channel_id.context("no channel")?)
                    .exec()
                    .await?
                    .model()
                    .await?
                    .nsfw
                    .unwrap_or(false)
        };
        nsfw.unwrap_or(false)
    }
}
