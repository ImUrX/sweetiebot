const { Extendable } = require("klasa");
const { Permissions: { FLAGS }, DMChannel, TextChannel } = require("discord.js");

module.exports = class extends Extendable {

	constructor(...args) {
		super(...args, { appliesTo: [DMChannel, TextChannel] });
	}

	get removeable() {
		return !!this.guild && this.permissionsFor(this.guild.me).has(FLAGS.MANAGE_MESSAGES);
	}

	get reactionable() {
		return !this.guild || this.permissionsFor(this.guild.me).has(FLAGS.ADD_REACTIONS);
	}

	get enrichable() {
		return this.reactionable && this.removeable && this.embedable;
	}

};
