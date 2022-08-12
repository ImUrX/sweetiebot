import { GatewayIntentBits } from "discord.js";
import fs from "fs/promises";
import path from "path";
import Client from "./lib/SweetieClient.js";
import auth from "../auth.json" assert { type: "json" };
import { GlobalFonts } from "@napi-rs/canvas";
const validFontTypes = [
    ".ttc", ".ttf", ".otf"
];


const client = new Client({
    intents: [GatewayIntentBits.Guilds]
}, auth.discord.imageCacheChannel);

client.once("ready", () => {
    console.log("Client is ready");
});

await loadFonts();
client.login(auth.discord.token, auth.discord.applicationId);


async function loadFonts() {
    const fontsFolder = path.join(path.dirname(process.argv[1]), "/../../assets/fonts");
    try {
        await fs.access(fontsFolder);
    } catch(e) {
        return console.error("Fonts folder doesn't exist, canvas images won't have stylized font and maybe even have missing glyphs. Run \"npm run getFonts\" for getting missing fonts");
    }

    const dirs = await fs.readdir(fontsFolder), promises = [];
    for(const dir of dirs) {
        promises.push(fs.readdir(path.join(fontsFolder, dir)).then(files => {
            for(const file of files) {
                if(!validFontTypes.includes(path.extname(file))) continue;
                GlobalFonts.registerFromPath(path.join(fontsFolder, dir, file), dir);
            }
        }));
    }

    await Promise.all(promises);
}
