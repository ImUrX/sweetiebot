/* eslint-disable no-unused-vars */
import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import Piece from "./base/Piece";

export default abstract class Command extends Piece {
    abstract properties: SlashCommandBuilder;
    abstract run(interaction: CommandInteraction): Promise<unknown>;
}
