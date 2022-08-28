use std::{borrow::Cow};

use skia_safe::{
    paint,
    textlayout::{ParagraphBuilder, ParagraphStyle, TextAlign, TextStyle},
    Paint, Rect, Surface, Image, Point
};
use twilight_interactions::command::{CommandModel, CreateCommand};

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
    text_style.set_color(TEXT_COLOR).set_font_size(TEXT_SIZE);

    let mut paragraph_style = ParagraphStyle::new();
    paragraph_style
        .set_text_align(TextAlign::Center)
        .set_text_style(&text_style);

    let mut paragraph_builder =
        ParagraphBuilder::new(&paragraph_style, crate::util::get_font_collection());
    let measure = {
        let mut paragraph = paragraph_builder
            .add_text(text.as_str())
            .build();
        paragraph.layout((IMAGE_WIDTH - MARGIN) as f32);
        let measure = paragraph.get_line_metrics();
        paragraph_builder.reset();
        measure[0].width
    };
    let size: f32 = if measure >= IMAGE_WIDTH.into() {
        (((IMAGE_WIDTH - MARGIN) as f64 / measure) * TEXT_SIZE as f64) as f32
    } else {
        TEXT_SIZE
    };

    text_style.set_font_size(size);
    let mut paragraph = paragraph_builder.add_text(text.as_str()).build();
    paragraph.layout((IMAGE_WIDTH - MARGIN) as f32);
    paragraph.paint(canvas, (0, (IMAGE_HEIGHT / 2) - (size / 2f32) as i32));
    if japanese.furigana.is_empty() {
        return surface.image_snapshot()
    }
    surface.image_snapshot()
}
