use anyhow::{bail, Result};

use once_cell::sync::Lazy;
use twilight_interactions::command::{CommandModel, CreateCommand};
use twilight_model::{
    application::{
        command::Command,
        interaction::{InteractionData, InteractionType},
    },
    gateway::payload::incoming::InteractionCreate,
};

use crate::ClusterData;

use self::command::weeb::{
    japanese::{JishoCommand, JishoCommandAutocomplete},
    op::{OpeningCommand, OpeningCommandAutocomplete},
    sauce::SauceCommand,
};

pub mod command;

pub static CREATE_COMMANDS: Lazy<Vec<Command>> = Lazy::new(|| {
    vec![
        JishoCommand::create_command().into(),
        OpeningCommand::create_command().into(),
        SauceCommand::create_command().into(),
    ]
});

pub async fn handle_interaction(
    _shard_id: u64,
    interaction: Box<InteractionCreate>,
    info: ClusterData,
) -> Result<()> {
    if let Some(data) = &interaction.0.data {
        match data {
            InteractionData::ApplicationCommand(cmd) => match interaction.0.kind {
                InteractionType::ApplicationCommand => {
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
                        _ => bail!("Unknown command interaction {}", cmd.name),
                    };
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
