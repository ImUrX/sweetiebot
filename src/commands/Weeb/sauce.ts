import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction, BaseCommandInteraction, MessageEmbed } from "discord.js";
import fetch from "node-fetch";
import { stripIndent } from "common-tags";
import { getKawaiiLink, randomSadEmoji } from "../../util/util.js";
import Command from "../../lib/Command.js";
import auth from "../../../auth.json";
import EmbedList from "../../util/EmbedList.js";

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
        
        await SauceCommand.replyTo(interaction, url);
    }

    static async replyTo(interaction: BaseCommandInteraction, url: string): Promise<void> {
        const nsfw = interaction.channel && "nsfw" in interaction.channel && interaction.channel.nsfw;
        const json = await fetch(stripIndent`
        https://saucenao.com/search.php?db=999&output_type=2&numres=5${nsfw ? "" : "&hide=3"}&api_key=${auth.saucenao}&url=${encodeURIComponent(url)}`
        ).then(res => res.json() as Promise<SauceNAOData<unknown>>);

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
        const embedList = new EmbedList({ time: 30000 });
        for(let i = 0; i < json.results.length; i++) {
            embedList.add(
                await SauceCommand.createEmbed(json.results[i])
            );
        }
        await embedList.send(interaction);
    }

    static async createEmbed(data: SauceNAOResult<unknown>): Promise<MessageEmbed> {
        const res = new MessageEmbed()
            .setImage(await getKawaiiLink(data.header.thumbnail))
            .setDescription(`Similarity ${data.header.similarity}%`)
            .setFooter(data.header.index_name)
            .setColor("PURPLE");
        if(data.data.ext_urls && data.data.ext_urls.length > 0) {
            res.setURL(data.data.ext_urls[0]);
        }
        switch(data.header.index_id) {
            case 34: { // no deep type guard currently for discrimating unions
                const tmp = data as SauceNAOResult<34>;
                res.setAuthor(tmp.data.author_name, undefined, tmp.data.author_url)
                    .setTitle(tmp.data.title);
                break;
            }
            case 5:
            case 6: {
                const tmp = data as SauceNAOResult<6>;
                res.setAuthor(tmp.data.member_name, undefined, `https://www.pixiv.net/users/${tmp.data.member_id}`)
                    .setTitle(tmp.data.title);
                break;
            }
            case 21: {
                const tmp = data as SauceNAOResult<21>;
                if(tmp.data.part) res.addField("Part:", tmp.data.part, true);
                res.setTitle(tmp.data.source)
                    .addField("Timestamp:", tmp.data.est_time, true);
                break;
            }
            case 40: {
                const tmp = data as SauceNAOResult<40>;
                res.setAuthor(tmp.data.author_name, undefined, tmp.data.author_url)
                    .setTitle(tmp.data.title);
                break;
            }
            case 41: {
                const tmp = data as SauceNAOResult<41>;
                res.setTitle(`Tweet by @${tmp.data.twitter_user_handle}`)
                    .setTimestamp(new Date(tmp.data.created_at));
                break;
            }
            case 38: {
                const tmp = data as SauceNAOResult<38>;
                res.setTitle(tmp.data.source)
                    .setAuthor(tmp.data.creator.join(" & "));
                break;
            }
            case 31: {
                const tmp = data as SauceNAOResult<31>;
                res.setTitle(tmp.data.title)
                    .setAuthor(tmp.data.member_name, undefined, `https://bcy.net/u/${tmp.data.member_link_id}`);
                break;
            }
            case 42: {
                const tmp = data as SauceNAOResult<42>;
                res.setTitle(tmp.data.title)
                    .setAuthor(tmp.data.author_name, undefined, tmp.data.author_url);
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
                    .setAuthor(tmp.data.member_name, undefined, `https://seiga.nicovideo.jp/user/illust/${tmp.data.member_id}`);
                break;
            }
            case 27: {
                const tmp = data as SauceNAOResult<27>;
                res.setTitle(tmp.data.source)
                    .setAuthor(tmp.data.creator);
                break;
            }
            default:
                console.error(`Don't know where this SauceNAO index is from: ${JSON.stringify(data)}`);
                res.setTitle("¿?");
        }
        return res;
    }
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
        dupes: number
    },
    data: {
        ext_urls?: string[],
    } & (T extends keyof DataType ? DataType[T] : unknown);
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
