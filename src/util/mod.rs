use std::{sync::Arc, time::Duration};

use anyhow::{ensure, Result};
use futures::{stream::TryStreamExt, StreamExt, TryFutureExt};
use include_dir::{include_dir, Dir};
use lazy_static::lazy_static;
use scraper::{Html, Selector};
use serde::Deserialize;
use skia_safe::{
    scalar,
    textlayout::{FontCollection, ParagraphBuilder, TypefaceFontProvider},
    Data, Typeface,
};
use tokio::time::timeout;
use twilight_http::Client as HttpClient;
use twilight_model::{
    application::{
        component::{button::ButtonStyle, ActionRow, Button, Component},
        interaction::{Interaction, InteractionData},
    },
    channel::embed::Embed,
    http::{interaction::{InteractionResponse, InteractionResponseType}, attachment::Attachment},
    id::marker::ApplicationMarker,
    id::Id,
};
use twilight_standby::Standby;
use twilight_util::builder::InteractionResponseDataBuilder;
use urlencoding::encode;

static VALID_FONTS: &[&str] = &["ttf", "ttc", "otf"];
pub static DEFERRED_RESPONSE: InteractionResponse = InteractionResponse {
    kind: InteractionResponseType::DeferredChannelMessageWithSource,
    data: None
};
pub static DEFERRED_COMPONENT_RESPONSE: InteractionResponse = InteractionResponse {
    kind: InteractionResponseType::DeferredUpdateMessage,
    data: None
};

pub static ASSETS_DIR: Dir = include_dir!("$CARGO_MANIFEST_DIR/assets");
lazy_static! {
    pub static ref FONTS: Vec<Typeface> = {
        let mut vec = Vec::new();
        for dir in ASSETS_DIR
            .get_dir("fonts")
            .expect("There is no fonts folder!")
            .dirs()
        {
            for font in dir.files().filter(|x| {
                if let Some(ext) = x.path().extension() {
                    VALID_FONTS.contains(&&*ext.to_string_lossy())
                } else {
                    false
                }
            }) {
                let data = unsafe { Data::new_bytes(font.contents()) };
                vec.push(Typeface::from_data(data, 0).expect("Invalid font!"));
            }
        }
        vec
    };
}

pub static FONT_NAMES: &[&str] = &["Noto Sans", "Noto Sans CJK JP", "Noto Color Emoji"];
pub fn get_font_collection() -> FontCollection {
    let mut collection = FontCollection::new();
    let mut mgr = TypefaceFontProvider::new();
    for font in FONTS.iter() {
        mgr.register_typeface(font.clone(), Option::<&str>::None);
    }
    collection.set_default_font_manager_and_family_names(Some(mgr.into()), FONT_NAMES);
    collection
}

pub fn measure_text_width<'a>(
    paragraph_builder: &'a mut ParagraphBuilder,
    text: &'a str,
    layout: scalar,
) -> f64 {
    if text.is_empty() {
        return 0.0;
    }
    let mut paragraph = paragraph_builder.add_text(text).build();
    paragraph.layout(layout);
    let measure = paragraph.get_line_metrics();
    paragraph_builder.reset();
    measure[0].width
}

pub struct EmbedList {
    pub embeds: Vec<Embed>,
    pub attachments: Vec<Option<Attachment>>,
    pub index: Arc<usize>,
    pub duration: u64,
    http: Arc<HttpClient>,
    application_id: Id<ApplicationMarker>,
    standby: Arc<Standby>,
}

impl EmbedList {
    pub fn new(
        http: Arc<HttpClient>,
        application_id: Id<ApplicationMarker>,
        standby: Arc<Standby>,
    ) -> Self {
        EmbedList {
            embeds: Vec::new(),
            attachments: Vec::new(),
            index: Arc::new(0),
            duration: 70,
            http,
            application_id,
            standby,
        }
    }

    pub fn add(&mut self, embed: Embed, attachment: Option<Attachment>) {
        self.embeds.push(embed);
        self.attachments.push(attachment);
    }

    pub async fn reply(
        self,
        interaction: &Interaction,
        builder: InteractionResponseDataBuilder,
    ) -> Result<()> {
        ensure!(!self.embeds.is_empty(), "There is no embeds to send!");

        // Just send the embed without any component
        if self.embeds.len() == 1 {
            let client = self.http.interaction(self.application_id);
            // FIXME: Cloning
            let builder = builder.embeds(self.embeds).attachments(self.attachments.iter().filter_map(|x| x.to_owned()));
            let response = InteractionResponse {
                kind: InteractionResponseType::ChannelMessageWithSource,
                data: Some(builder.build()),
            };
            let create = client.create_response(interaction.id, &interaction.token, &response);
            create.exec().await?;
            return Ok(());
        }

        // Send the first message with the embed and components
        let first = builder
            .clone()
            .embeds([self.embeds[0].clone()])
            .attachments(self.attachments[0].clone())
            .components([Component::ActionRow(Self::generate_row(true, false))]);
        let response = InteractionResponse {
            kind: InteractionResponseType::ChannelMessageWithSource,
            data: Some(first.build()),
        };
        self.http
            .interaction(self.application_id)
            .create_response(interaction.id, &interaction.token, &response)
            .exec()
            .await?;

        let message_id = self.http.interaction(self.application_id).response(&interaction.token).exec().await?.model().await?.id;
        // Make stream based on the back and next buttons
        let components = self.standby.wait_for_component_stream(
            message_id,
            |event: &Interaction| {
                if let Some(InteractionData::MessageComponent(data)) = &event.data {
                    data.custom_id == "back" || data.custom_id == "next"
                } else {
                    false
                }
            },
        );

        // Try for each the stream because we need to time out of it after the specified time
        let process = components
            .map(|x| -> Result<Interaction> { Ok(x) })
            .try_for_each(|component| {
                let list = Arc::new(&self);
                let mut index = list.index.clone();
                let token = interaction.token.clone();
                async move {
                    if let Some(InteractionData::MessageComponent(data)) = component.data {
                        list.http.interaction(list.application_id).create_response(component.id, &component.token, &DEFERRED_COMPONENT_RESPONSE).exec().await?;
                        let index = match &*data.custom_id {
                            // we are not parallelizing the stream, so the arc should only be touched once per time so no deadlocks
                            "next" => {
                                unsafe {
                                    *Arc::get_mut_unchecked(&mut index) += 1;
                                }
                                *index
                            }
                            "back" => {
                                unsafe {
                                    *Arc::get_mut_unchecked(&mut index) -= 1;
                                }
                                *index
                            }
                            _ => panic!("unhandled custom id!"),
                        };
                        let action_row = [Component::ActionRow(Self::generate_row(
                            index == 0,
                            index == list.embeds.len(),
                        ))];
                        let embeds = &list.embeds[index..(index + 1)];
                        //FIXME: Copying attachments just to pass them...
                        let attachments: Vec<Attachment> = list.attachments[index..(index + 1)].iter().filter_map(|x| x.to_owned()).collect();
                        let _update = list
                            .http
                            .interaction(list.application_id)
                            .update_response(&token)
                            .embeds(Some(embeds))?
                            .attachments(&attachments)?
                            .components(Some(&action_row))?
                            .exec()
                            .await?;
                    }
                    Ok(())
                }
            });

        // Clear all components when timeout runs out
        match timeout(Duration::from_secs(self.duration), process).await {
            Err(_) => {
                let _update = self
                    .http
                    .interaction(self.application_id)
                    .update_response(&interaction.token)
                    .components(None)?
                    .exec()
                    .await?;
                Ok(())
            }
            Ok(result) => result,
        }
    }

    fn generate_row(prev: bool, next: bool) -> ActionRow {
        ActionRow {
            components: Vec::from([
                Component::Button(Button {
                    custom_id: Some("back".to_string()),
                    label: Some("< Prev.".to_string()),
                    style: ButtonStyle::Secondary,
                    disabled: prev,
                    emoji: None,
                    url: None,
                }),
                Component::Button(Button {
                    custom_id: Some("next".to_string()),
                    label: Some("Next >".to_string()),
                    style: ButtonStyle::Secondary,
                    disabled: next,
                    emoji: None,
                    url: None,
                }),
            ]),
        }
    }
}

pub async fn jisho_words(keyword: &str) -> Result<JishoResult> {
    let client = reqwest::Client::new();
    let mut res = client
        .get("https://jisho.org/api/v1/search/words")
        .query(&[("keyword", keyword)])
        .send()
        .await?
        .json::<JishoResult>()
        .await?;

    let html = client
        .get(format!("https://jisho.org/search/{}", encode(keyword)))
        .send()
        .await?
        .text()
        .await?;
    let document = Html::parse_document(&html);
    let definition_selector = Selector::parse("#primary > div > div").unwrap();
    let furigana_selector = Selector::parse(".furigana span").unwrap();
    let mut furiganas: Vec<Vec<String>> = Vec::new();
    for definition in document.select(&definition_selector) {
        furiganas.push(
            definition
                .select(&furigana_selector)
                .map(|x| x.inner_html().trim().to_string())
                .collect(),
        );
    }

    for (data, furigana) in res.data.iter_mut().zip(furiganas) {
        data.japanese[0].furigana = furigana;
    }
    Ok(res)
}

#[derive(Deserialize, Debug)]
pub struct JishoResult {
    pub meta: JishoMetadata,
    pub data: Vec<JishoWord>,
}

#[derive(Deserialize, Debug)]
pub struct JishoWord {
    pub slug: String,
    pub is_common: Option<bool>,
    pub tags: Vec<String>,
    pub jlpt: Vec<String>,
    pub japanese: Vec<JishoJapanese>,
    pub senses: Vec<JishoSense>,
    #[serde(skip_deserializing)]
    pub attribution: JishoWordAttribution,
    //audio: JishoWordAudio
}

#[derive(Deserialize, Debug, Default)]
pub struct JishoWordAttribution {
    pub jmdict: bool,
    pub jmnedict: bool,
    pub dbpedia: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct JishoWordAudio {
    pub mp3: Option<String>,
    pub ogg: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct JishoMetadata {
    pub status: u32,
}

#[derive(Deserialize, Debug)]
pub struct JishoJapanese {
    pub word: Option<String>,
    pub reading: Option<String>,
    #[serde(default)]
    pub furigana: Vec<String>,
}

#[derive(Deserialize, Debug)]
pub struct JishoSense {
    pub english_definitions: Vec<String>,
    pub parts_of_speech: Vec<String>,
    pub links: Vec<JishoSenseLink>,
    pub tags: Vec<String>,
    pub restrictions: Vec<String>,
    pub see_also: Vec<String>,
    pub antonyms: Vec<String>,
    pub source: Vec<String>,
    pub info: Vec<String>,
}

#[derive(Deserialize, Debug)]
pub struct JishoSenseLink {
    pub text: String,
    pub url: String,
}
