import { stripIndent } from "common-tags";
import { bold, CommandInteraction, EmbedBuilder } from "discord.js";
import SweetieClient from "../lib/SweetieClient.js";
import EmbedList from "./EmbedList.js";
import fetch from "node-fetch";
import { getBuffer, msToTimestamp, randomSadEmoji } from "./util.js";
import sharp from "sharp";

export async function replyTo(interaction: CommandInteraction, show: number, url: string, client: SweetieClient): Promise<void> {
	const json = await fetch(stripIndent`
	https://api.trace.moe/search?anilistInfo&url=${encodeURIComponent(url)}`
	).then(res => res.json() as Promise<TraceResponse>);

    if(json.error) {
        await interaction.reply({ content: `trace.moe error ${randomSadEmoji()}: ${json.error}`, ephemeral: true });
		return;
    }

    if(json.result.length === 0) {
        await interaction.reply({ content: `trace.moe didn't return any results ${randomSadEmoji()}`, ephemeral: true });
		return;
    }

    await interaction.deferReply();
	const embedList = new EmbedList({ time: 15000, displayAmount: show });
	for(const result of json.result) {
		embedList.add(await createEmbed(result, client));
	}
	await embedList.send(interaction);
}

export async function createEmbed(data: TraceResult, client: SweetieClient): Promise<EmbedBuilder> {
    if(typeof data.anilist === "number") throw "createEmbed() doesn't support non-anilist included results";
    const embed = new EmbedBuilder()
        .setImage(
            await client.uploadImage(data.anilist.isAdult
				? await sharp(await getBuffer(data.image)).blur(20).toBuffer()
				: data.image
			)
        )
        .setTitle(data.anilist.title.english ?? data.anilist.title.romaji)
        .setURL(`https://anilist.co/anime/${data.anilist.id}/`)
        .setColor("#000")
        .setFields(
            { name: "Similarity:", value: `${(data.similarity*100).toFixed(2)}%` },
            {
                name: "Timestamp",
                value: data.episode
                    ? `Episode ${beautifyEpisode(data.episode)} at ${msToTimestamp(data.from * 1000)}`
                    : msToTimestamp(data.from * 1000)
            }
        );
    if(data.anilist.isAdult) {
        embed.setDescription(`${bold("WARNING:")} Anime is NSFW!`);
    }
    return embed;
}

export function beautifyEpisode(ep: number | string | number[]): string {
    if(typeof ep === "string") return ep;
    if(typeof ep === "number") return ep.toString();
    return `${ep[0]}-${ep.at(-1)}`;
}

export type TraceResponse = {
    frameCount: number,
    error: string,
    result: TraceResult[]
}

export type TraceResult = {
    anilist: number | AnilistResult,
    filename: string,
    episode: number | string | number[] | null,
    from: number,
    to: number,
    similarity: number,
    video: string,
    image: string
}

export type AnilistResult = {
    id: number,
    idMal?: number,
    title: {
        native?: string,
        romaji: string,
        english?: string
    },
    synonyms: string[],
    isAdult: boolean
}