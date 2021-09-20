import { Client, ClientOptions } from "discord.js";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import Store from "./base/Store";
import Command from"./Command";

module.exports = class SweetieClient extends Client {
    #commands: Store<Command> = new Store(this, "./commands/", true);
    #rest = new REST({ version: "9" });

    constructor(options: ClientOptions) {
        super(options);

        this.on("interactionCreate", async interaction => {
            if(interaction.isCommand()) {
                const command = this.#commands.collection.get(interaction.commandName);
                if(!command) return;
                try {
                    await command.run(interaction);
                } catch (error) {
                    console.error(error);
                    await interaction.reply({ content: "There was an error while executing this command!", ephemeral: true });
                } 
            }
        });
    }

    async login(token: string, applicationId = "") {
        await this.#commands.init();
        await this.#rest
            .setToken(token)
            .put(
                Routes.applicationCommands(applicationId),
                { body: this.#commands.collection.map(command => command.properties)}
            );

        return await super.login(token);
    }
};
