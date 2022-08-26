use std::borrow::Cow;

use skia_safe::{Surface, Paint, paint, Rect};
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
fn generate_furigana(japanese: crate::util::JishoJapanese) {
    let mut surface = Surface::new_raster_n32_premul((IMAGE_WIDTH, IMAGE_WIDTH)).unwrap();
    let canvas = surface.canvas();
    let fill_paint = &mut Paint::default();
    fill_paint
        .set_color(0x2C2F33)
        .set_style(paint::Style::Fill);
    
    canvas.draw_rect(Rect::from_size((IMAGE_WIDTH, IMAGE_WIDTH)), fill_paint);
}
