use std::{sync::Arc, time::Duration};

use anyhow::{ensure, Result};
use futures::{stream::TryStreamExt, StreamExt};
use tokio::time::timeout;
use twilight_http::Client as HttpClient;
use twilight_model::{
    application::{
        component::{button::ButtonStyle, ActionRow, Button, Component},
        interaction::{Interaction, InteractionData},
    },
    channel::embed::Embed,
    http::interaction::{InteractionResponse, InteractionResponseType},
    id::marker::ApplicationMarker,
    id::Id,
};
use twilight_standby::Standby;
use twilight_util::builder::InteractionResponseDataBuilder;

pub struct EmbedList {
    pub embeds: Vec<Embed>,
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
        return EmbedList {
            embeds: Vec::new(),
            index: Arc::new(0),
            duration: 70,
            http,
            application_id,
            standby,
        };
    }

    pub fn add(&mut self, embed: Embed) {
        self.embeds.push(embed);
    }

    pub async fn reply(
        self,
        interaction: Interaction,
        builder: InteractionResponseDataBuilder,
    ) -> Result<()> {
        ensure!(self.embeds.len() == 0, "There is no embeds to send!");

        // Just send the embed without any component
        if self.embeds.len() == 1 {
            let client = self.http.interaction(self.application_id);
            let builder = builder.embeds(self.embeds);
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

        // Make stream based on the back and next buttons
        let components = self.standby.wait_for_component_stream(
            interaction
                .message
                .expect("The interaction should be a message!")
                .id,
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
                        let index = match &*data.custom_id {
                            "next" => {
                                *Arc::get_mut(&mut index).unwrap() += 1;
                                *index
                            }
                            "back" => {
                                *Arc::get_mut(&mut index).unwrap() -= 1;
                                *index
                            }
                            _ => panic!("unhandled custom id!"),
                        };
                        let action_row = [Component::ActionRow(Self::generate_row(
                            index <= 0,
                            index >= list.embeds.len(),
                        ))];
                        let embeds = &list.embeds[index..(index + 1)];
                        let _update = list
                            .http
                            .interaction(list.application_id)
                            .update_response(&token)
                            .embeds(Some(embeds))?
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
