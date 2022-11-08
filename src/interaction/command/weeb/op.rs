use std::borrow::Cow;

use anyhow::Result;
use rand::{seq::SliceRandom, thread_rng};
use twilight_interactions::command::{AutocompleteValue, CommandModel, CreateCommand};
use twilight_model::{
    application::{command::CommandOptionChoice, interaction::Interaction},
    http::interaction::{InteractionResponse, InteractionResponseType},
};
use twilight_util::builder::InteractionResponseDataBuilder;

use crate::{
    util::{
        animethemes::{get_video, search_theme},
        SAD_EMOJIS,
    },
    ClusterData,
};

#[derive(CommandModel, CreateCommand)]
#[command(name = "op", desc = "Searches for an anime opening or ending")]
pub struct OpeningCommand<'a> {
    #[command(desc = "Theme to look for", autocomplete = true)]
    query: Cow<'a, str>,
}

#[derive(CommandModel)]
#[command(autocomplete = true)]
pub struct OpeningCommandAutocomplete {
    query: AutocompleteValue<String>,
}

impl OpeningCommandAutocomplete {
    pub async fn run(self, info: ClusterData, interaction: &Interaction) -> Result<()> {
        let vec = if let AutocompleteValue::Focused(input) = &self.query {
            let res = search_theme(input, 25, info.anime_themes_pool).await?;
            res.iter()
                .map(|s| CommandOptionChoice::String {
                    name: format!("{} {}", s.name, s.slug),
                    name_localizations: None,
                    value: format!("\0{}", s.theme_id),
                })
                .collect()
        } else {
            Vec::new()
        };
        

        let response = InteractionResponse {
            kind: InteractionResponseType::ApplicationCommandAutocompleteResult,
            data: Some(InteractionResponseDataBuilder::new().choices(vec).build()),
        };
        info.http
            .interaction(info.application_id)
            .create_response(interaction.id, &interaction.token, &response)
            .exec()
            .await?;

        Ok(())
    }
}

impl OpeningCommand<'_> {
    pub async fn run(self, info: ClusterData, interaction: &Interaction) -> Result<()> {
        let theme_id = if self.query.starts_with('\0') {
            self.query[1..]
                .parse::<u64>()
                .expect("not a number after null character")
        } else {
            let possible = search_theme(&self.query, 1, info.anime_themes_pool.clone()).await?;
            if let Some(theme) = possible.get(0) {
                theme.theme_id
            } else {
                let response = InteractionResponse {
                    kind: InteractionResponseType::ChannelMessageWithSource,
                    data: Some(
                        InteractionResponseDataBuilder::new()
                            .content(format!(
                                "Couldn't find the anime theme {}",
                                SAD_EMOJIS.choose(&mut thread_rng()).unwrap()
                            ))
                            .build(),
                    ),
                };

                info.http
                    .interaction(interaction.application_id)
                    .create_response(interaction.id, &interaction.token, &response)
                    .exec()
                    .await?;

                return Ok(());
            }
        };

        let videos = get_video(theme_id, info.anime_themes_pool).await?;
        let mut prelude = "".to_string();
        if let Some(title) = &videos[0].title {
            prelude += &format!("**{title}**");
        }
        if let Some(name) = &videos[0].artist_name {
            prelude += &format!(" from {name}");
        }

        let response = InteractionResponse {
            kind: InteractionResponseType::ChannelMessageWithSource,
            data: Some(
                InteractionResponseDataBuilder::new()
                    .content(format!(
                        "{prelude}\nhttps://v.animethemes.moe/{}",
                        videos[0].basename
                    ))
                    .build(),
            ),
        };

        info.http
            .interaction(interaction.application_id)
            .create_response(interaction.id, &interaction.token, &response)
            .exec()
            .await?;
        Ok(())
    }
}
