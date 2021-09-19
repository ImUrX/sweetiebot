const { SlashCommandBuilder } = require("@discordjs/builders");
const { Interaction, Base } = require("discord.js");

module.exports = class Command extends Base {
    /**
     * @type {SlashCommandBuilder}
     */
    properties;
    
    /**
     * @param {Interaction} interaction 
     */
    async run(interaction);
    async init();
}