use std::borrow::Cow;

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
