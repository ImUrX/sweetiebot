use anyhow::{Result, bail};
use twilight_gateway::Event;
use twilight_interactions::command::{ApplicationCommandData, CreateCommand, CommandModel};
use twilight_model::{application::interaction::{InteractionType, InteractionData, application_command::CommandData}, gateway::payload::incoming::InteractionCreate};

use crate::ClusterData;

use self::command::weeb::japanese::JishoCommand;

pub mod command;
pub async fn handle_interaction(_shard_id: u64, interaction: Box<InteractionCreate>, info: ClusterData) -> Result<()> {
	if let Some(data) = &interaction.0.data {
		match data {
			InteractionData::ApplicationCommand(cmd) => {
				match interaction.0.kind {
					InteractionType::ApplicationCommand => {
						match cmd.name.as_str() {
							"japanese" => JishoCommand::from_interaction((**cmd).clone().into())?.run(info, &interaction.0).await?,
							_ => bail!("Unknown command interaction {}", cmd.name), 
						};
					},
					_ => {}
				}
			}
			_ => {}
		}
	} else {
		match interaction.0.kind {
			_ => {}
		}
	}

	Ok(())
}