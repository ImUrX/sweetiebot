const fs = require("fs/promises");
const path = require("path");
// eslint-disable-next-line no-unused-vars
const { Collection, Base, Client } = require("discord.js");
// eslint-disable-next-line no-unused-vars
const Piece = require("./Piece.js");

/**
 * @template T
 */
module.exports = class Store extends Base {

    /**
     * @type {string}
     */
    #dirPath;

    /**
     * @type {typeof T}
     */
    #type;

    /**
     * @type {Collection<string, T>}
     */
    collection;

    /**
     * @param {Client} client
     * @param {string} dirPath
     * @param {typeof T} type 
     * @param {boolean} categorized
     */
    constructor(client, dirPath, type, categorized = false) {
        super(client);
        this.#dirPath = dirPath;
        this.#type = type;
        this.categorized = categorized;
        this.collection = new Collection();
    }

    async init(dirPath = this.#dirPath) {
        const files = await fs.readdir(path.join(require.main.path, dirPath), { withFileTypes: true });
        for(const file of files) {
            if(file.isDirectory()) {
                await this.init(path.join(dirPath, file.name));
                continue;
            }
            if(!file.name.endsWith(".js")) continue;
            /**
             * @type {typeof Piece}
             */
            const PieceType = require(path.join(require.main.path, dirPath, file.name));
            const piece = new PieceType(this.client, {
                name: file.name.slice(0, -3),
                category: this.categorized ? path.dirname(path.join(dirPath, file.name)).split(path.sep).at(-1) : null
            });
            if(!(piece instanceof this.#type)) throw `${file.name} doesn't extend ${this.#type.name}`;
            this.collection.set(piece.name, piece);
            await piece.init();
        }
    }
};
