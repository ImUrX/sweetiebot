use std::{
    error::Error,
    io,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    },
    time::Duration,
};

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
    pub index: Arc<AtomicUsize>,
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
            index: Arc::new(AtomicUsize::new(0)),
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
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
        if self.embeds.len() == 0 {
            return Err(Box::new(io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "There is no embeds to send!",
            )));
        }

        let client = Arc::new(self.http.interaction(self.application_id));
        // Just send the embed without any component
        if self.embeds.len() == 1 {
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
        client
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
            .map(|x| -> Result<Interaction, Box<dyn Error + Send + Sync>> { Ok(x) })
            .try_for_each(|component| {
                let client = client.clone();
                let atomic = self.index.clone();
                let embeds = self.embeds.clone();
                let token = interaction.token.clone();
                async move {
                    if let Some(InteractionData::MessageComponent(data)) = component.data {
                        let index = match &*data.custom_id {
                            "next" => atomic.fetch_add(1, Ordering::Release) + 1,
                            "back" => atomic.fetch_sub(1, Ordering::Release) - 1,
                            _ => panic!("unhandled custom id!"),
                        };
                        let action_row = [Component::ActionRow(Self::generate_row(
                            index <= 0,
                            index >= embeds.len(),
                        ))];
                        let embeds = &embeds[index..(index + 1)];
                        let update = client
                            .update_response(&token)
                            .embeds(Some(embeds))?
                            .components(Some(&action_row))?;
                        update.exec().await?;
                    }
                    Ok(())
                }
            });

        // Clear all components when timeout runs out
        match timeout(Duration::from_secs(self.duration), process).await {
            Err(_) => {
                let update = client
                    .update_response(&interaction.token)
                    .components(None)?;
                update.exec().await?;
                Ok(())
            }
            Ok(result) => Ok(result?)
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
