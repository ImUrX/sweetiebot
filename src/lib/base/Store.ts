import fs from "fs/promises";
import path from "path";
import { Collection, Base, Client } from "discord.js";
import Piece, { PieceOptions } from "./Piece.js";

export default class Store<T extends Piece> extends Base {
    #dirPath: string;
    collection: Collection<string, T>;
    categorized: boolean;

    constructor(client: Client, dirPath: string, categorized = false) {
        super(client);
        this.#dirPath = dirPath;
        this.categorized = categorized;
        this.collection = new Collection();
    }

    async init(dirPath = this.#dirPath): Promise<void> {
        const mainDir = path.dirname(process.argv[1]); // import.meta.main when node?
        const files = await fs.readdir(path.join(mainDir, dirPath), { withFileTypes: true });

        for(const file of files) {
            if(file.isDirectory()) {
                await this.init(path.join(dirPath, file.name));
                continue;
            }
            if(!file.name.endsWith(".js")) continue;

            const PieceType: new (client: Client, options: PieceOptions) => T = (await import(path.join(mainDir, dirPath, file.name))).default;
            const piece = new PieceType(this.client, {
                name: file.name.slice(0, -3),
                category: this.categorized ? path.dirname(path.join(dirPath, file.name)).split(path.sep).at(-1) : undefined
            });

            this.collection.set(piece.name, piece);
            await piece.init();
        }
    }
}
