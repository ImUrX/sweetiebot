import { Intents } from "discord.js";
import Client from "./lib/SweetieClient.js";
import auth from "../auth.json";

const client = new Client({
    intents: [Intents.FLAGS.GUILDS]
});

client.once("ready", () => {
    console.log("Client is ready");
});

client.login(auth.discord.token, auth.discord.applicationId);
