import { SlashCommandBuilder, bold, hyperlink } from "@discordjs/builders";
import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { Canvas } from "canvas";
import Command from "../../lib/Command.js";
import EmbedList from "../../util/EmbedList.js";
import { JishoWord, words } from "../../util/jisho.js";
import SweetieClient from "../../lib/SweetieClient.js";

export default class JapaneseCommand extends Command  {
    properties = new SlashCommandBuilder()
        .setName("japanese")
        .setDescription("Searches in Jisho for the word")
        .addStringOption(input => 
            input.setName("word")
                .setDescription("Can be a kanji, a japanese word or even an english word (Same search features as Jisho)") 
                .setRequired(true)   
        );
    async run(interaction: ChatInputCommandInteraction): Promise<unknown> {
        const word = interaction.options.getString("word", true);
        const data = await words(word);
        
        await interaction.deferReply();
        const length = data.length > 12 ? 12 : data.length;
        const embedList = new EmbedList();
        for(let i = 0; i < length; i++) {
            const embed = await JapaneseCommand.makeEmbed(data[i], this.client);
            embedList.add(embed);
        }
        return embedList.send(interaction);
    }

    static async makeEmbed(data: JishoWord, client: SweetieClient): Promise<EmbedBuilder> {
        const embed = new EmbedBuilder()
            .setTitle(data.slug)
            .setURL(`https://jisho.org/word/${encodeURIComponent(data.slug)}`);

        const tags = JapaneseCommand.processTags(data).join(" - ");
        if(tags) embed.setDescription(`${bold(tags)}: ${tags}`);

        for(let i = 0; i < data.senses.length; i++) {
            const sense = data.senses[i];
            let content = `${i+1}. ${bold(sense.english_definitions.join("; "))} `;
            content += [
                ...sense.tags,
                ...sense.restrictions.map(rest => `Only applies to ${rest}`),
                ...sense.see_also.map(also => `See also ${hyperlink(also, `https://jisho.org/search/${encodeURIComponent(also)})`)}`),
                ...sense.info,
                sense.links.map(link => `[${link.text}](${link.url})`).join("\n")
            ].join(", ");

            if(!sense.parts_of_speech.length && embed.data.fields?.length !== undefined && embed.data.fields.length > 0) {
				embed.data.fields[embed.data.fields.length - 1].value += `\n${content}`;
				continue;
			}

            embed.addFields({ name: sense.parts_of_speech.join(", ") || "\u200b", value: content });
        }

        const forms = [];
        for(let i = 1; i < data.japanese.length; i++) {
            const form = data.japanese[i];
            forms.push(`${form.word} 【${form.reading}】`);
        }
        if(forms.length > 1) embed.addFields({ name: "Other forms", value: forms.join("、") });

        embed.setThumbnail(await client.uploadImage(JapaneseCommand.generateFurigana(data)));
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
