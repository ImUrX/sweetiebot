import { stripIndent } from "common-tags";
import { APIEmbedField, bold, CommandInteraction, EmbedBuilder } from "discord.js";
import SweetieClient from "../lib/SweetieClient.js";
import EmbedList from "./EmbedList.js";
import { blurImage, getBuffer, randomSadEmoji, shortify } from "./util.js";
import auth from "../../auth.json" assert { type: "json" };

export async function replyTo(interaction: CommandInteraction, show: number, url: string, client: SweetieClient): Promise<void> {
	const json = await fetch(stripIndent`
	https://saucenao.com/search.php?db=999&output_type=2&numres=5&hide=3&api_key=${auth.saucenao}&url=${encodeURIComponent(url)}`
	).then(res => res.json() as Promise<SauceNAOData<unknown>>);

	if(json.header.status > 0 && !json.results.length) {
		await interaction.reply({ content: `It seems SauceNAO is having some problems ${randomSadEmoji()} (code: ${json.header.status})`, ephemeral: true });
		return;
	}
	if(json.header.status < 0) {
		if(json.header.status === -3) {
			await interaction.reply({ content: `The URL isn't a supported image by SauceNAO ${randomSadEmoji()}`, ephemeral: true });
			return;
		}
		await interaction.reply({ content: `It seems someone in here did something wrong ${randomSadEmoji()} (code ${json.header.status})`, ephemeral: true });
		return;
	}
	await interaction.deferReply();
	const embedList = new EmbedList({ time: 15000, displayAmount: show });
	for(const result of json.results) {
		embedList.add(await createEmbed(result, client));
	}
	await embedList.send(interaction);
}

export async function createEmbed(data: SauceNAOResult<unknown>, client: SweetieClient): Promise<EmbedBuilder> {
	const res = new EmbedBuilder()
		.setImage(
			await client.uploadImage(data.header.hidden === 0 
				? data.header.thumbnail 
				: await blurImage(await getBuffer(data.header.thumbnail))
			)
		)
		.setDescription(`${data.header.hidden ? `${bold("WARNING:")} Image is NSFW!\n` : ""}Similarity ${data.header.similarity}%`)
		.setFooter({ text: data.header.index_name })
		.setColor("Purple");

	if(data.data.ext_urls && data.data.ext_urls.length > 0) {
		res.setURL(data.data.ext_urls[0]);
	}
	switch(data.header.index_id) {
		case 5:
		case 6: { // no deep type guard currently for discrimating unions
			const tmp = data as SauceNAOResult<5 | 6>;
			res.setAuthor({ name: tmp.data.member_name, url: `https://www.pixiv.net/users/${tmp.data.member_id}` })
				.setTitle(tmp.data.title);
			break;
		}
		case 21: {
			const tmp = data as SauceNAOResult<21>;
			const fields: APIEmbedField[] = [];
			if(tmp.data.part) fields.push({name: "Part:", value: tmp.data.part, inline: true});
			fields.push({ name: "Timestamp:", value: tmp.data.est_time, inline: true });
			res.setTitle(tmp.data.source)
				.addFields(fields);
			break;
		}
		case 34:
		case 40:
		case 42: {
			const tmp = data as SauceNAOResult<34 | 40 | 42>;
			res.setTitle(tmp.data.title)
				.setAuthor({ name: shortify(tmp.data.author_name, 50), url: tmp.data.author_url });
			break;
		}
		case 41: {
			const tmp = data as SauceNAOResult<41>;
			res.setTitle(`Tweet by @${tmp.data.twitter_user_handle}`)
				.setTimestamp(new Date(tmp.data.created_at));
			break;
		}
		case 18:
		case 38: {
			const tmp = data as SauceNAOResult<18 | 38>;
			res.setTitle(tmp.data.source)
				.setAuthor({ name: shortify(tmp.data.creator.join(" & "), 50) });
			break;
		}
		case 31: {
			const tmp = data as SauceNAOResult<31>;
			res.setTitle(tmp.data.title)
				.setAuthor({ name: tmp.data.member_name, url: `https://bcy.net/u/${tmp.data.member_link_id}` });
			break;
		}
		case 35: {
			const tmp = data as SauceNAOResult<35>;
			res.setTitle(`Toot by ${tmp.data.pawoo_user_username}`);
			break;
		}
		case 8: {
			const tmp = data as SauceNAOResult<8>;
			res.setTitle(tmp.data.title)
				.setAuthor({ name: tmp.data.member_name, url: `https://seiga.nicovideo.jp/user/illust/${tmp.data.member_id}` });
			break;
		}
		case 27:
		case 12:
		case 9:
		case 16: {
			const tmp = data as SauceNAOResult<27 | 12 | 9 | 16>;
			res.setTitle(tmp.data.source)
				.setAuthor({ name: tmp.data.creator });
			break;
		}
		case 36: {
			const tmp = data as SauceNAOResult<36>;
			res.setTitle(tmp.data.source)
				.addFields({name: "Part:", value: tmp.data.part, inline: true});
			break;
		}
		case 43: {
			const tmp = data as SauceNAOResult<43>;
			res.setTitle(tmp.data.title)
				.setAuthor({ name: tmp.data.user_name });
			break;
		}
		case 37: {
			const tmp = data as SauceNAOResult<37>;
			res.setTitle(tmp.data.source)
				.setAuthor({ name: `${tmp.data.author}${tmp.data.author.includes(tmp.data.artist) ? "" : `, ${tmp.data.artist}`}`})
				.addFields({name: "Part:", value: tmp.data.part, inline: true});
			break;
		}
		default:
			SweetieClient.LOGGER.warn(`Don't know where this SauceNAO index is from: ${JSON.stringify(data)}`);
			res.setTitle("¿?");
	}
	return res;
}

export type SauceNAOData<T> = {
	header: {
		status: number
	},
	results: SauceNAOResult<T>[]
}

type SauceNAOResult<T extends keyof DataType | unknown> = {
	header: {
		similarity: string,
		thumbnail: string,
		index_id: keyof DataType,
		index_name: string,
		dupes: number,
		hidden: number
	},
	data: {
		ext_urls?: string[],
	} & (T extends keyof DataType ? DataType[T] : unknown);
}

export type DataType = {
	34: SaucedevianArtData,
	5: SaucePixivData,
	6: SaucePixivData,
	9: SauceDanbooruData,
	21: SauceAnimeData,
	40: SauceFurAffinityData,
	41: SauceTwitterData,
	43: SauceKemonoData,
	18: SauceEHentaiData,
	38: SauceEHentaiData,
	31: SauceBcyData,
	42: SauceFurryNetworkData,
	35: SaucePawooData,
	8: SauceNicoNicoData,
	27: SauceSankakuData
	16: SauceFAKKUData,
	36: SauceMadokamiData,
	12: SauceYandereData,
	37: SauceMangadexData
}

interface TitledData {
	title: string
}

export type SaucedevianArtData = {
	da_id: string,
	author_name: string,
	author_url: string
} & TitledData

export type SaucePixivData = {
	pixiv_id: number,
	member_name: string,
	member_id: number
} & TitledData

export type SauceAnimeData = {
	anidb_aid: number,
	part?: string,
	year?: string,
	est_time: string,
	source: string
}

export type SauceMangadexData = {
	md_id: string,
	mu_id?: number,
	mal_id?: number,
	source: string,
	part: string,
	artist: string,
	author: string
}

export type SauceFurAffinityData = {
	fa_id: number,
	author_name: string,
	author_url: string
} & TitledData

export type SauceTwitterData = {
	created_at: string,
	tweet_id: string,
	twitter_user_id: string,
	twitter_user_handle: string
}

export type SauceEHentaiData = {
	source: string,
	creator: string[],
	eng_name?: string,
	jp_name?: string
}

export type SauceBcyData = {
	bcy_id: number,
	member_name: string,
	member_id: number,
	member_link_id: number,
	bcy_type: string
} & TitledData

export type SauceFurryNetworkData = {
	fn_id: number,
	fn_type: string,
	author_name: string,
	author_url: string
} & TitledData

export type SaucePawooData = {
	created_at: string,
	pawoo_id: number,
	pawoo_user_acct: string,
	pawoo_user_username: string,
	pawoo_user_display_name: string
}

export type SauceNicoNicoData = {
	seiga_id: number,
	member_name: string,
	member_id: number
} & TitledData

export type SauceSankakuData = {
	sankaku_id: number,
	creator: string,
	material: string,
	characters: string,
	source: string
}

export type SauceFAKKUData = {
	source: string,
	creator: string
}

export type SauceMadokamiData = {
	mu_id: number,
	source: string,
	part: string,
	type: string
}

export type SauceYandereData = {
	/**
	 * A URL sometimes
	 */
	source: string,
	characters: string,
	material: string,
	creator: string,
	"anime-pictures_id"?: number,
	gelbooru_id?: number,
	yandere_id: number,
	danbooru_id?: number
}

export type SauceDanbooruData = SauceYandereData

export type SauceKemonoData = {
	published: string,
	title: string,
	service: string,
	service_name: string,
	id: string,
	user_id: string,
	user_name: string
}
