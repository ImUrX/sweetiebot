import { CommandInteraction, SharedNameAndDescription, SharedSlashCommandOptions, SlashCommandOptionsOnlyBuilder } from "discord.js";
import Piece from "./base/Piece.js";

export default abstract class Command extends Piece {
    abstract properties: SharedNameAndDescription;
    abstract run(interaction: CommandInteraction): Promise<unknown>;
}
