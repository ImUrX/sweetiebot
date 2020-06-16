const { Command } = require("klasa");
const { MessageEmbed } = require("discord.js");
const fetch = require("node-fetch");
const util = require("../../lib/util/util");
const VNDB = require("../../lib/util/VNDB");


module.exports = class extends Command {

	constructor(...args) {
		super(...args, {
			aliases: ["vn", "vndb"],
			usage: "<vn:default|staff|release|producer|character> (query:str)",
			cooldown: 10,
			subcommands: true
		});
	}

	async connect() {
		const vndb = new VNDB("sweetiebot-klasa");
		await vndb.login();
		return vndb;
	}


	async vn(msg, [query]) {
		const embedBold = Array(3).fill(msg.channel.embedable && !msg.flagArgs.plain ? "**" : "");
		embedBold.toString = () => embedBold.join("");
		embedBold.put = value => {
			embedBold[1] = value; return embedBold;
		};

		msg.send("Talking to VNDB...");
		const vndb = await this.connect();
		const { items } = await vndb.get("vn", ["basic", "details", "stats", "relations"], `(title ~ "${query}")`);
		vndb.end();
		if (!items.length) return msg.send(`No results found ${util.randomSadEmoji()}`);
		const item = items[0];

		const info = {
			desc: [],
			general: [],
			stats: [],
			relations: {
				official: [],
				nonofficial: [],
				strings: []
			}
		};
		if (item.original) info.desc.push(`${embedBold.put("Original Title")}: ${item.original}`);
		if (item.aliases) info.desc.push(`${embedBold.put(`Alias${item.aliases.split("\n").length > 1 ? "es" : ""}`)}: ${item.aliases.replace(/\n/g, ", ")}`);
		if (item.description) info.desc.push(`\n${util.shortify(convertFormatting(item.description))}`);

		if (item.released) info.general.push(`${convertReleaseDate(item.released) > Date.now() ? "Going to be released" : "Released"} on ${item.released.toUpperCase()}`);
		info.general.push(`It's ${this.length[item.length || 0]}`);
		if (item.platforms.length) {
			info.general.push(`${embedBold.put(`Platform${item.platforms.length > 1 ? "s" : ""}`)}: ${
				item.platforms.map(embedBold[0] ? val => this.platformsEmojis[val] : val => this.platforms[val]).join(embedBold[0] ? "" : "/")
			}`);
		}
		if (item.orig_lang.length) info.general.push(`${embedBold.put(`Original Language${item.orig_lang.length > 1 ? "s" : ""}`)}: ${item.orig_lang.join(embedBold[0] ? " - " : "/")}`);
		if (item.languages.length) info.general.push(`${embedBold.put(`Language${item.languages.length > 1 ? "s" : ""}`)}: ${item.languages.join(embedBold[0] ? " - " : "/")}`);

		info.stats.push(
			`${embedBold.put("Popularity")}: ${item.popularity}/100`,
			`${embedBold.put("Bayesian rating")}: ${item.rating}/10`,
			`${embedBold.put("Votes")}: ${item.votecount}`
		);

		const relationsFormatted = item.relations.map(embedBold[0] ?
			val => ({ ...val, toString: () => `[${val.title}](https://vndb.org/v${val.id}) (${val.relation})` }) :
			val => ({ ...val, toString: () => `${val.title} (${val.relation})` })
		);
		info.relations.official.push(...relationsFormatted.filter(val => val.official));
		if (info.relations.official.length) info.relations.strings.push(`**Official**: ${info.relations.official.join(", ")}`);
		info.relations.nonofficial.push(...relationsFormatted.filter(val => !val.official));
		if (info.relations.nonofficial.length) info.relations.strings.push(`**Non-Official**: ${info.relations.nonofficial.join(", ")}`);


		if (embedBold[0]) {
			const embed = new MessageEmbed()
				.setTitle(item.title)
				.setURL(`https://vndb.org/v${item.id}`);
			if (item.image && (!item.image_nsfw || msg.channel.nsfw)) embed.setThumbnail(item.image);

			if (info.desc.length) embed.setDescription(info.desc.join("\n").trim());
			if (info.general.length) embed.addField("General Info", `• ${info.general.join("\n• ")}`, true);
			embed.addField("User Statistics", `• ${info.stats.join("\n• ")}`, true);

			if (info.relations.strings.length) embed.addField("Relations", info.relations.strings.join("\n"));

			const links = [];
			if (item.links.wikidata) {
				const wikidata = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&ids=${item.links.wikidata}`).then(res => res.json());
				const type = wikidata.entities[item.links.wikidata].sitelinks.enwiki ? "en" : "ja";
				if (wikidata.success && wikidata.entities[item.links.wikidata].sitelinks[`${type}wiki`]) {
					links.push(`[${type === "en" ? "English" : "Japanese"} Wikpedia](https://${type}.wikipedia.org/wiki/${
						encodeURIComponent(wikidata.entities[item.links.wikidata].sitelinks[`${type}wiki`].title)
					})`);
				}
				links.push(`[Wikidata](https://www.wikidata.org/wiki/${item.links.wikidata})`);
			}
			if (item.links.renai) links.push(`[Ren'Ai](https://renai.us/game/${item.links.renai})`);
			if (links.length) embed.addField("Related Links", links.join(" - "));

			return msg.send(embed);
		}

		let block = `**${item.title}** <https://vndb.org/v${item.id}>\`\`\`md\n`;
		if (info.desc.length) block += info.desc.join("\n").trim();
		if (info.general.length) {
			block += `\n/* General Info *
<${info.general.join(">\n<")}>`;
		}
		block += `\n/* User Statistics *
<${info.stats.join(">\n<")}>`;
		if (info.relations.strings.length) {
			block += `\n/* Relations *
${info.relations.strings.join("\n")}`;
		}
		block += "\n```";

		return msg.send(block);
	}

	length = [
		"of unknown length",
		"very short (< 2 hours)",
		"short (2 - 10 hours)",
		"of medium length (10 - 30 hours)",
		"long (30 - 50 hours)",
		"very long (> 50 hours)"
	]

	platformsEmojis = {
		win: "<:win:708184664795250812>",
		lin: "<:lin:708185121307492363>",
		mac: "<:mac:708185908402454528>",
		web: "<:web:708193760500252682>",
		ios: "<:ios:708194634802921502>",
		and: "<:and:708195209560850452>",
		bdp: "<:bdp:708196197869027339>",
		dos: "<:dos:708196427930533908>",
		dvd: "<:dvd:708196650388029470>",
		drc: "<:drc:708198136824332288>",
		nes: "<:nes:708199179964645387>",
		fmt: "<:fmt:708201779904512010>",
		gba: "<:gba:708203603143163965>",
		gbc: "<:gbc:708254542583824394>",
		msx: "<:msx:708218136507187211>",
		nds: "<:nds:708274777592168489>",
		swi: "<:swi:708254315965579295>",
		wii: "<:wii:708254905806225440>",
		wiu: "<:wiu:708255324225929217>",
		n3d: "<:3ds:708273125946556436>",
		p88: "<:p88:708256332876218468>",
		p98: "<:p98:708256714117611562>",
		pce: "<:pce:708257775096037386>",
		pcf: "<:pcf:708258276965482587>",
		psp: "<:psp:708268364564267078>",
		ps1: "<:ps1:708259869777461260>",
		ps2: "<:ps2:708268966589759498>",
		ps3: "<:ps3:708269379405742100>",
		ps4: "<:ps4:708269586113626162>",
		psv: "<:psv:708269843849281539>",
		sat: "<:sat:708259672804819005>",
		sfc: "<:sfc:708260198896107540>",
		x68: "<:x68:708260704934953000>",
		xb1: "<:xb1:708270625915142194>",
		xb3: "<:xb3:708262633714745405>",
		xbo: "<:xbo:708271013087150130>",
		oth: "❔"
	}

	platforms = {
		win: "Windows",
		lin: "Linux",
		mac: "Mac OS X",
		web: "Web",
		ios: "iOS",
		and: "Android",
		bdp: "Blu-ray Player",
		dos: "DOS",
		dvd: "DVD",
		drc: "Dreamcast",
		nes: "NES",
		fmt: "FM Towns",
		gba: "GB Advance",
		gbc: "GB Color",
		msx: "MSX",
		nds: "DS",
		swi: "Switch",
		wii: "Wii",
		wiu: "Wii U",
		n3d: "3DS",
		p88: "PC-88",
		p98: "PC-98",
		pce: "PC-Engine",
		pcf: "PC-FX",
		psp: "PSP",
		ps1: "PS1",
		ps2: "PS2",
		ps3: "PS3",
		ps4: "PS4",
		psv: "PSP Vita",
		sat: "Sega Saturn",
		sfc: "SNES",
		x68: "x68000",
		xb1: "XBOX",
		xb3: "Xbox 360",
		xbo: "Xbox One",
		oth: "Other"
	}

};

function convertReleaseDate(release) {
	if (release === "tba") return Date.now() + 3.6e+6;
	const date = [new Date().getFullYear() + 1, 1, 1];
	release.split("-").forEach((val, i) => { date[i] = parseInt(val); });
	date[1] -= 1;
	return new Date(...date).valueOf();
}

// Regexp hell for nice embeds
function convertFormatting(string) {
	// Escape all $ signs because we use them
	string = string.replace(/\$/g, "$\\");
	// Get all raws and delete them
	const [...raws] = string.matchAll(/\[raw\](.+)\[\/raw\]/g) || [];
	raws.forEach((raw, i) => {
		string = string.replace(`[raw]${raw[1]}[/raw]`, `\${${i}}`);
	});
	// Get all code blocks and delete them
	const [...codes] = string.matchAll(/\[code\](.+)\[\/code\]/g) || [];
	codes.forEach((code, i) => {
		string = string.replace(`[code]${code[1]}[/code]`, `$[${i}]`);
	});
	return string
		.replace(/[cdprsuv]\d+(.\d+)?/g, "[$&](https://vndb.org/$&)")
		.replace(/\[url=(.+)\](.+)\[\/url\]/g, (match, url, text) => {
			if (url.startsWith("/")) url = `https://vndb.org${url}`;
			return `[${text}](${url})`;
		})
		.replace(/\[spoiler\](.+)\[\/spoiler\]/g, "||$1||")
		.replace(/\[quote\](.+)\[\/quote\]/g, "``$1``")
		.replace(/\$\[(\d+)\]/g, (match, index) => `\`\`\`${codes[index][1]}\`\`\``)
		.replace(/\${(\d+)}/g, (match, index) => raws[index][1])
		.replace(/\$\\/g, "$");
}
