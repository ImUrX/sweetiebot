use anyhow::{bail, Result};

use once_cell::sync::Lazy;
use rand::{seq::SliceRandom, thread_rng};
use sentry::integrations::anyhow::capture_anyhow;
use twilight_gateway::ShardId;
use twilight_interactions::command::{CommandModel, CreateCommand};
use twilight_model::{
    application::{
        command::Command,
        interaction::{InteractionData, InteractionType},
    },
    channel::message::MessageFlags,
    gateway::payload::incoming::InteractionCreate,
    http::interaction::{InteractionResponse, InteractionResponseType},
};
use twilight_util::builder::InteractionResponseDataBuilder;

use crate::{interaction::command::creativity::draw::DrawCommand, util::SAD_EMOJIS, ClusterData};

use self::command::weeb::{
    japanese::{JishoCommand, JishoCommandAutocomplete},
    op::{OpeningCommand, OpeningCommandAutocomplete},
    sauce::SauceCommand,
};

pub mod command;

pub static CREATE_COMMANDS: Lazy<Vec<Command>> = Lazy::new(|| {
    vec![
        //DrawCommand::create_command().into(),
        JishoCommand::create_command().into(),
        OpeningCommand::create_command().into(),
        SauceCommand::create_command().into(),
    ]
});

pub async fn handle_interaction(
    _shard: ShardId,
    interaction: Box<InteractionCreate>,
    info: ClusterData,
) -> Result<()> {
    if let Some(data) = &interaction.0.data {
        match data {
            InteractionData::ApplicationCommand(cmd) => match interaction.0.kind {
                InteractionType::ApplicationCommand => {
                    let command: Result<()> = try {
                        let info = info.clone();
                        match cmd.name.as_str() {
                            "japanese" => {
                                JishoCommand::from_interaction((**cmd).clone().into())?
                                    .run(info, &interaction.0)
                                    .await?
                            }
                            "op" => {
                                OpeningCommand::from_interaction((**cmd).clone().into())?
                                    .run(info, &interaction.0)
                                    .await?
                            }
                            "sauce" => {
                                let sauce = SauceCommand::from_interaction((**cmd).clone().into())?;
                                match sauce {
                                    SauceCommand::SauceNAO(saucenao) => {
                                        saucenao.run(info, &interaction.0).await?
                                    }
                                    SauceCommand::TraceMoe(trace) => {
                                        trace.run(info, &interaction.0).await?
                                    }
                                }
                            }
                            "draw" => {
                                DrawCommand::from_interaction((**cmd).clone().into())?
                                    .run(info, &interaction.0)
                                    .await?
                            }
                            _ => bail!("Unknown command interaction {}", cmd.name),
                        };
                    };

                    if let Err(e) = &command {
                        capture_anyhow(e);
                        let err_string = format!(
                            "An error occurred, it has been reported and will be fixed soon {}\n```\n{}\n```",
                            SAD_EMOJIS.choose(&mut thread_rng()).unwrap(),
                            e
                        );
                        let client = info.http.interaction(info.application_id);
                        let msg_error = client
                            .create_response(
                                interaction.0.id,
                                &interaction.0.token,
                                &InteractionResponse {
                                    kind: InteractionResponseType::ChannelMessageWithSource,
                                    data: Some(
                                        InteractionResponseDataBuilder::new()
                                            .content(err_string.clone())
                                            .flags(MessageFlags::EPHEMERAL)
                                            .build(),
                                    ),
                                },
                            )
                            .await
                            .is_err();

                        //FIXME: maybe censor sensitive data?
                        if msg_error {
                            client
                                .update_response(&interaction.0.token)
                                .attachments(&[])?
                                .components(Some(&[]))?
                                .embeds(Some(&[]))?
                                .content(Some(&err_string))?
                                .await?;
                        }
                    }

                    println!(
                        "ID: {} <#{}> by <@{}>: /{} {:?}",
                        interaction.0.id,
                        interaction.0.channel.as_ref().unwrap().id,
                        interaction.0.author_id().unwrap(),
                        cmd.name,
                        cmd.options
                    );
                    command?
                }
                InteractionType::ApplicationCommandAutocomplete => {
                    match cmd.name.as_str() {
                        "japanese" => {
                            JishoCommandAutocomplete::from_interaction((**cmd).clone().into())?
                                .run(info, &interaction.0)
                                .await?
                        }
                        "op" => {
                            OpeningCommandAutocomplete::from_interaction((**cmd).clone().into())?
                                .run(info, &interaction.0)
                                .await?
                        }
                        _ => bail!("Unknown command autocomplete {}", cmd.name),
                    };
                }
                _ => {}
            },
            _ => {}
        }
    } else {
        match interaction.0.kind {
            _ => {}
        }
    }

    Ok(())
}
