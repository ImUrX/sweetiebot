const { Command } = require("klasa");
const { util: { regExpEsc } } = require("klasa");
const util = require("../../lib/util/util");

module.exports = class extends Command {

	constructor(...args) {
		super(...args, {
			cooldown: 10,
			aliases: ["ending", "op", "ed"],
			description: "Searches for the anime opening/ending",
			usage: "<anime:str>",
			extendedHelp: `Flags:
	--no: Disables embed response`
		});
	}

	async run(msg, [anime]) {
		let oped = await this.client.cache.get("openings");
		const searchParam = anime.split(" ").map(val => {
			const extra = val.toLowerCase() === "ed" ? "|ending" : "";
			return new RegExp(regExpEsc(val) + extra, "i");
		});
		searchParam.push(msg.commandText.toLowerCase().includes("op") ? /opening/i : /ending/i);
		oped = oped.filter(ani => {
			let ret = true;
			for(const regExp of searchParam) {
				ret = ret && regExp.test(ani.search);
				if(!ret) break;
			}
			return ret;
		});

		if(!oped.length) return msg.send(`No anime found ${util.randomSadEmoji()}`);
		const video = `https://openings.moe/?video=${oped[0].file}`;
		return msg.send(msg.flagArgs.no ? `<${video}>` : video);
	}

	async init() {
		if(!this.client.schedule.tasks.some(task => task.taskName === "fetchOpenings")) {
			this.client.schedule.create("fetchOpenings", "0 * * * *");
		}
		return this.client.tasks.get("fetchOpenings").run();
	}

};
