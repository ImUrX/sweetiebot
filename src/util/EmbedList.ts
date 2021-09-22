import { MessageActionRow, MessageButton, BaseCommandInteraction, MessageEmbed, InteractionReplyOptions } from "discord.js";

export default class EmbedList {
    embeds: MessageEmbed[] = [];
    actionRow = new MessageActionRow();
    index = 0;
    options: EmbedListOptions = {
        time: 15000,
        addFooter: true
    };
    constructor(options?: EmbedListOptions) {
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
        
        this.options = {
            ...this.options,
            ...options
        };
    }

    add(...embeds: MessageEmbed[]): void {
        this.embeds.push(...embeds);
    }

    async send(
        interaction: BaseCommandInteraction,
        interactionOptions: InteractionReplyOptions & { fetchReply: true } = { fetchReply: true }
        ): Promise<unknown> {
        if(this.embeds.length > 1) {
            this.actionRow.components[1].setDisabled(false);
        }
        if(this.options.addFooter) {
            this.embeds.forEach((x, i) => x.setFooter(`${i+1}/${this.embeds.length}`));
        }

        const msg = await interaction[interaction.deferred ? "editReply" : "reply"]({ embeds: [this.embeds[this.index]], components: [this.actionRow], ...interactionOptions });
        if(!interaction.channel) throw new TypeError("There is no channel in the interaction");
        const collector = interaction.channel.createMessageComponentCollector({
            filter: i => i.message.id === msg.id && ["back", "next"].includes(i.customId) && i.user.id === interaction.user.id,
            time: this.options.time,
            componentType: "BUTTON"
        });

        collector.on("collect", async i => {
            if(i.customId === "next") {
                this.index++;
                if(this.index >= this.embeds.length - 1) this.actionRow.components[1].setDisabled(true);
                if(this.index > 0) this.actionRow.components[0].setDisabled(false);
            } else if(i.customId === "back") {
                this.index--;
                if(this.index < this.embeds.length) this.actionRow.components[1].setDisabled(false);
                if(this.index <= 0) this.actionRow.components[0].setDisabled(true);
            }
            await i.update({ embeds: [this.embeds[this.index]], components: [this.actionRow] });
        });

        collector.on("end", async () => {
            await interaction.editReply({ components: [] });
        });
        return msg;
    }
}

export type EmbedListOptions = {
    time?: number,
    addFooter?: boolean
}
