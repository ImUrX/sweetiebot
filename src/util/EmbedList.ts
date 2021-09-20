import { MessageActionRow, MessageButton, Interaction, MessageEmbed } from "discord.js";
module.exports = class EmbedList {
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
        );
    }

    add(...embeds: MessageEmbed[]) {
        this.embeds.push(...embeds);
    }
};