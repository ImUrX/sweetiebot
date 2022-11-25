use std::borrow::Cow;

use anyhow::Result;
use twilight_interactions::command::{AutocompleteValue, CommandModel, CreateCommand};
use twilight_model::{application::interaction::Interaction, http::attachment::Attachment};

use crate::{
    util::{
        stablediffusion::{get_txt2img, Txt2Img},
        DEFERRED_RESPONSE,
    },
    ClusterData,
};

#[derive(CommandModel, CreateCommand)]
#[command(name = "draw", desc = "Draws the requested image")]
pub struct DrawCommand<'a> {
    #[command(desc = "What do you want me to draw?")]
    list: Cow<'a, str>,
}

#[derive(CommandModel)]
#[command(autocomplete = true)]
pub struct DrawCommandAutocomplete {
    list: AutocompleteValue<String>,
}

impl DrawCommand<'_> {
    pub async fn run(self, info: ClusterData, interaction: &Interaction) -> Result<()> {
        info.http
            .interaction(interaction.application_id)
            .create_response(interaction.id, &interaction.token, &DEFERRED_RESPONSE)
            .await?;

        let req = Txt2Img {
            prompt: self.list.into(),
            batch_size: 4,
            ..Default::default()
        };
        let res = get_txt2img(&req).await?;
        if let Some(images) = res.images {
            

            info.http
                .interaction(interaction.application_id)
                .update_response(&interaction.token)
                .attachments(&[img])?
                .await?;
        } else {
            println!("{:?}", res);
        }

        Ok(())
    }
}
