const { Serializer } = require("klasa");
const { MessageEmbed } = require("discord.js");

module.exports = class extends Serializer {

	constructor(...args) {
		super(...args, {
			aliases: ["embed"]
		});
	}

	deserialize(data) {
		if (data instanceof MessageEmbed) return data;
		return new MessageEmbed(JSON.parse(data));
	}

	serialize(data) {
		return JSON.stringify(data.toJSON());
	}

};
