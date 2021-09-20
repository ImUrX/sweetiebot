const path = require("path");
// eslint-disable-next-line no-unused-vars
const { Base, Client } = require("discord.js");

module.exports = class Piece extends Base {

    /**
     * @type {string}
     */
    name;

    /**
     * @type {?string}
     */
    category;

    /**
     * @param {Client} client 
     * 
     */
    constructor(client, { name, category }) {
        super(client);
        this.name = name ?? path.basename(__filename);
        this.category = category;
    }

    async init() {}
};
