use std::borrow::Cow;
use std::io::Cursor;

use anyhow::Result;
use image::{io::Reader as ImageReader, RgbaImage, imageops::{thumbnail, replace}};
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

static COORDINATES: &[(i64, i64)] = &[(0, 0), (256, 0), (0, 256), (256, 256)];

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
            let mut img = RgbaImage::new(512, 512);
            for (i, (x, y)) in images.into_iter().zip(COORDINATES.iter()) {
                let i = ImageReader::new(Cursor::new(base64::decode(i)?))
                    .with_guessed_format()?
                    .decode()?;
                let resize = thumbnail(&i, 256, 256);
                replace(&mut img, &resize, *x, *y);
            }
            let mut new_bytes: Vec<u8> = Vec::new();
            img.write_to(
                &mut Cursor::new(&mut new_bytes),
                image::ImageOutputFormat::Png,
            )?;
            let attachment = Attachment::from_bytes("prompt.png".to_string(), new_bytes, 0);

            info.http
                .interaction(interaction.application_id)
                .update_response(&interaction.token)
                .attachments(&[attachment])?
                .await?;
        } else {
            println!("{:?}", res);
        }

        Ok(())
    }
}
