const { Client, util } = require("klasa");
const Cache = require("./structures/Cache");

module.exports = class SweetieClient extends Client {

	constructor(options = {}) {
		options = util.mergeDefault({ cache: {
			// eslint-disable-next-line camelcase
			redis: {},
			piece: { type: "cache" }
		} }, options);
		super(options);
		this.cache = new Cache({ ...options.cache, client: this });
	}

};
