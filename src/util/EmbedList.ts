import { ActionRowBuilder, ButtonBuilder, CommandInteraction, ButtonStyle, EmbedBuilder, InteractionReplyOptions, ComponentType, AttachmentBuilder } from "discord.js";

export default class EmbedList {
	embeds: EmbedBuilder[] = [];
	#attachments: AttachmentBuilder[][] = [];
	#memoize: (() => AttachmentBuilder[])[] = [];
	actionRow = new ActionRowBuilder<ButtonBuilder>();
	index = 0;
	options = {
		time: 7000,
		addFooter: true,
		displayAmount: 1
	};
	constructor(options?: EmbedListOptions) {
		this.actionRow.addComponents(
			new ButtonBuilder()
				.setCustomId("back")
				.setLabel("< Prev.")
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(true),
			new ButtonBuilder()
				.setCustomId("next")
				.setLabel("Next >")
				.setStyle(ButtonStyle.Secondary)
				.setDisabled(true)
		);
		
		this.options = {
			...this.options,
			...options
		};
	}

	add(...embeds: EmbedBuilder[]): void {
		this.embeds.push(...embeds);
		this.#attachments.push(...Array(embeds.length).fill([]));
	}

	addWithAttachment(...data: [EmbedBuilder, AttachmentBuilder[]][]) {
		for(const tuple of data) {
			this.embeds.push(tuple[0]);
			this.#attachments.push(tuple[1]);
		}
	}

	addWithMemoize(...data: [EmbedBuilder, () => AttachmentBuilder[]][]) {
		for(const tuple of data) {
			this.#memoize[this.embeds.length] = tuple[1];
			this.embeds.push(tuple[0]);
		}
	}

	getAttachment(i: number): AttachmentBuilder[] {
		if(this.#attachments[i]) return this.#attachments[i];
		const memo = this.#memoize[i];
		if(!memo) return [];
		this.#attachments[i] = memo();
		return this.#attachments[i];
	}

	getAttachmentRange(start: number, end: number): AttachmentBuilder[] {
		const attachments = [];
		for(let i = start; i < end; i++) {
			attachments.push(this.getAttachment(i));
		}
		return attachments.flat();
	}

	async send(
		interaction: CommandInteraction,
		interactionOptions: InteractionReplyOptions & { fetchReply: boolean } = { fetchReply: true }
		): Promise<unknown> {
		if(this.embeds.length > 1) {
			this.actionRow.components[1].setDisabled(false);
		}
		if(this.options.addFooter) {
			this.embeds.forEach((x, i) => x.setFooter({ text: `${i+1}/${this.embeds.length}` }));
		}
		const msg = await interaction[interaction.deferred ? "editReply" : "reply"]({
			embeds: this.embeds.slice(this.index, this.index + this.options.displayAmount),
			files: this.getAttachmentRange(this.index, this.index + this.options.displayAmount),
			components: [this.actionRow],
			...interactionOptions
		});
		if(!interaction.channel && !interaction.user.dmChannel) throw new TypeError("There is no channel in the interaction");
		const collector = (interaction.channel ?? interaction.user.dmChannel!).createMessageComponentCollector({
			filter: i => i.message.id === msg.id && ["back", "next"].includes(i.customId) && i.user.id === interaction.user.id,
			time: (this.options.time || 0) * this.embeds.length,
			componentType: ComponentType.Button
		});

		collector.on("collect", async i => {
			if(i.customId === "next") {
				this.index++;
				if(this.index + this.options.displayAmount - 1 >= this.embeds.length - 1) this.actionRow.components[1].setDisabled(true);
				if(this.index + this.options.displayAmount - 1 > 0) this.actionRow.components[0].setDisabled(false);
			} else if(i.customId === "back") {
				this.index--;
				if(this.index < this.embeds.length) this.actionRow.components[1].setDisabled(false);
				if(this.index <= 0) this.actionRow.components[0].setDisabled(true);
			}
			await i.update({
				embeds: this.embeds.slice(this.index, this.index + this.options.displayAmount),
				files: this.getAttachmentRange(this.index, this.index + this.options.displayAmount),
				components: [this.actionRow]
			});
		});

		collector.on("end", async () => {
			await interaction.editReply({ components: [] });
		});
		return msg;
	}
}

export type EmbedListOptions = {
	time?: number,
	addFooter?: boolean,
	displayAmount?: number
}
