const Client = require("./lib/SweetieClient");
const config = require("../config");
const auth = require("../auth.json");

const client = new Client(config.client);

client.login(auth.discord);
