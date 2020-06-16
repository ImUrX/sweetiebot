const { Extendable, RichDisplay } = require("klasa");

module.exports = class extends Extendable {

	constructor(...args) {
		super(...args, { appliesTo: [RichDisplay] });
	}

	/**
	 * Add all those pages
	 * @param {...MessageEmbed} pages The pages you want to add
	 * @returns {RichDisplay}
	 */
	addPages(...pages) {
		for (const page of pages) {
			this.addPage(page);
		}
		return this;
	}

};
