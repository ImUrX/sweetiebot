/* eslint-disable no-unused-vars */
const { SlashCommandBuilder } = require("@discordjs/builders");
const { Interaction } = require("discord.js");
const Piece = require("./base/Piece.js");

/**
 * @abstract
 */
module.exports = class Command extends Piece {
    /**
     * @type {SlashCommandBuilder}
     */
    properties;
    
    /**
     * @abstract
     * @param {Interaction} interaction
     * @returns {void}
     */
    async run(interaction) { }
};
