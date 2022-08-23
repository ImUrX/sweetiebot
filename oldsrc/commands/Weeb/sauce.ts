import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { randomSadEmoji } from "../../util/util.js";
import Command from "../../lib/Command.js";
import { replyTo as naoReplyTo } from "../../util/saucenao.js";
import { replyTo as traceReplyTo } from "../../util/trace.js";
import { replyTo as yandexReplyto } from "../../util/yandex.js";

export default class SauceCommand extends Command {
	properties = new SlashCommandBuilder()
		.setName(this.name)
		.setDescription("Searches the image's original source")
		.addSubcommand(sub => 
			sub.setName("saucenao")
				.setDescription("Searches the image's source with SauceNAO")
				.addAttachmentOption(option =>
					option.setName("image")
						.setDescription("Image to reverse-lookup for")
						.setRequired(true)
				)
				.addIntegerOption(option =>
					option.setName("show")
						.setDescription("Amount of embeds to show (defaults to 1)")
						.setMinValue(1)
						.setMaxValue(2)
						.setRequired(false)
				)
		)
		.addSubcommand(sub => 
			sub.setName("tracemoe")
				.setDescription("Searches the image's source with trace.moe")
				.addAttachmentOption(option =>
					option.setName("image")
						.setDescription("Image to reverse-lookup for")
						.setRequired(true)
				)
				.addIntegerOption(option =>
					option.setName("show")
						.setDescription("Amount of embeds to show (defaults to 1)")
						.setMinValue(1)
						.setMaxValue(2)
						.setRequired(false)
				)
		)
		.addSubcommand(sub => 
			sub.setName("yandex")
				.setDescription("Searches the image's source with Yandex")
				.addAttachmentOption(option =>
					option.setName("image")
						.setDescription("Image to reverse-lookup for")
						.setRequired(true)
				)
				.addIntegerOption(option =>
					option.setName("show")
						.setDescription("Amount of embeds to show (defaults to 1)")
						.setMinValue(1)
						.setMaxValue(2)
						.setRequired(false)
				)
		);

	async run(interaction: ChatInputCommandInteraction): Promise<void> {
		const url = interaction.options.getAttachment("image", true);
		const show = interaction.options.getInteger("show", false);
		if(!url.contentType?.startsWith("image")) {
			await interaction.reply({ content: `The URL isn't valid ${randomSadEmoji()}`, ephemeral: true });
			return;
		}

		switch(interaction.options.getSubcommand()) {
			case "saucenao":
				await naoReplyTo(interaction, show ?? 1, url.proxyURL, this.client);
				break;
			case "tracemoe":
				await traceReplyTo(interaction, show ?? 1, url, this.client);
				break;
			case "yandex":
				await yandexReplyto(interaction, show ?? 1, url.proxyURL, this.client);
		}
	}
}