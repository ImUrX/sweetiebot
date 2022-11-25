use std::{borrow::Cow, collections::HashMap};

use fluent_bundle::{bundle::FluentBundle, FluentResource};
use intl_memoizer::concurrent::IntlLangMemoizer;
use itertools::Itertools;
use lazy_static::lazy_static;
use phf::phf_map;
use unic_langid::{langid, LanguageIdentifier};

pub static AVAILABLE_LANGS: phf::Map<&'static str, &'static LanguageIdentifier> = phf_map! {
    "en-US" => &langid!("en-US"),
    "es-ES" => &langid!("es-ES"),
};

lazy_static! {
    pub static ref LANG_MAP: HashMap<LanguageIdentifier, FluentBundle<FluentResource, IntlLangMemoizer>> = {
        let mut map = HashMap::new();
        for (lang_name, lang_id) in AVAILABLE_LANGS.entries() {
            println!(
                "{:?}",
                super::ASSETS_DIR
                    .get_dir("langs")
                    .unwrap()
                    .files()
                    .collect_vec()
            );
            let file = super::ASSETS_DIR
                .get_file(format!("langs/{}.ftl", lang_name))
                .expect("Couldn't find one of the lang files")
                .contents_utf8()
                .unwrap();

            let res =
                FluentResource::try_new(file.to_string()).expect("Failed to parse an FTL file.");
            let mut bundle = FluentBundle::new_concurrent(vec![(*lang_id).clone()]);
            bundle
                .add_resource(res)
                .expect("Failed to add FTL resources to the bundle.");

            map.insert((*lang_id).clone(), bundle);
        }
        map
    };
}

pub fn get_all_of_key(key: &str) -> impl Iterator<Item = (String, Cow<str>)> + '_ {
    LANG_MAP.iter().map(|(lang_ident, bundle)| {
        let parts: Vec<&str> = key.split('.').collect();
        let msg = bundle
            .get_message(parts[0])
            .expect("Message doesn't exist.");
        let pattern = if let Some(attr) = parts.get(1) {
            msg.get_attribute(attr)
                .expect("Attribute doesn't exist.")
                .value()
        } else {
            msg.value().expect("Message has no value.")
        };

        let mut errors = vec![];
        let value = bundle.format_pattern(&pattern, None, &mut errors);
        (lang_ident.to_string(), value)
    })
}
