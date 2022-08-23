use std::sync::Arc;

use twilight_http::Client;
use twilight_model::channel::{embed::Embed, message::MessageInteraction};
use twilight_http::Client as HttpClient;

pub struct EmbedList {
	pub embeds: Vec<Embed>,
	pub index: usize,
}

impl EmbedList {
	pub fn new() -> Self {
		return EmbedList {
			embeds: Vec::new(),
			index: 0
		}
	}

	pub fn add(&mut self, embed: Embed) {
		self.embeds.push(embed);
	}

	pub async fn send(mut self, interaction: MessageInteraction, http: Arc<HttpClient>) {
		
	}
}