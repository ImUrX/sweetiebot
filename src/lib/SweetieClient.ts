import { AttachmentBuilder, Client, ClientOptions } from "discord.js";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import Store from "./base/Store.js";
import Command from"./Command.js";
import { censorTokens, getBuffer, randomSadEmoji } from "../util/util.js";
import pino from "pino";
import knex from "knex";
import auth from "../../auth.json" assert { type: "json" };

export default class SweetieClient extends Client {
	static LOGGER = pino({
		name: "bot"
	});
	#commands: Store<Command> = new Store(this, "./commands/", true);
	#rest = new REST({ version: "10" });
	imageCacheChannel: string;
	/**
	 * Mainly used for importing external DBs more than the bot itself
	 */
	mysql = knex({
		client: "mysql2",
		connection: {
			supportBigNumbers: true,
			bigNumberStrings: true,
			...auth.mysql
		},
	});

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
					SweetieClient.LOGGER.error(`Error when executing ${interaction.commandName} in #${interaction.channelId} with @${interaction.user.id}`, error);
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

		this.on("debug", m => SweetieClient.LOGGER.debug(m));
		this.on("warn", m => SweetieClient.LOGGER.warn(m));
		this.on("error", m => SweetieClient.LOGGER.error(m));
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
