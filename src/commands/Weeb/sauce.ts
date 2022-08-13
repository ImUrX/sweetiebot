import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { randomSadEmoji } from "../../util/util.js";
import Command from "../../lib/Command.js";
import { replyTo as naoReplyTo } from "../../util/saucenao.js";

export default class SauceCommand extends Command {
	properties = new SlashCommandBuilder()
		.setName(this.name)
		.setDescription("Searches the image's original anime with saucenao.com")
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
		);

	async run(interaction: ChatInputCommandInteraction): Promise<void> {
		const url = interaction.options.getAttachment("image", true);
		const show = interaction.options.getInteger("show", false);
		if(!url.contentType?.startsWith("image")) {
			interaction.reply({ content: `The URL isn't valid ${randomSadEmoji()}`, ephemeral: true });
			return;
		}
		await naoReplyTo(interaction, show ?? 1, url.proxyURL, this.client);
	}
}
