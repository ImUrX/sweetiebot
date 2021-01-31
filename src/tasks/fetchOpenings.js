const { Task } = require("klasa");
const fetch = require("node-fetch");

module.exports = class extends Task {

	async run() {
		const oped = await fetch("https://openings.moe/api/list.php").then(res => res.json());
		return this.client.cache.set("openings", {
			type: "any",
			value: oped.map(ani => ({
				...ani,
				search: `${ani.title} ${ani.source}`
			}))
		}, [
			"EX", 3900
		]);
	}

};
