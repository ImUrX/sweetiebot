import { MessageActionRow, MessageButton, BaseCommandInteraction, MessageEmbed, InteractionReplyOptions, CollectorFilter, MessageComponentInteraction } from "discord.js";

export default class EmbedList {
    embeds: MessageEmbed[] = [];
    actionRow = new MessageActionRow();
    constructor() {
        this.actionRow.addComponents(
            new MessageButton()
                .setCustomId("back")
                .setLabel("< Prev.")
                .setStyle("SECONDARY")
                .setDisabled(true),
            new MessageButton()
                .setCustomId("next")
                .setLabel("Next >")
                .setStyle("SECONDARY")
                .setDisabled(true)
        );
    }

    add(...embeds: MessageEmbed[]): void {
        this.embeds.push(...embeds);
    }

    async send(interaction: BaseCommandInteraction, options: InteractionReplyOptions & { fetchReply: true } = { fetchReply: true }): Promise<unknown> {
        if(this.embeds.length > 1) {
            this.actionRow.components[1].setDisabled(false);
        }

        const msg = await interaction.reply({ embeds: [this.embeds[0]], components: [this.actionRow], ...options });
        if(!interaction.channel) throw new TypeError("There is no channel in the interaction");
        const collector = interaction.channel.createMessageComponentCollector({
            filter: i => i.message.id === msg.id && ["back", "next"].includes(i.customId) && i.user.id === interaction.user.id,
            time: 30000
        });
        collector.on("collect", async i => {

        });
    }
}
