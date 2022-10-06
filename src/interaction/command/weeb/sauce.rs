use anyhow::Result;
use serde::Deserialize;
use twilight_interactions::command::{CommandModel, CreateCommand};
use twilight_model::{
    application::interaction::{Interaction, InteractionData},
    channel::{embed::EmbedField, Attachment},
    http::attachment::Attachment as HttpAttachment,
};
use twilight_util::builder::{
    embed::{EmbedBuilder, ImageSource},
    InteractionResponseDataBuilder,
};

use crate::{
    util::{censor_image, get_bytes, seconds_to_timestamp, EmbedList, DEFERRED_RESPONSE},
    ClusterData,
};

#[derive(CommandModel, CreateCommand)]
#[command(name = "sauce", desc = "Searches the image's original source")]
pub enum SauceCommand {
    #[command(name = "saucenao")]
    SauceNAO(SauceSauceNAO),
    #[command(name = "tracemoe")]
    TraceMoe(SauceTraceMoe),
    #[command(name = "yandex")]
    Yandex(SauceYandex),
}

#[derive(CommandModel, CreateCommand)]
#[command(name = "saucenao", desc = "Searches the image's source with SauceNAO")]
pub struct SauceSauceNAO {
    #[command(desc = "Image to reverse-lookup for")]
    image: Attachment,
}

#[derive(CommandModel, CreateCommand)]
#[command(name = "tracemoe", desc = "Searches the image's source with trace.moe")]
pub struct SauceTraceMoe {
    #[command(desc = "Image to reverse-lookup for")]
    image: Attachment,
}

#[derive(CommandModel, CreateCommand)]
#[command(name = "tracemoe", desc = "Searches the image's source with Yandex")]
pub struct SauceYandex {
    #[command(desc = "Image to reverse-lookup for")]
    image: Attachment,
}

impl SauceTraceMoe {
    pub async fn run(self, info: ClusterData, interaction: &Interaction) -> Result<()> {
        info.http
            .interaction(interaction.application_id)
            .create_response(interaction.id, &interaction.token, &DEFERRED_RESPONSE)
            .exec()
            .await?;

        let res = fetch_tracemoe(&self.image).await?;
        let mut embed_list = EmbedList::new(
            info.http.clone(),
            interaction.application_id,
            info.standby.clone(),
        );

        let nsfw = info.is_nsfw_interaction(interaction).await;
        for data in res.result.iter().take(5) {
            let (embed, attachment) = Self::make_embed(data, nsfw).await?;
            embed_list.add(embed.build(), Some(attachment));
        }
        embed_list
            .defer_reply(interaction, InteractionResponseDataBuilder::new())
            .await?;
        Ok(())
    }

    pub async fn make_embed(
        data: &TraceResult,
        nsfw_channel: bool,
    ) -> Result<(EmbedBuilder, HttpAttachment)> {
        let mut embed = EmbedBuilder::new()
            .title(
                data.anilist
                    .title
                    .english
                    .as_ref()
                    .unwrap_or(&data.anilist.title.romaji),
            )
            .url(format!("https://anilist.co/anime/{}/", data.anilist.id))
            .color(0x0)
            .image(ImageSource::attachment("trace.png")?)
            .field(EmbedField {
                name: "Similarity".to_string(),
                value: format!("{:.2}%", data.similarity * 100f64),
                inline: true,
            })
            .field(EmbedField {
                name: "Timestamp".to_string(),
                value: data.episode.as_ref().map_or_else(
                    || seconds_to_timestamp(data.from as u32),
                    |ep| {
                        format!(
                            "Episode {} at {}",
                            ep.to_string(),
                            seconds_to_timestamp(data.from as u32)
                        )
                    },
                ),
                inline: true,
            });
        let image = get_bytes(&data.image).await?;
        let attachment = if data.anilist.is_adult && !nsfw_channel {
            embed = embed.description("**WARNING**: Image is NSFW so it's been censored!");
            HttpAttachment::from_bytes(
                "trace.png".to_string(),
                censor_image(image).await?.into(),
                1,
            )
        } else {
            HttpAttachment::from_bytes("trace.png".to_string(), image.into(), 1)
        };

        Ok((embed, attachment))
    }
}

pub async fn fetch_tracemoe(attachment: &Attachment) -> Result<TraceResponse> {
    let client = reqwest::Client::new();
    let res = client
        .post("https://api.trace.moe/search?anilistInfo")
        .body(get_bytes(&attachment.proxy_url).await?)
        .header(
            "Content-Type",
            attachment
                .content_type
                .as_deref()
                .unwrap_or("application/x-www-form-urlencoded"),
        )
        .send()
        .await?
        .json::<TraceResponse>()
        .await?;
    Ok(res)
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TraceResponse {
    pub frame_count: u32,
    pub error: String,
    pub result: Vec<TraceResult>,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TraceResult {
    // in reality it is AnilistField,
    // but i dont want to make a match for this because its not actually used
    pub anilist: AnilistResult,
    pub filename: String,
    pub episode: Option<EpisodeField>,
    pub from: f32,
    pub to: f32,
    pub similarity: f64,
    pub video: String,
    pub image: String,
}

#[derive(Deserialize, Debug)]
#[serde(untagged)]
pub enum AnilistField {
    ID(u32),
    Info(AnilistResult),
}

#[derive(Deserialize, Debug)]
#[serde(untagged)]
pub enum EpisodeField {
    Episode(i32),
    Name(String),
    Range(Vec<i32>),
}

impl ToString for EpisodeField {
    fn to_string(&self) -> String {
        match self {
            Self::Name(str) => str.to_owned(),
            Self::Episode(num) => num.to_string(),
            Self::Range(vec) => format!("{} - {}", vec[0], vec[vec.len() - 1]),
        }
    }
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AnilistResult {
    pub id: u32,
    pub id_mal: Option<u32>,
    pub title: AnilistTitle,
    pub synonyms: Vec<String>,
    pub is_adult: bool,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AnilistTitle {
    pub native: Option<String>,
    pub romaji: String,
    pub english: Option<String>,
}
