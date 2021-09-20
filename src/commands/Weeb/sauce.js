const { SlashCommandBuilder } = require("@discordjs/builders");
// eslint-disable-next-line no-unused-vars
const { CommandInteraction, MessageEmbed } = require("discord.js");
const fetch = require("node-fetch");
const { stripIndent } = require("common-tags");
const util = require("../../util/util.js");
const Command = require("../../lib/Command");
const { saucenao } = require("../../../auth.json");

module.exports = class extends Command {
    properties = new SlashCommandBuilder()
        .setName(this.name)
        .setDescription("Searches the image's original anime with saucenao.com")
        .addStringOption(option => 
            option.setName("url")
                .setDescription("URL of the image")
                .setRequired(true)
    );

    /**
     * @param {CommandInteraction} interaction
     */
    async run(interaction) {
        const url = interaction.options.getString("url");
        try {
            new URL(url);
        } catch(e) {
            return interaction.reply({ content: `The URL isn't valid ${util.randomSadEmoji()}`, ephemeral: true });
        }

        const json = await fetch(stripIndent`
        https://saucenao.com/search.php?db=999&output_type=2&numres=5${interaction.channel.nsfw ? "" : "&hide=3"}&api_key=${saucenao}&url=${encodeURIComponent(url)}`
        ).then(res => res.json());

        if(json.header.status > 0 && !json.results.length) {
            return interaction.editReply({ content: `It seems SauceNAO is having some problems (code ${json.header.status})`, ephemeral: true });
        }
        if(json.header.status < 0) {
            if(json.header.status === -3) {
                return interaction.editReply({ content: `The URL isn't a supported image by SauceNAO ${util.randomSadEmoji()}`, ephemeral: true });
            }
            return interaction.reply({ content: `It seems someone in here did something wrong ${util.randomSadEmoji()} (code ${json.header.status})`, ephemeral: true });
        }
        await interaction.deferReply();
        return interaction.editReply("dont know");
    }
    
};
