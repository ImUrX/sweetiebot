use std::{borrow::Cow, io::Read};

use anyhow::{ensure, Result};
use itertools::Itertools;
use skia_safe::{
    textlayout::{ParagraphBuilder, ParagraphStyle, TextAlign, TextStyle},
    EncodedImageFormat, Image, Surface,
};
use twilight_interactions::command::{CommandModel, CreateCommand};
use twilight_model::{
    application::interaction::Interaction, channel::embed::EmbedField, http::attachment::Attachment,
};
use twilight_util::builder::{
    command::AttachmentBuilder,
    embed::{EmbedBuilder, EmbedFieldBuilder, ImageSource},
};
use twilight_validate::embed::FIELD_VALUE_LENGTH;

use crate::{
    util::{measure_text_width, JishoJapanese, JishoWord},
    ClusterData,
};

#[derive(CommandModel, CreateCommand)]
#[command(name = "japanese", desc = "Searches in Jisho for the word")]
pub struct JishoCommand<'a> {
    #[command(
        desc = "Can be a kanji, a japanese word or even an english word (Same search features as Jisho)"
    )]
    word: Cow<'a, str>,
}

impl JishoCommand<'_> {
    async fn run(&self, info: ClusterData, interaction: Interaction) -> Result<()> {
        Ok(())
    }

    fn make_embed(word: JishoWord) -> Result<(EmbedBuilder, Attachment)> {
        let mut embed = EmbedBuilder::new()
            .title(word.slug.clone())
            .url(format!("https://jisho.org/word/{}", word.slug))
            .thumbnail(ImageSource::attachment("furigana.png")?);

        let tags = Self::process_tags(&word).join(" - ");
        if !tags.is_empty() {
            embed = embed.description(format!("**{}**", tags))
        }

        let mut fields: Vec<EmbedField> = Vec::with_capacity(word.senses.len());
        for (index, sense) in word.senses.iter().enumerate() {
            let mut content = format!(
                "{}. **{}**",
                index + 1,
                sense.english_definitions.join("; ")
            );
            content += &sense.tags.join(", ");
            content += &sense
                .restrictions
                .iter()
                .map(|x| format!("Only applies to {}", x))
                .join(", ");
            content += &sense
                .see_also
                .iter()
                .map(|x| format!("[{}](https://jisho.org/search/{0})", x))
                .join(", ");
            content += &sense.info.join(", ");
            content += &sense
                .links
                .iter()
                .map(|x| format!("[{}]({})", x.text, x.url))
                .join(", ");

            if sense.parts_of_speech.is_empty() && !fields.is_empty() {
                let len = fields.len();
                fields[len - 1].value += &("\n".to_string() + &content);
                ensure!(
                    fields[len - 1].value.encode_utf16().count() > FIELD_VALUE_LENGTH,
                    "Modifying the previous field made it too big!"
                );
                continue;
            }

            fields.push(
                EmbedFieldBuilder::new(
                    if sense.parts_of_speech.is_empty() {
                        "\u{200b}".to_string()
                    } else {
                        sense.parts_of_speech.join(", ")
                    },
                    content,
                )
                .build(),
            )
        }

        if word.japanese.len() > 1 {
            let forms = word
                .japanese
                .iter()
                .skip(1)
                .filter_map(|x| {
                    x.word
                        .as_ref()
                        .map(|writing| format!("{} 【{}】", writing, x.reading))
                })
                .join("、");

            fields.push(EmbedFieldBuilder::new("Other forms", forms).build());
        }

        for field in fields {
            embed = embed.field(field);
        }

        let furigana = Self::generate_furigana(&word.japanese[0])
            .encode_to_data(EncodedImageFormat::PNG)
            .unwrap();
        // Converting the SkData to a Vec this way makes a copy of the whole &[u8], not nice.
        Ok((
            embed,
            Attachment::from_bytes("furigana.png".to_string(), furigana.to_vec(), 1),
        ))
    }

    fn process_tags(word: &JishoWord) -> Vec<String> {
        let mut vec = Vec::new();
        if word.is_common {
            vec.push("common word".to_owned());
        }
        for tag in word.tags.iter() {
            if let Some(lvl) = tag.strip_prefix("wanikani") {
                vec.push(format!("wanikani lvl{}", lvl));
            } else {
                eprintln!("discovered new tag {}", tag);
            }
        }
        vec
    }

    const IMAGE_WIDTH: i32 = 128;
    const IMAGE_HEIGHT: i32 = 128;
    const MARGIN: i32 = 6;
    const BACKGROUND_COLOR: u32 = 0xFF2C2F33;
    const TEXT_COLOR: u32 = 0xFFFFFFFF;
    const TEXT_SIZE: f32 = 32.0;
    pub fn generate_furigana(japanese: &JishoJapanese) -> Image {
        let mut surface =
            Surface::new_raster_n32_premul((Self::IMAGE_WIDTH, Self::IMAGE_HEIGHT)).unwrap();
        let canvas = surface.canvas();
        let text = japanese.word.as_ref().unwrap_or(&japanese.reading);

        canvas.clear(Self::BACKGROUND_COLOR);

        let mut text_style = TextStyle::new();
        text_style
            .set_color(Self::TEXT_COLOR)
            .set_font_size(Self::TEXT_SIZE)
            .set_font_families(crate::util::FONT_NAMES);

        let mut paragraph_style = ParagraphStyle::new();
        paragraph_style
            .set_text_align(TextAlign::Center)
            .set_text_style(&text_style);

        let mut paragraph_builder =
            ParagraphBuilder::new(&paragraph_style, crate::util::get_font_collection());

        let measure = measure_text_width(
            &mut paragraph_builder,
            text,
            (Self::IMAGE_WIDTH - Self::MARGIN) as f32,
        );
        let size: f32 = if measure >= Self::IMAGE_WIDTH.into() {
            (((Self::IMAGE_WIDTH - Self::MARGIN) as f64 / measure) * Self::TEXT_SIZE as f64) as f32
        } else {
            Self::TEXT_SIZE
        };

        text_style.set_font_size(size);
        let mut paragraph = paragraph_builder
            .push_style(&text_style)
            .add_text(text.as_str())
            .build();
        paragraph.layout((Self::IMAGE_WIDTH - Self::MARGIN) as f32);
        paragraph.paint(canvas, (0, (Self::IMAGE_HEIGHT / 2) - (size / 2.0) as i32));
        if japanese.furigana.is_empty() {
            return surface.image_snapshot();
        }

        let text_length = text.chars().count();
        let reducer = if text_length == 1 { 0 } else { 1 };
        let first_char_pos_x = {
            let mut half_width = size * ((text_length / 2) - reducer) as f32;
            // if its even
            if text_length & 1 == 0 {
                half_width -= size / 2.0;
            } else if reducer == 1 {
                half_width -= size;
            }
            half_width
        };

        for (index, furigana) in japanese.furigana.iter().enumerate() {
            paragraph_builder.reset();
            text_style.set_font_size(Self::TEXT_SIZE / 2.0);
            paragraph_builder.push_style(&text_style);
            let furigana_measure = measure_text_width(
                &mut paragraph_builder,
                furigana,
                (Self::IMAGE_WIDTH - Self::MARGIN) as f32,
            );
            let furigana_size = if furigana_measure < size.into() {
                16.0
            } else {
                (size as f64 / furigana_measure) as f32 * (Self::TEXT_SIZE / 2f32)
            };
            text_style.set_font_size(furigana_size);
            let mut paragraph = paragraph_builder
                .push_style(&text_style)
                .add_text(furigana)
                .build();
            paragraph.layout((Self::IMAGE_WIDTH - Self::MARGIN) as f32);
            paragraph.paint(
                canvas,
                (
                    first_char_pos_x + (index as f32 * size),
                    (Self::IMAGE_HEIGHT as f32 / 2.0) - size,
                ),
            )
        }
        surface.image_snapshot()
    }
}
