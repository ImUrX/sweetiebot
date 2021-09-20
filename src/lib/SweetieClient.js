const { Client } = require("discord.js");
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");
const Store = require("./base/Store");

const Command = require("./Command");

module.exports = class SweetieClient extends Client {
    /**
     * @type {Store<Command>}
     */
    #commands = new Store(this, "./commands/", Command, true);
    #rest = new REST({ version: "9" });

    constructor(options) {
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

    /**
     * @param {string} token 
     * @param {string} applicationId 
     */
    async login(token, applicationId) {
        await this.#commands.init();
        await this.#rest
            .setToken(token)
            .put(
                Routes.applicationCommands(applicationId),
                { body: this.#commands.collection.map(command => command.properties)}
            );

        await super.login(token);
    }
};
