import { ChatInputCommandInteraction, SlashCommandBuilder, AutocompleteInteraction, bold } from "discord.js";
import Command from "../../lib/Command.js";
import { randomSadEmoji } from "../../util/util.js";

export default class AnimeThemesCommand extends Command {
	properties = new SlashCommandBuilder()
		.setName(this.name)
		.setDescription("Searches for an anime opening or ending")
		.addStringOption(option =>
			option.setName("query")
				.setDescription("Theme to look for")
				.setRequired(true)
				.setAutocomplete(true)
		);

	async run(interaction: ChatInputCommandInteraction): Promise<void> {
		const query = interaction.options.getString("query", true);

		let id: string;
		if(query.startsWith("\0")) {
			id = query.substring(1);
		} else {
			const possible = (await this.searchTheme(query, 1))[0];
			if(!possible) {
				interaction.reply({ content: "Couldn't find the anime theme " + randomSadEmoji(), ephemeral: true });
				return;
			}
			id = possible.theme_id;
		}

		const info = (await this.getVideo(id))[0];
		let prelude = "";
		if(info.title) prelude += bold(info.title);
		if(info.name) prelude += ` from ${info.name}`;
		interaction.reply(`${prelude}\nhttps://v.animethemes.moe/${info.basename}`);
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

	async getVideo(themeId: string): Promise<{
		title?: string,
		basename: string,
		name: string,
		as?: string
	}[]> {
		const res = await this.client.mysql<AnimeThemeEntry>("anime_theme_entries")
			.innerJoin<AnimeTheme>("anime_themes", "anime_theme_entries.theme_id", "anime_themes.theme_id")
			.innerJoin<AnimeThemeEntryVideo>("anime_theme_entry_video", "anime_theme_entry_video.entry_id", "anime_theme_entries.entry_id")
			.innerJoin<Video>("videos", "anime_theme_entry_video.video_id", "videos.video_id")
			.leftJoin<Song>("songs", "songs.song_id", "anime_themes.song_id")
			.leftJoin<ArtistSong>("artist_song", "songs.song_id", "artist_song.song_id")
			.leftJoin<Artist>("artists", "artist_song.artist_id", "artists.artist_id")
			.select("*")
			.orderBy("resolution", "desc", "last")
			.where("anime_theme_entries.theme_id", themeId);
		return res;
	}

	async searchTheme(query: string, limit = 25): Promise<{
		theme_id: string;
		name: string;
		slug: string;
		title?: string;
	}[]> {
		query = query.toUpperCase();
		const split = query.split(" ");
		const whichIndex = split.findIndex(x => (x.startsWith("OP") || x.startsWith("ED")) && (!isNaN(parseInt(x.substring(2))) || !x.substring(2)));
		let which: string[] = [""];
		if(whichIndex >= 0) {
			which = split.splice(whichIndex, 1);
		}
		const joined = split.join(" ");

		const knexQuery = (relevance: number) => this.client.mysql<AnimeTheme>("anime_themes")
			.innerJoin<Anime>("anime", "anime.anime_id", "anime_themes.anime_id")
			.leftJoin<AnimeSynonym>("anime_synonyms", "anime.anime_id", "anime_synonyms.anime_id")
			.leftJoin<Song>("songs", "songs.song_id", "anime_themes.song_id")
			.select(
				this.client.mysql.ref("theme_id").withSchema("anime_themes"),
				this.client.mysql.ref("name").withSchema("anime"),
				this.client.mysql.ref("slug").withSchema("anime_themes"),
				this.client.mysql.ref("title").withSchema("songs"),
				this.client.mysql.raw("? as ??", [relevance, "$relevance"])
			);
		const res = await knexQuery(1)
			.whereILike("anime.name", `%${joined}%`)
			.andWhereILike("anime_themes.slug", `%${which[0]}%`)
			.orWhereILike("songs.title", `%${joined}%`)
			.andWhereILike("anime_themes.slug", `%${which[0]}%`)
			.orWhereILike("anime_synonyms.text", `%${joined}%`)
			.andWhereILike("anime_themes.slug", `%${which[0]}%`)
			.orderBy("$relevance")
			.limit(limit);
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
