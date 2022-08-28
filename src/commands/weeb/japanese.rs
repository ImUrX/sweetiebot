use std::borrow::Cow;

use skia_safe::{
    textlayout::{ParagraphBuilder, ParagraphStyle, TextAlign, TextStyle},
    Image, Surface,
};
use twilight_interactions::command::{CommandModel, CreateCommand};

use crate::util::measure_text_width;

#[derive(CommandModel, CreateCommand)]
#[command(name = "japanese", desc = "Searches in Jisho for the word")]
pub struct JishoCommand<'a> {
    #[command(
        desc = "Can be a kanji, a japanese word or even an english word (Same search features as Jisho)"
    )]
    word: Cow<'a, str>,
}

fn process_tags(word: crate::util::JishoWord) -> Vec<String> {
    let mut vec = Vec::new();
    if word.is_common {
        vec.push("common word".to_owned());
    }
    for tag in word.tags {
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
pub fn generate_furigana(japanese: crate::util::JishoJapanese) -> Image {
    let mut surface = Surface::new_raster_n32_premul((IMAGE_WIDTH, IMAGE_HEIGHT)).unwrap();
    let canvas = surface.canvas();
    let text = japanese.word.unwrap_or(japanese.reading);

    canvas.clear(BACKGROUND_COLOR);

    let mut text_style = TextStyle::new();
    text_style
        .set_color(TEXT_COLOR)
        .set_font_size(TEXT_SIZE)
        .set_font_families(crate::util::FONT_NAMES);

    let mut paragraph_style = ParagraphStyle::new();
    paragraph_style
        .set_text_align(TextAlign::Center)
        .set_text_style(&text_style);

    let mut paragraph_builder =
        ParagraphBuilder::new(&paragraph_style, crate::util::get_font_collection());

    let measure = measure_text_width(&mut paragraph_builder, &text, (IMAGE_WIDTH - MARGIN) as f32);
    let size: f32 = if measure >= IMAGE_WIDTH.into() {
        (((IMAGE_WIDTH - MARGIN) as f64 / measure) * TEXT_SIZE as f64) as f32
    } else {
        TEXT_SIZE
    };

    text_style.set_font_size(size);
    let mut paragraph = paragraph_builder.push_style(&text_style).add_text(text.as_str()).build();
    paragraph.layout((IMAGE_WIDTH - MARGIN) as f32);
    paragraph.paint(canvas, (0, (IMAGE_HEIGHT / 2) - (size / 2.0) as i32));
    if japanese.furigana.is_empty() {
        return surface.image_snapshot();
    }

    let text_length = text.chars().count();
    let reducer = if text_length == 1 { 0 } else { 1 };
    let first_char_pos_x = {
        let mut half_width = (size * ((text_length / 2) - reducer) as f32);
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
        text_style.set_font_size(TEXT_SIZE / 2.0);
        paragraph_builder.push_style(&text_style);
        let furigana_measure = measure_text_width(
            &mut paragraph_builder,
            furigana,
            (IMAGE_WIDTH - MARGIN) as f32,
        );
        let furigana_size = if furigana_measure < size.into() {
            16.0
        } else {
            (size as f64 / furigana_measure) as f32 * (TEXT_SIZE / 2f32)
        };
        text_style.set_font_size(furigana_size);
        let mut paragraph = paragraph_builder.push_style(&text_style).add_text(furigana).build();
        paragraph.layout((IMAGE_WIDTH - MARGIN) as f32);
        paragraph.paint(
            canvas,
            (
                first_char_pos_x + (index as f32 * size),
                (IMAGE_HEIGHT as f32 / 2.0) - size,
            ),
        )
    }
    surface.image_snapshot()
}
