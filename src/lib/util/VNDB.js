const EventEmitter = require("events");
const tls = require("tls");

const api = {
	host: "api.vndb.org",
	port: 19535
};

module.exports = class VNDB extends EventEmitter {

	/**
	 * A class that makes VNDB API kind of simpler
	 * @param {string} clientName the name of the client (will be given to VNDB)
	 */
	constructor(clientName) {
		super();

		/**
         * The connection used for DB
         * @type {TLSSocket}
         */
		this.connection = tls.connect(api);
		this.connection.setEncoding("utf8");
		this.connection.setKeepAlive(true);

		/**
		 * The client name
		 * @type {string}
		 */
		this.client = clientName;
		/**
		 * Boolean for knowing if its logged
		 * @type {boolean}
		 */
		this.logged = false;

		let currentData = "";
		this.connection.on("data", res => {
			currentData += res;
			if (res.endsWith("\x04")) {
				this.emit("data", currentData.slice());
				currentData = "";
			}
		});
	}

	/**
	 * For logging to VNDB's API
	 * @param {Object=} login The object containing auth info
	 * @param {string} login.user The user to auth as
	 * @param {string} login.password The password to auth with
	 * @returns {Promise<null>}
	 */
	login({ user, password } = {}) {
		return new Promise((res, rej) => {
			const log = {
				protocol: 1,
				client: this.client,
				clientver: 0.01
			};
			if (user && password) {
				log.user = user;
				log.password = password;
			}
			this.connection.write(`login ${JSON.stringify(log)}\x04`);
			this.once("data", str => {
				if (str.includes("ok\x04")) {
					this.logged = true;
					this.emit("login");
					res();
				} else {
					rej(str);
				}
			});
		});
	}

	/**
	 * Gets you the current stats of VNDB
	 * @returns {Promise<Object>}
	 */
	dbstats() {
		return new Promise((res, rej) => {
			this.connection.write("dbstats\x04");
			this.once("data", str => {
				if (str.includes("dbstats")) {
					const data = JSON.parse(str.replace("dbstats", "").replace("\x04", ""));
					this.emit("dbstats", data);
					res(data);
				} else {
					rej(str);
				}
			});
		});
	}

	/**
	 * Gets you info from the VNDB
	 * @param {"vn"|"release"|"producer"|"character"|"staff"|"user"|"votelist"|"vnlist"|"wishlist"|"ulist-labels"|"ulist"} type Type of info to get
	 * @param {string[]} flags Subkind of data to return
	 * @param {string} filter An special kind of string that has its own language for filtering
	 * @param {Object} options Influences the behaviour of the results -VNDB's API doc
	 * @param {number} options.page used for pagination
	 * @param {number} options.results number of results
	 * @param {string} options.sort the field to sort by (not all fields can be used for that)
	 * @returns {Promise<Object>}
	 */
	get(type, flags, filter, options) {
		return new Promise((res, rej) => {
			this.connection.write(`get ${type} ${flags.join(",")} ${filter}${options ? ` ${JSON.stringify(options)}` : ""}\x04`);
			this.once("data", str => {
				if (str.includes("results")) {
					const data = JSON.parse(str.replace("results", "").replace("\x04", ""));
					this.emit("get", data, type, flags, filter, options);
					res(data);
				} else {
					rej(str);
				}
			});
		});
	}

	end() {
		this.connection.end();
		this.logged = false;
	}

};
