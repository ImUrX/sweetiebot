use std::borrow::Cow;

use anyhow::Result;
use rand::{seq::SliceRandom, thread_rng};
use twilight_interactions::command::{AutocompleteValue, CommandModel, CreateCommand};
use twilight_model::{
    application::{
        command::{CommandOptionChoice, CommandOptionChoiceValue},
        interaction::Interaction,
    },
    channel::message::MessageFlags,
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
    theme: Cow<'a, str>,
}

#[derive(CommandModel)]
#[command(autocomplete = true)]
pub struct OpeningCommandAutocomplete {
    theme: AutocompleteValue<String>,
}

impl OpeningCommandAutocomplete {
    pub async fn run(self, info: ClusterData, interaction: &Interaction) -> Result<()> {
        let vec = if let AutocompleteValue::Focused(input) = &self.theme {
            let res = search_theme(input, 25, info.pool).await?;
            res.iter()
                .map(|s| CommandOptionChoice {
                    name: format!("{} {}", s.name, s.slug),
                    name_localizations: None,
                    value: CommandOptionChoiceValue::String(format!("\0{}", s.theme_id)),
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
            .await?;

        Ok(())
    }
}

impl OpeningCommand<'_> {
    pub async fn run(self, info: ClusterData, interaction: &Interaction) -> Result<()> {
        let theme_id = if self.theme.starts_with('\0') {
            self.theme[1..]
                .parse::<u64>()
                .expect("not a number after null character")
        } else {
            let possible = search_theme(&self.theme, 1, info.pool.clone()).await?;
            if let Some(theme) = possible.get(0) {
                theme.theme_id
            } else {
                let response = InteractionResponse {
                    kind: InteractionResponseType::ChannelMessageWithSource,
                    data: Some(
                        InteractionResponseDataBuilder::new()
                            .content(format!(
                                "Couldn't find the anime theme {}\nHint: Use the suggestions that pop up while you write so you can search the precise theme you are searching for.",
                                SAD_EMOJIS.choose(&mut thread_rng()).unwrap()
                            ))
                            .flags(MessageFlags::EPHEMERAL)
                            .build(),
                    ),
                };

                info.http
                    .interaction(interaction.application_id)
                    .create_response(interaction.id, &interaction.token, &response)
                    .await?;

                return Ok(());
            }
        };

        let videos = get_video(theme_id, info.pool).await?;
        if videos.is_empty() {
            let response = InteractionResponse {
                kind: InteractionResponseType::ChannelMessageWithSource,
                data: Some(
                    InteractionResponseDataBuilder::new()
                        .content(format!(
                            "This theme is yet to be uploaded. {}",
                            SAD_EMOJIS.choose(&mut thread_rng()).unwrap()
                        ))
                        .flags(MessageFlags::EPHEMERAL)
                        .build(),
                ),
            };

            info.http
                .interaction(interaction.application_id)
                .create_response(interaction.id, &interaction.token, &response)
                .await?;

            return Ok(());
        }

        let mut prelude = "".to_string();
        if let Some(title) = &videos[0].title {
            prelude += &format!("**{title}**");
        }
        if let Some(name) = &videos[0].artist_name {
            prelude += &format!(" from {name}");
        }

        let tags = {
            let tags = videos[0].get_tag();
            if tags.is_empty() {
                "".to_string()
            } else {
                format!("-{}", tags.join(""))
            }
        };

        let response = InteractionResponse {
            kind: InteractionResponseType::ChannelMessageWithSource,
            data: Some(
                InteractionResponseDataBuilder::new()
                    .content(format!(
                        "{prelude}\nhttps://animethemes.moe/anime/{}/{}{tags}",
                        videos[0].anime_slug, videos[0].theme_slug
                    ))
                    .build(),
            ),
        };

        info.http
            .interaction(interaction.application_id)
            .create_response(interaction.id, &interaction.token, &response)
            .await?;
        Ok(())
    }
}
