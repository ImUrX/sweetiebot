const { Finalizer } = require("klasa");

module.exports = class extends Finalizer {

	run(msg, cmd, res) {
		if(!cmd.cache) return;
		if(!res.type || !res.value) return;
		this.client.cache.set(`${cmd.name}_${msg.params.join("_")}`, res, "EX", cmd.cacheTime * 60, "NX");
	}

};
