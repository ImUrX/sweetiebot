import { SlashCommandBuilder, bold } from "@discordjs/builders";
import { CommandInteraction, MessageEmbed } from "discord.js";
import { Canvas } from "canvas";
import fetch from "node-fetch";
import Command from "../../lib/Command.js";
import auth from "../../../auth.json";
import EmbedList from "../../util/EmbedList.js";
import { randomSadEmoji, getKawaiiLink } from "../../util/util.js";

export default class JapaneseCommand extends Command  {
    properties = new SlashCommandBuilder()
        .setName("japanese")
        .setDescription("Searches in Jisho for the word")
        .addStringOption(input => 
            input.setName("word")
                .setDescription("Can be a kanji, a japanese word or even an english word (Same search features as Jisho)") 
                .setRequired(true)   
        )
    async run(interaction: CommandInteraction): Promise<unknown> {
        const word = interaction.options.getString("word", true);
        const { data, meta } = await fetch(`${auth.jishoextender}/search/words?keyword=${encodeURIComponent(word)}`)
            .then(res => res.json() as Promise<JishoResult>);
        
        if(meta.status !== 200) {
            return interaction.reply({ content: `Jisho returned status coded \`\`${meta.status}\`\` ${randomSadEmoji()}`, ephemeral: true });
        }
        await interaction.deferReply();
        const length = data.length > 12 ? 12 : data.length;
        const embedList = new EmbedList();
        for(let i = 0; i < length; i++) {
            const embed = await JapaneseCommand.makeEmbed(data[i]);
            embedList.add(embed);
        }
        return embedList.send(interaction);
    }

    static async makeEmbed(data: JishoWord): Promise<MessageEmbed> {
        const embed = new MessageEmbed()
            .setTitle(data.slug)
            .setURL(`https://jisho.org/word/${encodeURIComponent(data.slug)}`);

        const tags = JapaneseCommand.processTags(data).join(" - ");
        if(tags) embed.setDescription(`**tags**: ${tags}`);

        for(let i = 0; i < data.senses.length; i++) {
            const sense = data.senses[i];
            let content = `${i+1}. ${bold(sense.english_definitions.join("; "))} `;
            content += [
                ...sense.tags,
                ...sense.restrictions.map(rest => `Only applies to ${rest}`),
                ...sense.see_also.map(also => `See also [${also}](https://jisho.org/search/${encodeURIComponent(also)})`),
                ...sense.info,
                sense.links.map(link => `[${link.text}](${link.url})`).join("\n")
            ].join(", ");

            if(!sense.parts_of_speech.length && embed.fields.length > 0) {
				embed.fields[embed.fields.length - 1].value += `\n${content}`;
				continue;
			}

            embed.addField(sense.parts_of_speech.join(", ") || "\u200b", content);
        }

        const forms = [];
        for(let i = 1; i < data.japanese.length; i++) {
            const form = data.japanese[i];
            forms.push(`${form.word} 【${form.reading}】`);
        }
        if(forms.length > 1) embed.addField("Other forms", forms.join("、"));

        embed.setThumbnail(await getKawaiiLink(JapaneseCommand.generateFurigana(data)));
        return embed;
    }
    
    static processTags(word: JishoWord): string[] {
        const arr = [];
        if(word.is_common) arr.push("common word");
        for(const tag of word.tags) {
            if(tag.startsWith("wanikani")) {
                arr.push(`wanikani lvl${tag.substring(8)}`);
            } else{
                console.warn("discovered new tag", tag);
            }
        }
        for(const lvl of word.jlpt) {
            arr.push(lvl.replace("-", " "));
        }
        return arr;
    }

    static generateFurigana({ japanese: [first] }: JishoWord): Buffer {
		const width = 128, height = width, word = first.word || first.reading, canvas = new Canvas(width, height);
		const ctx = canvas.getContext("2d");
        ctx.font = font(32);
        ctx.fillStyle = "#2C2F33";
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = "#FFF";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
		const halfWidth = width / 2,
			halfHeight = height / 2,
			size = ctx.measureText(word),
			newSize = size.width < width ? 32 : Math.floor((122 / size.width) * 32),
			reducer = word.length === 1 ? 0 : 1,
			even = word.length % 2 === 0;

        ctx.font = font(newSize);
        ctx.fillText(word, halfWidth, halfHeight);

		if(!first.furigana.length) return canvas.toBuffer();

		let firstCharX = halfWidth;
		if(even) {
			firstCharX -= Math.floor(newSize / 2);
		} else if(reducer) {
			firstCharX -= newSize;
		}
		firstCharX -= newSize * (Math.floor(word.length / 2) - reducer);

		for(let i = 0; i < first.furigana.length; i++) {
			const furigana = first.furigana[i];
            ctx.font = font(16);
			const furSize = ctx.measureText(furigana);
            ctx.font = font(furSize.width < newSize ? 16 : Math.floor((newSize / furSize.width) * 16));
            ctx.fillText(furigana, firstCharX + (newSize * i), halfHeight - newSize);
		}

		return canvas.toBuffer();
	}
}

const font = (size: number) => `${size}px Noto Sans`;

export type JishoResult = {
    meta: {
        status: number,
    },
    data: JishoWord[]
}

export type JishoWord = {
    slug: string,
    is_common: boolean,
    tags: string[],
    jlpt: string[],
    japanese: JishoJapanese[],
    senses: JishoSense[],
    attribution: {
        jmdict: boolean,
        jmnedict: boolean,
        dbpedia: boolean
    },
    audio: {
        mp3?: string,
        ogg?: string
    }
}

export type JishoJapanese = {
    word: string,
    reading: string,
    furigana: string[]
}

export type JishoSense = {
    english_definitions: string[],
    parts_of_speech: string[],
    links: {
        text: string,
        url: string
    }[]
    tags: string[],
    restrictions: string[],
    see_also: string[],
    antonyms: string[],
    source: string[],
    info: string[]
}
