const fetch = require("node-fetch");
const util = require("../../lib/util/util");
const SweetieCommand = require("../../lib/base/SweetieCommand");
const { RichDisplay } = require("klasa");
const { MessageEmbed, MessageAttachment } = require("discord.js");
const { Canvas } = require("canvas-constructor");
const { jishoextender } = require("../../../auth.json");

module.exports = class extends SweetieCommand {

	constructor(...args) {
		super(...args, {
			cooldown: 10,
			aliases: ["jp"],
			usage: "<vocab:str>",
			description: "Searches for the word in Jisho",
			extendedHelp: `Flags:
	--plain: gives plain text instead of an embed
	--furigana: returns the furigana image
	--audio: returns the wanikani audio on how to speak the word`
		});
	}

	async run(msg, [vocabQuery]) {
		const prev = await msg.send("Searching in Jisho...");
		const { data, meta } = await fetch(`${jishoextender}/search/words?keyword=${encodeURIComponent(vocabQuery)}`)
			.then(res => res.json());
		if (meta.status !== 200) {
			return msg.send(`Error ${meta.status} received`);
		}
		if (data.length === 0) return msg.send(`No results found ${util.randomSadEmoji()}`);


		const word = data[0];
		if (msg.flagArgs.furigana) return msg.send(await util.getKawaiiLink(this.generateFurigana(word)));
		if (msg.flagArgs.audio) {
			if (!word.audio.mp3) return msg.send("There is no audio on this word");
			if (msg.channel.attachable) {
				prev.delete();
				return msg.send(
					new MessageAttachment(await fetch(word.audio.mp3).then(res => res.buffer()), "wanikani.mp3")
				);
			}
			return msg.send(word.audio.mp3);
		}

		if (msg.channel.embedable && !msg.flagArgs.plain) {
			if (msg.channel.enrichable && data.length > 1) {
				const display = new RichDisplay();
				display.addPages(...await Promise.all(
					data.map(slug => this.generateEmbed(slug))
				));
				prev.delete();
				return display.run(msg, { time: 180000 });
			}
			const embed = await this.generateEmbed(word);
			return msg.send(embed);
		}

		const tags = processTags(word);

		let block = `**${
			word.japanese[0].word ? `${word.japanese[0].word} 【${word.japanese[0].reading}】` : word.japanese[0].reading
		}**:\`\`\`md${tags.length ? `\n<tags: ${tags.join(" - ")}>` : ""}`;
		for (let i = 0; i < word.senses.length; i++) {
			const sense = word.senses[i];
			if (sense.parts_of_speech.length) block += `\n# ${sense.parts_of_speech.join(", ")}`;

			let meaning = `\n${i + 1}. ${sense.english_definitions.join("; ")}`;
			const info = [
				...sense.tags,
				...sense.restrictions.map(rest => `Only applies to ${rest}`),
				...sense.see_also.map(also => `See also ${also}`),
				...sense.info
			].join(", ");
			if (info) meaning += ` - ${info}`;
			block += meaning;
		}

		const forms = [];
		for (let i = 1; i < word.japanese.length; i++) {
			const form = word.japanese[i];
			forms.push(`${form.word} 【${form.reading}】`);
		}
		if (forms.length > 1) block += `\n# Other forms\n${forms.join("、")}`;
		block += "```";

		return msg.send(block);
	}

	generateFurigana({ japanese: [first] }) {
		const width = 128, height = width,
			word = first.word || first.reading,
			canvas = new Canvas(width, height)
				.setTextFont("32px Noto Sans")
				.setColor("#2C2F33")
				.addRect(0, 0, width, height)
				.setColor("#FFF")
				.setTextAlign("center")
				.setTextBaseline("middle");
		const halfWidth = width / 2,
			halfHeight = height / 2,
			size = canvas.measureText(word),
			newSize = size.width < width ? 32 : Math.floor((122 / size.width) * 32),
			reducer = word.length === 1 ? 0 : 1,
			even = word.length % 2 === 0;

		canvas.setTextSize(newSize)
			.addText(word, halfWidth, halfHeight);

		if (!first.furigana.length) return canvas.toBufferAsync();

		let firstCharX = halfWidth;
		if (even) {
			firstCharX -= Math.floor(newSize / 2);
		} else if (reducer) {
			firstCharX -= newSize;
		}
		firstCharX -= newSize * (Math.floor(word.length / 2) - reducer);

		for (let i = 0; i < first.furigana.length; i++) {
			const furigana = first.furigana[i];
			canvas.setTextSize(16)
				.measureText(furigana, (furSize) => {
					canvas.setTextSize(furSize.width < newSize ? 16 : Math.floor((newSize / furSize.width) * 16));
				});
			canvas.addText(furigana, firstCharX + (newSize * i), halfHeight - newSize);
		}

		return canvas.toBuffer();
	}

	generateEmbed(word) {
		const embed = new MessageEmbed()
			.setTitle(word.japanese[0].word || word.japanese[0].reading)
			.setURL(`https://jisho.org/word/${encodeURIComponent(word.slug)}`);
		const tags = processTags(word).join(" - ");
		if (tags) embed.setDescription(`**tags**: ${tags}`);
		for (let i = 0; i < word.senses.length; i++) {
			const sense = word.senses[i];
			let meaning = `${i + 1}. **${sense.english_definitions.join("; ")}** `;

			meaning += [
				...sense.tags,
				...sense.restrictions.map(rest => `Only applies to ${rest}`),
				...sense.see_also.map(also => `See also [${also}](https://jisho.org/search/${encodeURIComponent(also)})`),
				...sense.info
			].join(", ");
			meaning += sense.links.map(link => `[${link.text}](${link.url})`).join("\n");

			if (!sense.parts_of_speech.length && embed.fields.length) {
				embed.fields[embed.fields.length - 1].value += `\n${meaning}`;
				continue;
			}
			embed.addField(sense.parts_of_speech.join(", ") || "\u200b", meaning);
		}

		const forms = [];
		for (let i = 1; i < word.japanese.length; i++) {
			const form = word.japanese[i];
			forms.push(`${form.word} 【${form.reading}】`);
		}
		if (forms.length > 1) embed.addField("Other forms", forms.join("、"));

		const additionalLinks = [];
		if (word.audio.mp3) additionalLinks.push(`[Audio (MP3)](${word.audio.mp3})`);
		if (word.audio.ogg) additionalLinks.push(`[Audio (OGG)](${word.audio.ogg})`);
		if (word.attribution.dbpedia) additionalLinks.push(`[DBPedia](${word.attribution.dbpedia})`);
		if (additionalLinks.length) embed.addField("Related links", additionalLinks.join(" - "));

		return util.getKawaiiLink(this.generateFurigana(word)).then(thumb => embed.setThumbnail(thumb));
	}

};

function processTags(word) {
	const arr = [];
	if (word.is_common) arr.push("common word");
	for (const tag of word.tags) {
		if (tag.startsWith("wanikani")) {
			arr.push(`wanikani lvl${tag.substring(8)}`);
		} else {
			console.log("discovered new tag", tag);
		}
	}
	for (const lvl of word.jlpt) {
		arr.push(lvl.replace("-", " "));
	}
	return arr;
}
