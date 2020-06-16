const { Serializer, RichDisplay } = require("klasa");
const { MessageEmbed } = require("discord.js");

module.exports = class extends Serializer {

	deserialize(data) {
		if (data instanceof RichDisplay) return data;
		const obj = JSON.parse(data), display = new RichDisplay();
		obj.pages = obj.pages.map(json => new MessageEmbed(json));
		return Object.assign(display, obj);
	}

	serialize(data) {
		return JSON.stringify({
			pages: data.pages.map(page => page.toJSON()),
			footered: data.footered,
			footerPrefix: data.footerPrefix,
			footerSuffix: data.footerSuffix,
			embedTemplate: data.embedTemplate,
			infoPage: data.infoPage,
			emojis: data.emojis
		});
	}

};
