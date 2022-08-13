import { AutocompleteInteraction, ChatInputCommandInteraction, SharedNameAndDescription, SlashCommandBuilder } from "discord.js";
import Piece from "./base/Piece.js";

export default abstract class Command<T extends SharedNameAndDescription = SharedNameAndDescription> extends Piece {
    abstract properties: T extends Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup"> ? Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup"> : SharedNameAndDescription;
    abstract run(interaction: ChatInputCommandInteraction): Promise<void>;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    autocomplete(_interaction: AutocompleteInteraction): Promise<void> {
        throw TypeError("Autocomplemete isn't implemented.");
    }
}
