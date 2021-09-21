import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction, MessageEmbed, MessageActionRow, MessageButton, BaseGuildTextChannel } from "discord.js";
import fetch from "node-fetch";
import { stripIndent } from "common-tags";
import { randomSadEmoji } from "../../util/util.js";
import Command from "../../lib/Command";
import { saucenao } from "../../../auth.json";

export default class SauceCommand extends Command {
    properties = new SlashCommandBuilder()
        .setName(this.name)
        .setDescription("Searches the image's original anime with saucenao.com")
        .addStringOption(option => 
            option.setName("url")
                .setDescription("URL of the image")
                .setRequired(true)
    );

    async run(interaction: CommandInteraction): Promise<unknown> {
        const url = interaction.options.getString("url", true);
        try {
            new URL(url);
        } catch(e) {
            return interaction.reply({ content: `The URL isn't valid ${randomSadEmoji()}`, ephemeral: true });
        }
        const nsfw = interaction.channel instanceof BaseGuildTextChannel && interaction.channel.nsfw;
        const json = await fetch(stripIndent`
        https://saucenao.com/search.php?db=999&output_type=2&numres=5${nsfw ? "" : "&hide=3"}&api_key=${saucenao}&url=${encodeURIComponent(url)}`
        ).then(res => res.json() as Promise<SauceNAOData<never>>);

        if(json.header.status > 0 && !json.results.length) {
            return interaction.reply({ content: `It seems SauceNAO is having some problems (code ${json.header.status})`, ephemeral: true });
        }
        if(json.header.status < 0) {
            if(json.header.status === -3) {
                return interaction.reply({ content: `The URL isn't a supported image by SauceNAO ${randomSadEmoji()}`, ephemeral: true });
            }
            return interaction.reply({ content: `It seems someone in here did something wrong ${randomSadEmoji()} (code ${json.header.status})`, ephemeral: true });
        }
        await interaction.deferReply();

        
    }
}

export type SauceNAOData<T extends keyof DataType | never> = {
    header: {
        status: number
    },
    results: {
        header: {
            similarity: string,
            thumbnail: string,
            index_id: number,
            index_name: string,
            dupes: number
        },
        data: {
            ext_urls?: string[],
        } & (T extends keyof DataType ? DataType[T] : Record<string, unknown>)
    }[]
}

export type DataType = {
    34: SaucedevianArtData,
    5: SaucePixivData,
    6: SaucePixivData,
    21: SauceAnimeData,
    40: SauceFurAffinityData,
    41: SauceTwitterData,
    38: SauceEHentaiData,
    31: SauceBcyData,
    42: SauceFurryNetworkData,
    35: SaucePawooData,
    8: SauceNicoNicoData,
    27: SauceSankakuData
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
