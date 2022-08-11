import { GatewayIntentBits } from "discord.js";
import fs from "fs/promises";
import path from "path";
import canvas from "canvas";
import Client from "./lib/SweetieClient.js";
import auth from "../auth.json";
const validFontTypes = [
    ".ttc", ".ttf", ".otf"
];


const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

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
                const info = file.split("-");
                canvas.registerFont(path.join(fontsFolder, dir, file), {
                    family: dir,
                    weight: info[1] || "regular",
                    style: info[2] || "regular"
                });
            }
        }));
    }

    await Promise.all(promises);
}
