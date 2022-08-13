import { AttachmentBuilder, Client, ClientOptions } from "discord.js";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import Store from "./base/Store.js";
import Command from"./Command.js";
import { censorTokens, getBuffer, randomSadEmoji } from "../util/util.js";

export default class SweetieClient extends Client {
    #commands: Store<Command> = new Store(this, "./commands/", true);
    #rest = new REST({ version: "10" });
    imageCacheChannel: string;

    constructor(options: ClientOptions, imageCacheChannel: string) {
        super(options);
        this.imageCacheChannel = imageCacheChannel;

        this.on("interactionCreate", async interaction => {
            // missing support for modals, subcommands and context menus
            if(interaction.isChatInputCommand()) {
                const command = this.#commands.collection.get(interaction.commandName);
                if(!command) return;
                try {
                    await command.run(interaction);
                } catch (error) {
                    console.error(error);
                    let message: string | null = null;
                    if(error instanceof Error) {
                        message = censorTokens(error.message);
                    } else if (typeof error === "string") {
                        message = censorTokens(error);
                    }
                    await interaction[interaction.deferred ? "editReply" : "reply"]({ content: (message ?? "There was an error while executing this command!") + " " + randomSadEmoji(), ephemeral: true });
                } 
            } else if(interaction.isAutocomplete()) {
                const command = this.#commands.collection.get(interaction.commandName);
                if(!command) return;
                try {
                    await command.autocomplete(interaction);
                } catch (error) {
                    console.error(error);                
                }
            }
        });
    }

    async login(token: string, applicationId = ""): Promise<string> {
        await this.#commands.init();
        await this.#rest
            .setToken(token)
            .put(
                Routes.applicationCommands(applicationId),
                { body: this.#commands.collection.map(command => command.properties)}
            );

        return await super.login(token);
    }

    async uploadImage(img: string | Buffer, notGif = false): Promise<string> {
        const channel = await this.channels.fetch(this.imageCacheChannel);
        if(!channel?.isTextBased()) throw "Image cache is not a text-based channel";
        const attachment = new AttachmentBuilder(await getBuffer(img, notGif));
        const msg = await channel.send({ files: [attachment]});
        const url =  msg.attachments.first()?.proxyURL;
        if(!url) throw "No URL was returned for the image";
        return url;
    }
}
