const Redis = require("ioredis");

module.exports = class Cache {

	constructor(options = {}) {
		this.client = options.client;
		this.fakepiece = options.piece;
		this.redis = new Redis(options.redis)
			.once("ready", () => this.client.emit("log", "Connection to redis established"))
			.on("reconnecting", () => this.client.emit("warn", "Reconnecting to redis cache"))
			.on("end", () => this.client.emit("log", "Connection to redis was closed"))
			.on("error", err => this.client.emit("error", err));
	}

	/**
	 * Gets the value with the mentioned key
	 * @param {string} key The key of the value
	 * @returns {Promise<any>}
	 */
	async get(key) {
		const data = JSON.parse(await this.redis.get(key));
		const serializer = this.client.serializers.resolve(data.type);
		return serializer.deserialize(data.value, this.fakepiece, this.client.languages.default);
	}

	/**
	 * Gets the value with the mentioned key
	 * @param {string} key The key
	 * @param {Object} data Data object that contains the type and value
	 * @param {string} data.type The type of the value (valid serializer)
	 * @param {string} data.value The value to store
	 * @param {...any} [options=["EX", 3600]] The options to apply to redis command
	 * @returns {Promise<Buffer|string>}
	 */
	async set(key, data, ...options) {
		if (!options.length) options = ["EX", 3600];
		const serializer = this.client.serializers.resolve(data.type);
		data.value = serializer.serialize(data.value);
		return this.redis.set(key, JSON.stringify(data), ...options);
	}

};
