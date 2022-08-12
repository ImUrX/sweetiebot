import { ChatInputCommandInteraction, SharedNameAndDescription, SlashCommandBuilder } from "discord.js";
import Piece from "./base/Piece.js";

export default abstract class Command<T extends SharedNameAndDescription = SharedNameAndDescription> extends Piece {
    abstract properties: T extends Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup"> ? Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup"> : SharedNameAndDescription;
    abstract run(interaction: ChatInputCommandInteraction): Promise<unknown>;
}
