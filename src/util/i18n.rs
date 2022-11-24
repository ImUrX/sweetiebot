use std::{borrow::Cow, collections::HashMap};

use fluent_bundle::{bundle::FluentBundle, FluentResource};
use intl_memoizer::concurrent::IntlLangMemoizer;
use lazy_static::lazy_static;
use unic_langid::{langid, LanguageIdentifier};

pub static AVAILABLE_LANGS: &[&LanguageIdentifier] = &[&langid!("en-US")];

lazy_static! {
    pub static ref LANG_MAP: HashMap<LanguageIdentifier, FluentBundle<FluentResource, IntlLangMemoizer>> = {
        let mut map = HashMap::new();
        for lang in AVAILABLE_LANGS {
            let file = super::ASSETS_DIR
                .get_dir("langs")
                .unwrap()
                .get_file(format!("{}.ftl", lang.to_string()))
                .expect("Couldn't find one of the lang files")
                .contents_utf8()
                .unwrap();

            let res =
                FluentResource::try_new(file.to_string()).expect("Failed to parse an FTL file.");
            let mut bundle = FluentBundle::new_concurrent(vec![(*lang).clone()]);
            bundle
                .add_resource(res)
                .expect("Failed to add FTL resources to the bundle.");

            map.insert((*lang).clone(), bundle);
        }
        map
    };
}

pub fn get_all_of_key(key: &str) -> impl Iterator<Item = (String, Cow<str>)> + '_ {
    LANG_MAP.iter().map(|(lang_ident, bundle)| {
        let msg = bundle.get_message(key).expect("Message doesn't exist.");

        let pattern = msg.value().expect("Message has no value.");

        let mut errors = vec![];
        let value = bundle.format_pattern(&pattern, None, &mut errors);
        (lang_ident.to_string(), value)
    })
}
