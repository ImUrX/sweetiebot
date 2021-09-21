import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction, MessageEmbed, MessageActionRow, MessageButton } from "discord.js";
import fetch from "node-fetch";
import { stripIndent } from "common-tags";
import { randomSadEmoji } from "../../util/util.js";
import Command from "../../lib/Command";
import { saucenao } from "../../../auth.json";

export default class SauceCommand extends Command {
    properties = new SlashCommandBuilder()
        .setName(this.name)
        .setDescription("Searches the image's original anime with saucenao.com")
        .addStringOption(option => 
            option.setName("url")
                .setDescription("URL of the image")
                .setRequired(true)
    );

    async run(interaction: CommandInteraction): Promise<unknown> {
        const url = interaction.options.getString("url", true);
        try {
            new URL(url);
        } catch(e) {
            return interaction.reply({ content: `The URL isn't valid ${randomSadEmoji()}`, ephemeral: true });
        }

        const json = await fetch(stripIndent`
        https://saucenao.com/search.php?db=999&output_type=2&numres=5${interaction.channel.nsfw ? "" : "&hide=3"}&api_key=${saucenao}&url=${encodeURIComponent(url)}`
        ).then(res => res.json() as Promise<SauceNAOData>);

        if(json.header.status > 0 && !json.results.length) {
            return interaction.reply({ content: `It seems SauceNAO is having some problems (code ${json.header.status})`, ephemeral: true });
        }
        if(json.header.status < 0) {
            if(json.header.status === -3) {
                return interaction.reply({ content: `The URL isn't a supported image by SauceNAO ${randomSadEmoji()}`, ephemeral: true });
            }
            return interaction.reply({ content: `It seems someone in here did something wrong ${randomSadEmoji()} (code ${json.header.status})`, ephemeral: true });
        }
        await interaction.deferReply();
        
    }
    
}

export type SauceNAOData = {
    header: {
        status: number
    },
    results: {
        
    }[]
}
