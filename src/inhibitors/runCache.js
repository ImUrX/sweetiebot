const { Inhibitor } = require("klasa");

module.exports = class extends Inhibitor {

	async run(msg, cmd) {
		if (!cmd.cache) return false;

		await msg.prompter.run();
		const key = `${cmd.name}_${msg.params.join("_")}`;
		if (!await this.client.cache.redis.exists(key)) return false;

		const cachedRes = await this.client.cache.get(key);
		cmd.cacheRun(msg, cachedRes, msg.params);
		return true;
	}

};
