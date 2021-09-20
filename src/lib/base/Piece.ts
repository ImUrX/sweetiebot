import path from "path";
import { Client, Base } from "discord.js";

export type PieceOptions = {
    name: string | null;
    category?: string;
}

export default abstract class Piece extends Base {
    name: string;
    category?: string;

    constructor(client: Client, { name, category }: PieceOptions) {
        super(client);
        this.name = name ?? path.basename(__filename);
        this.category = category;
    }

    abstract init(): Promise<unknown>;
}
