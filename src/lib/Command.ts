import { CommandInteraction } from "discord.js";
import Piece from "./base/Piece.js";

export default abstract class Command extends Piece {
    abstract properties: unknown; // SlashCommandBuilder has mixins and no base interface exported neither a declared json type :/
    abstract run(interaction: CommandInteraction): Promise<any>;
}
