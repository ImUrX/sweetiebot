use std::{
    fmt::{Display, Formatter},
    io::Cursor,
    sync::Arc,
    time::Duration,
};

use anyhow::{ensure, Result};
use bytes::Bytes;
use futures::{stream::TryStreamExt, StreamExt};
use image::{imageops::FilterType, io::Reader as ImageReader};
use include_dir::{include_dir, Dir};
use lazy_static::lazy_static;

use regex::Regex;
use skia_safe::{
    scalar,
    textlayout::{FontCollection, ParagraphBuilder, TypefaceFontProvider},
    Data, Typeface,
};
use substring::Substring;
use tokio::{task, time::timeout};
use twilight_http::Client as HttpClient;
use twilight_model::{
    application::interaction::{Interaction, InteractionData},
    channel::message::{
        component::{ActionRow, Button, ButtonStyle, Component},
        embed::Embed,
    },
    http::{
        attachment::Attachment,
        interaction::{InteractionResponse, InteractionResponseType},
    },
    id::marker::ApplicationMarker,
    id::Id,
};
use twilight_standby::Standby;
use twilight_util::builder::InteractionResponseDataBuilder;

pub mod animethemes;
pub mod i18n;
pub mod saucenao;
pub mod stablediffusion;
pub mod tracemoe;
pub mod yandex;

static VALID_FONTS: &[&str] = &["ttf", "ttc", "otf"];
pub static DEFERRED_RESPONSE: InteractionResponse = InteractionResponse {
    kind: InteractionResponseType::DeferredChannelMessageWithSource,
    data: None,
};
pub static DEFERRED_COMPONENT_RESPONSE: InteractionResponse = InteractionResponse {
    kind: InteractionResponseType::DeferredUpdateMessage,
    data: None,
};
pub static SAD_EMOJIS: &[&str] = &[
    ":c",
    ":/",
    ";-;",
    "T-T",
    "（´＿｀）",
    ":<",
    "（; ;）",
    "((´д｀))",
    "sad emoji",
    r"¯\_(ツ)_/¯",
    r"\:",
    "ɔ:",
    "(╯︵╰,)",
    ">:",
    ":p",
    "q:",
    "(im out of ideas)",
    ":(",
    "😖",
];

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

pub async fn censor_image(bytes: Bytes) -> Result<Bytes> {
    task::spawn_blocking(move || {
        let img = ImageReader::new(Cursor::new(bytes))
            .with_guessed_format()?
            .decode()?;
        let ratio = img.width() / 18;
        let resize = img
            .resize(18, img.height() / ratio, FilterType::Nearest)
            .resize(img.width(), img.height(), FilterType::Nearest);
        let mut new_bytes: Vec<u8> = Vec::new();
        resize.write_to(
            &mut Cursor::new(&mut new_bytes),
            image::ImageOutputFormat::Png,
        )?;
        Ok(new_bytes.into())
    })
    .await?
}

pub async fn get_bytes(url: &str) -> Result<Bytes> {
    Ok(reqwest::get(url).await?.bytes().await?)
}

pub fn seconds_to_timestamp(seconds: u32) -> String {
    let mut vec = Vec::new();
    let hours = seconds / 3600;
    if hours > 0 {
        vec.push(format!("{:02}", hours));
    }
    let minutes = (seconds % 3600) / 60;
    if minutes > 0 {
        vec.push(format!("{:02}", minutes));
    }
    vec.push(format!("{:02}", seconds % 60));
    vec.join(":")
}

pub fn shortify(text: &str, limit: usize) -> &str {
    lazy_static! {
        static ref RE: Regex = Regex::new(r"/((?:.|\n)+?\.)( +)?\n/g").unwrap();
    }
    if limit == 0 || text.len() <= limit {
        return text;
    }

    let paragraph = if let Some(group) = RE.find(text) {
        group.as_str()
    } else {
        text
    };
    paragraph.substring(0, limit - 1)
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

    pub async fn defer_reply(
        self,
        interaction: &Interaction,
        _builder: InteractionResponseDataBuilder,
    ) -> Result<()> {
        ensure!(!self.embeds.is_empty(), "There is no embeds to send!");

        //FIXME: Copying attachments just to pass them...
        let attachments: Vec<Attachment> = self
            .attachments
            .iter()
            .take(1)
            .filter_map(|x| x.to_owned())
            .collect();
        // Just send the embed without any component
        if self.embeds.len() == 1 {
            self.http
                .interaction(self.application_id)
                .create_followup(&interaction.token)
                .embeds(&self.embeds)?
                .attachments(&attachments)?
                .await?;
            return Ok(());
        }

        self.http
            .interaction(self.application_id)
            .create_followup(&interaction.token)
            .embeds(&[self.embeds[0].clone()])?
            .attachments(&attachments)?
            .components(&[Component::ActionRow(Self::generate_row(true, false))])?
            .await?;

        let message_id = self
            .http
            .interaction(self.application_id)
            .response(&interaction.token)
            .await?
            .model()
            .await?
            .id;
        // Make stream based on the back and next buttons
        let components =
            self.standby
                .wait_for_component_stream(message_id, |event: &Interaction| {
                    if let Some(InteractionData::MessageComponent(data)) = &event.data {
                        data.custom_id == "back" || data.custom_id == "next"
                    } else {
                        false
                    }
                });

        // Try for each the stream because we need to time out of it after the specified time
        let process = components
            .map(|x| -> Result<Interaction> { Ok(x) })
            .try_for_each(|component| {
                let list = Arc::new(&self);
                let mut index = list.index.clone();
                let token = interaction.token.clone();
                async move {
                    if let Some(InteractionData::MessageComponent(data)) = component.data {
                        list.http
                            .interaction(list.application_id)
                            .create_response(
                                component.id,
                                &component.token,
                                &DEFERRED_COMPONENT_RESPONSE,
                            )
                            .await?;
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
                            index == list.embeds.len() - 1,
                        ))];
                        let embeds = &list.embeds[index..(index + 1)];
                        //FIXME: Copying attachments just to pass them...
                        let attachments: Vec<Attachment> = list.attachments[index..(index + 1)]
                            .iter()
                            .filter_map(|x| x.to_owned())
                            .collect();
                        let _update = list
                            .http
                            .interaction(list.application_id)
                            .update_response(&token)
                            .embeds(Some(embeds))?
                            .attachments(&attachments)?
                            .components(Some(&action_row))?
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
                    .components(Some(&[]))?
                    .await?;
                Ok(())
            }
            Ok(result) => result,
        }
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
            let builder = builder
                .embeds(self.embeds)
                .attachments(self.attachments.iter().filter_map(|x| x.to_owned()));
            let response = InteractionResponse {
                kind: InteractionResponseType::ChannelMessageWithSource,
                data: Some(builder.build()),
            };
            let create = client.create_response(interaction.id, &interaction.token, &response);
            create.await?;
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
            .await?;

        let message_id = self
            .http
            .interaction(self.application_id)
            .response(&interaction.token)
            .await?
            .model()
            .await?
            .id;
        // Make stream based on the back and next buttons
        let components =
            self.standby
                .wait_for_component_stream(message_id, |event: &Interaction| {
                    if let Some(InteractionData::MessageComponent(data)) = &event.data {
                        data.custom_id == "back" || data.custom_id == "next"
                    } else {
                        false
                    }
                });

        // Try for each the stream because we need to time out of it after the specified time
        let process = components
            .map(|x| -> Result<Interaction> { Ok(x) })
            .try_for_each(|component| {
                let list = Arc::new(&self);
                let mut index = list.index.clone();
                let token = interaction.token.clone();
                async move {
                    if let Some(InteractionData::MessageComponent(data)) = component.data {
                        list.http
                            .interaction(list.application_id)
                            .create_response(
                                component.id,
                                &component.token,
                                &DEFERRED_COMPONENT_RESPONSE,
                            )
                            .await?;
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
                            index == list.embeds.len() - 1,
                        ))];
                        let embeds = &list.embeds[index..(index + 1)];
                        //FIXME: Copying attachments just to pass them...
                        let attachments: Vec<Attachment> = list.attachments[index..(index + 1)]
                            .iter()
                            .filter_map(|x| x.to_owned())
                            .collect();
                        let _update = list
                            .http
                            .interaction(list.application_id)
                            .update_response(&token)
                            .embeds(Some(embeds))?
                            .attachments(&attachments)?
                            .components(Some(&action_row))?
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
                    .components(Some(&[]))?
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

pub struct DisplayOption<T: Display>(pub Option<T>);

impl<T: Display> Display for DisplayOption<T> {
    fn fmt(&self, f: &mut Formatter) -> std::fmt::Result {
        match self.0 {
            Some(ref val) => write!(f, "{}", val),
            None => write!(f, ""),
        }
    }
}
