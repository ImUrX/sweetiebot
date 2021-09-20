const { Intents } = require("discord.js");
const Client = require("./lib/SweetieClient");
const { discord } = require("../auth.json");

const client = new Client({
    intents: [Intents.FLAGS.GUILDS]
});

client.once("ready", () => {
    console.log("Client is ready");
});

client.login(discord.token, discord.applicationId);
