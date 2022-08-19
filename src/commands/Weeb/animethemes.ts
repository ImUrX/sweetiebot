import { ChatInputCommandInteraction, SlashCommandBuilder, AutocompleteInteraction } from "discord.js";
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
		if(!query) {
			await interaction.respond([]);
			return;
		}
		
		const res = await this.searchTheme(query);
		
		await interaction.respond(res.map(x => {
			return {
				name: `${x.name} ${x.slug}`,
				value: `\0${x.theme_id}`
			};
		}));
	}

	async searchTheme(query: string): Promise<{
		theme_id: string;
		name: string;
		slug: string;
		title: string | undefined;
	}[]> {
		query = query.toUpperCase();
		const split = query.split(" ");
		const res = await this.client.mysql<AnimeTheme>("anime_themes")
			.innerJoin<Anime>("anime", "anime.anime_id", "anime_themes.anime_id")
			.leftJoin<AnimeSynonym>("anime_synonyms", "anime.anime_id", "anime_synonyms.anime_id")
			.leftJoin<Song>("songs", "songs.song_id", "anime_themes.song_id")
			.select(
				this.client.mysql.ref("theme_id").withSchema("anime_themes"),
				this.client.mysql.ref("name").withSchema("anime"),
				this.client.mysql.ref("slug").withSchema("anime_themes"),
				this.client.mysql.ref("title").withSchema("songs")
			)
			.whereRaw(`match(anime.name) against(${split.map(() => "?").join(", ")})`, [...split])
			.orWhereRaw(`match(songs.title) against(${split.map(() => "?").join(", ")})`, [...split])
			.orWhereRaw(`match(anime_themes.slug) against(${split.map(() => "?").join(", ")})`, [...split]);
		return res;
	}
}

export interface Anime {
	anime_id: string;
	created_at?: Date;
	updated_at?: Date;
	deleted_at?: Date;
	slug: string;
	name: string;
	year: number;
	season: number;
	synopsis: string;
}

export interface AnimeSynonym {
	synonym_id: string;
	created_at?: Date;
	updated_at?: Date;
	deleted_at?: Date;
	text?: string;
	anime_id: string;
}

export interface AnimeTheme {
	theme_id: string;
	created_at?: Date;
	updated_at?: Date;
	deleted_at?: Date;
	group?: string;
	type?: number;
	sequence?: number;
	slug: string;
	anime_id: string;
	song_id?: string;
}

export interface AnimeThemeEntry {
	entry_id: string;
	created_at?: Date;
	updated_at?: Date;
	deleted_at?: Date;
	version?: number;
	episodes?: string;
	nsfw: boolean;
	spoiler: boolean;
	notes: string;
	theme_id: string;
}

export interface AnimeThemeEntryVideo {
	created_at?: Date;
	updated_at?: Date;
	entry_id: string;
	video_id: string;
}

export interface Song {
	song_id: string;
	created_at?: Date;
	updated_at?: Date;
	deleted_at?: Date;
	title?: string;
}

export interface Artist {
	artist_id: string;
	created_at?: Date;
	updated_at?: Date;
	deleted_at?: Date;
	slug: string;
	name: string;
}

export interface Video {
	video_id: string;
	created_at?: Date;
	updated_at?: Date;
	deleted_at?: Date;
	basename: string;
	filename: string;
	path: string;
	size: number;
	mimetype: string;
	resolution?: number;
	nc: boolean;
	subbed: boolean;
	lyrics: boolean;
	uncen: boolean;
	overlap: number;
	source?: number;
}

export interface ArtistSong {
	created_at?: Date;
	updated_at?: Date;
	artist_id: string;
	song_id: string;
	as?: string;
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
