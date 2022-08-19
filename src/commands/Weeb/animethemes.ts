import { stripIndent } from "common-tags";
import { ChatInputCommandInteraction, SlashCommandBuilder, AutocompleteInteraction } from "discord.js";
import fetch from "node-fetch";
import Command from "../../lib/Command.js";

export default class AnimeThemesCommand extends Command {
	properties = new SlashCommandBuilder()
		.setName(this.name)
		.setDescription("Searches for an anime theme (opening/ending)")
		.addStringOption(option =>
			option.setName("query")
				.setDescription("Theme to look for")
				.setRequired(true)
				.setAutocomplete(true)
		);

	async run(interaction: ChatInputCommandInteraction): Promise<void> {
		const query = interaction.options.getString("query", true);
		interaction.reply(query.startsWith("\0").toString());
	}

	async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
		const query = interaction.options.getString("query");
		if(query === null) {
			await interaction.respond([]);
			return;
		}
		const json = await fetch(stripIndent`
		https://api.animethemes.moe/animetheme?include=anime.images,song.artists&fields[anime]=name,slug,year,season&fields[animetheme]=id,type,sequence,slug,group&fields[animethemeentry]=version,episodes,spoiler,nsfw&fields[video]=tags,resolution,nc,subbed,lyrics,uncen,source,overlap&fields[image]=facet,link&fields[song]=title&fields[artist]=name,slug,as&filter[has]=song&page[size]=15&page[number]=1&q=${encodeURIComponent(query)}
		`).then(res => res.json()) as AnimeThemeQuery;
		
		await interaction.respond(json.animethemes.map(x => {
			return {
				name: `${x.anime.name} ${x.slug}`,
				value: `\0${x.id}`
			};
		}));
	}

}

export type AnimeThemeQuery = {
	animethemes: AnimeThemeData[],
	// There is more but it's non-important for me in this case
}

export type AnimeThemeData = {
	id: number,
	type: "OP" | "ED",
	sequence?: number,
	group?: number,
	slug: string,
	anime: {
		name: string,
		slug: string,
		year: number,
		season: string,
		images: {
			facet: string,
			link: string
		}[]
	},
	song: {
		title: string,
		artists: {
			name: string,
			slug: string,
			as?: string
		}[]
	}
}
