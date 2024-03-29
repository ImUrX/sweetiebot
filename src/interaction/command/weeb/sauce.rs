use anyhow::Result;
use rand::{seq::SliceRandom, thread_rng};
use twilight_interactions::command::{CommandModel, CreateCommand};
use twilight_model::{application::interaction::Interaction, channel::Attachment};
use twilight_util::builder::InteractionResponseDataBuilder;

use crate::{
    util::{
        saucenao::{build_embed as build_saucenao_embed, fetch as fetch_saucenao},
        tracemoe::{build_embed as build_tracemoe_embed, fetch as fetch_tracemoe},
        EmbedList, DEFERRED_RESPONSE, SAD_EMOJIS,
    },
    ClusterData,
};

#[derive(CommandModel, CreateCommand)]
#[command(name = "sauce", desc = "Searches the image's original source")]
pub enum SauceCommand {
    #[command(name = "saucenao")]
    SauceNAO(SauceSauceNAO),
    #[command(name = "tracemoe")]
    TraceMoe(SauceTraceMoe),
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

impl SauceTraceMoe {
    pub async fn run(self, info: ClusterData, interaction: &Interaction) -> Result<()> {
        info.http
            .interaction(interaction.application_id)
            .create_response(interaction.id, &interaction.token, &DEFERRED_RESPONSE)
            .await?;

        let res = fetch_tracemoe(&self.image).await?;
        let mut embed_list = EmbedList::new(
            info.http.clone(),
            interaction.application_id,
            info.standby.clone(),
        );

        let nsfw = info.is_nsfw_interaction(interaction).await?;
        for data in res.result.iter().take(10) {
            let (embed, attachment) = build_tracemoe_embed(data, nsfw).await?;
            embed_list.add(embed.build(), Some(attachment));
        }
        embed_list
            .defer_reply(interaction, InteractionResponseDataBuilder::new())
            .await?;
        Ok(())
    }
}

impl SauceSauceNAO {
    pub async fn run(self, info: ClusterData, interaction: &Interaction) -> Result<()> {
        info.http
            .interaction(interaction.application_id)
            .create_response(interaction.id, &interaction.token, &DEFERRED_RESPONSE)
            .await?;

        let res = fetch_saucenao(&self.image).await?;

        if res.header.status > 0 && res.results.is_empty() {
            info.http
            .interaction(interaction.application_id)
            .update_response(&interaction.token)
            .content(
                Some(
                    &format!(
                        "Seems that SauceNAO is not having a good time currently {} ``(status code: {})``",
                        SAD_EMOJIS.choose(&mut thread_rng()).unwrap(),
                        res.header.status
                    )
                )
            )?
            .await?;
            return Ok(());
        }

        if res.header.status < 0 {
            info.http
                .interaction(interaction.application_id)
                .update_response(&interaction.token)
                .content(
                    Some(
                        &format!(
                            "Sorry, an error happened {} ``(status code: {})``\nDid you send a valid image?",
                            SAD_EMOJIS.choose(&mut thread_rng()).unwrap(),
                            res.header.status
                        )
                    )
                )?
                .await?;
            return Ok(());
        }

        let mut embed_list = EmbedList::new(
            info.http.clone(),
            interaction.application_id,
            info.standby.clone(),
        );

        let nsfw = info.is_nsfw_interaction(interaction).await?;
        for data in res.results.iter().take(10) {
            let (embed, attachment) = build_saucenao_embed(data, nsfw).await?;
            embed_list.add(embed.build(), Some(attachment));
        }
        embed_list
            .defer_reply(interaction, InteractionResponseDataBuilder::new())
            .await?;
        Ok(())
    }
}
