/* eslint-disable no-unused-vars */
const { Command, util, KlasaMessage } = require("klasa");
const SweetieClient = require("../SweetieClient");
/* eslint-enable no-unused-vars */

module.exports = class SweetieCommand extends Command {

	constructor(store, file, dir, options = {}) {
		super(store, file, dir, options);
		/**
		 * @type {SweetieClient}
		 */
		// eslint-disable-next-line no-unused-expressions
		this.client;
		/**
		 * If the command should be cached when executed
		 * @type {boolean}
		 */
		this.cache = options.cache || false;
		/**
		 * The amount of minutes the command should be cached
		 * @type {Number}
		 */
		this.cacheTime = options.cacheTime || 60;
	}

	/**
	 * Ran when a command is already cached
	 * @param {KlasaMessage} msg The command's executor
	 * @param {any} return What the cached command returned
	 * @param {any[]} args The arguments of the command
	 * @returns {Promise<any>}
	 * @abstract
	 */
	async cacheRun() {
		throw "This is an abstract method :P";
	}

};
