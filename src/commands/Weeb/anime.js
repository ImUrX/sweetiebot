const util = require("../../lib/util/util");
const fetch = require("node-fetch");
const { Command, TextPrompt, Usage, RichDisplay } = require("klasa");
const { MessageEmbed } = require("discord.js");
const {
	animeQuery, animeSearch, staffQuery,
	characterQuery, reviewQuery, recQuery
} = require("../../queries/anilist");

const url = "https://graphql.anilist.co",
	options = {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json"
		}
	};

module.exports = class extends Command {

	constructor(...args) {
		super(...args, {
			cooldown: 10,
			aliases: ["japanesecartoon"],
			description: "Searches for the japanese cartoon that you gave as an argument",
			usage: "<anime:str{3}>",
			extendedHelp: `Note: Everything is ordered by popularity
Flags:
	--opt: Gives you options instead of giving first result
	--plain: Gives a code block instead of an embed
	--trailer: Passes the trailer
	--chars: Returns characters
	--staff: Returns staff
	--reviews: Returns reviews
	--recs: Returns recommendations`
		});
	}

	format = {
		TV: "TV Show",
		TV_SHORT: "TV Short",
		MOVIE: "Movie",
		SPECIAL: "Special",
		OVA: "OVA",
		ONA: "ONA",
		MUSIC: "Music Video"
	}
	season = {
		WINTER: "Winter",
		SPRING: "Spring",
		SUMMER: "Summer",
		FALL: "Fall"
	}
	status = {
		FINISHED: "a **finished**",
		RELEASING: "a currently releasing",
		CANCELLED: "a __cancelled__",
		NOT_YET_RELEASED: "an *unreleased*"
	}
	source = {
		ORIGINAL: "Original",
		MANGA: "Manga",
		LIGHT_NOVEL: "Light Novel",
		VISUAL_NOVEL: "Visual Novel",
		VIDEO_GAME: "Video Game",
		OTHER: "Other",
		NOVEL: "Novel",
		DOUJINSHI: "Doujinshi",
		ANIME: "Anime"
	}

	async run(msg, [searchStr]) {
		const sending = await msg.send("Searching for anime in AniList..."),
			embedBold = Array(3).fill(msg.channel.embedable && !msg.flagArgs.plain ? "**" : "");
		embedBold.toString = () => embedBold.join("");
		embedBold.put = value => {
			embedBold[1] = value; return embedBold;
		};

		let id;
		if(msg.flagArgs.opt) id = await this.options(msg, searchStr, sending);
		const variables = {
			reaction: msg.channel.enrichable && !msg.flagArgs.plain,
			searchStr, id
		};
		if(await this.handleFlags(msg, variables, embedBold)) return true;
		const { data } = await queryAnilist(animeQuery, variables);

		if(data.error) {
			this.client.emit("error", data.error);
			return msg.send("An error related with GQL happened");
		}
		const { Media } = data;
		if(!Media) return msg.send(`No results found ${util.randomSadEmoji()}`);
		if(msg.flagArgs.trailer) {
			if(Media.trailer) {
				return msg.send(getVideoLink(Media));
			}
			return msg.send(`This anime doesn't have a trailer (or AniList hasn't added it) ${util.randomSadEmoji()}`);
		}
		if(Media.isAdult && !msg.channel.nsfw) return msg.send("The anime you asked for is NSFW!");

		// Can be used in both (embed and plain)
		const info = {
			description: `${formatTitles(Media, embedBold)}

${Media.description ? util.shortify(util.convertHtmlToMd(Media.description), 250) : ""}`,
			general: this.generateGeneral(Media, embedBold),
			stats: [
				`${embedBold.put("Popularity")}: ${Media.popularity}`,
				`${embedBold.put("Favourites")}: ${Media.favourites}`
			],
			genres: Media.genres.join(" - "),
			relations: formatRelations(Media, embedBold)
		};
		if(Media.averageScore) {
			info.stats.push(
				`${embedBold.put("Average Score")}: ${Media.averageScore}%`,
				`${embedBold.put("Mean Score")}: ${Media.meanScore}%`
			);
		}

		if(embedBold[0]) {
			const embed = new MessageEmbed()
				.setTitle(Media.title.romaji)
				.setURL(Media.siteUrl)
				.setDescription(info.description)
				.setThumbnail(Media.coverImage.large)
				.setColor(Media.coverImage.color || util.randomColor());

			embed.addField("General Info", `• ${info.general.join("\n• ")}`, true);

			embed.addField("User Statistics", `• ${info.stats.join("\n• ")}`, true);

			embed.addField("Genres", info.genres);
			if(info.relations.length) embed.addField("Relations", info.relations.join(" - "));
			const links = formatLinks(Media);
			if(links) embed.addField("Related Links", links);

			if(variables.reaction) {
				const displays = [
					embed,
					this.generateCharacters(Media, embedBold),
					this.generateStaff(Media, embedBold),
					this.generateReviews(Media, embedBold),
					this.generateRecommendations(Media, embedBold)
				].filter(val => val);
				if(displays.length > 1) {
					const display = new RichDisplay();
					display.addPages(...displays);
					msg.responses[msg.responses.length - 1].delete();
					return display.run(msg, { time: 120000 });
				}
			}
			return msg.send(embed);
		}

		return msg.send(`**About ${Media.title.romaji}** <${Media.siteUrl}>:\`\`\`md
${util.removeMdLinks(info.description)}
/* General Info: *
* ${info.general.join("\n* ")}
* <Genres: ${info.genres}>${info.relations.length ? `
* Relations: ${info.relations.join(" - ")}` : ""}
# ${info.stats.join(" # ")} #\`\`\`${Media.trailer ? `Trailer: <${getVideoLink(Media)}>` : ""}`);
	}

	async options(msg, searchStr, sending) {
		const { data: { Page } } = await queryAnilist(animeSearch, { searchStr });
		if(Page.media.length === 0) {
			throw `Couldn't find anything related to such search term ${util.randomSadEmoji()}`;
		}

		const prompt = new TextPrompt(
			msg,
			new Usage(this.client, `<option:int{1,${Page.media.length}}>`, "")
		);

		let question = "```md\n\t\t\t\tSearch results";
		for(let i = 0; i < Page.media.length; i++) {
			question += `\n[${i + 1}]( ${Page.media[i].title.romaji} )`;
		}
		question += "```To choose an option, reply with the number of the option.";

		(await sending).delete();
		const [fakeIndex] = await prompt.run(question);
		if(Page.media[fakeIndex - 1].isAdult && !msg.channel.nsfw) throw "The anime you asked for is NSFW!";
		await msg.send("Getting the specified anime...");
		return Page.media[fakeIndex - 1].id;
	}

	async handleFlags(msg, variables, embedBold) {
		let query, func, type;
		const changedVariables = {
			id: variables.id,
			searchStr: variables.searchStr
		};

		if(msg.flagArgs.staff) {
			type = "staff";
			changedVariables.amount = variables.reaction ? 15 : 3;
			query = staffQuery;
			func = this.generateStaff;
		} else if(msg.flagArgs.chars) {
			type = "characters";
			changedVariables.amount = variables.reaction ? 15 : 3;
			query = characterQuery;
			func = this.generateCharacters;
		} else if(msg.flagArgs.reviews) {
			type = "reviews";
			changedVariables.amount = variables.reaction ? 25 : 5;
			query = reviewQuery;
			func = this.generateReviews;
		} else if(msg.flagArgs.recs) {
			type = "recommendations";
			changedVariables.amount = variables.reaction ? 25 : 5;
			query = recQuery;
			func = this.generateRecommendations;
		} else{
			return false;
		}

		const { data } = await queryAnilist(query, changedVariables);
		if(data.error) {
			this.client.emit("error", data.error);
			return msg.send("An error related with GQL happened");
		}
		const { Media } = data;
		if(!Media) return msg.send(`No results found ${util.randomSadEmoji()}`);
		if(Media.isAdult && !msg.channel.nsfw) return msg.send("The anime you asked for is NSFW!");

		const reply = func(Media, embedBold);
		if(!reply) return msg.send(`No ${type} found ${util.randomSadEmoji()}`);
		if(Array.isArray(reply)) {
			msg.responses[msg.responses.length - 1].delete();
			return new RichDisplay()
				.addPages(...reply)
				.run(msg, { time: 120000 });
		}
		return msg.send(reply);
	}

	generateGeneral(media, embedBold) {
		const general = [
				`This is ${this.status[media.status]} ${this.format[media.format]}`,
				formatStatus(media),
				formatEpisodes(media, embedBold)
			],
			studios = media.studios.nodes.map(
				embedBold[0] ? studio => `[${studio.name}](${studio.siteUrl})` : studio => studio.name
			);

		if(studios.length) {
			general.push(`${
				embedBold.put(`Main Studio${studios.length > 1 ? "s" : ""}`)
			}: ${studios.join(" - ")}`);
		}

		if(media.season) {
			let str = `${embedBold.put("Season")}: ${this.season[media.season]} ${media.seasonYear}`;
			if(!embedBold[0]) {
				str = `<${str}>`;
			}
			general.push(str);
		}
		{
			let str = `${embedBold.put("Source")}: ${this.source[media.source]}`;
			if(!embedBold[0]) {
				str = `<${str}>`;
			}
			general.push(str);
		}
		return general;
	}

	generateStaff({ staff: { nodes, edges }, id, title, siteUrl, coverImage }, embedBold) {
		if(!nodes.length) return null;
		const info = {
			title: `Staff that worked on ${title.romaji}`,
			working: unionArrayElem(nodes.map((staff, index) => ({
				...staff,
				strings: [`${embedBold.put(edges[index].role)}`]
			}))),
			union: []
		};

		for(let i = 0; i < info.working.length; i++) {
			const staff = info.working[i];

			info.union.push(unionArrayElem([
				{
					strings: staff.strings,
					anime: "this anime", id
				},
				...staff.characters.nodes.map(anime => {
					const string = Object.values(anime.name).join("/"), name = anime.media.nodes[0].title.romaji;
					return {
						strings: [embedBold[0] ? `[${string}](${anime.siteUrl})` : string],
						id: anime.media.nodes[0].id,
						anime: embedBold[0] ? `[${name}](${anime.media.nodes[0].siteUrl})` : name,
						va: true
					};
				}),
				...staff.staffMedia.nodes.map((anime, index) => ({
					strings: [`${embedBold.put(staff.staffMedia.edges[index].staffRole)}`],
					id: anime.id,
					anime: embedBold[0] ? `[${anime.title.romaji}](${anime.siteUrl})` : anime.title.romaji
				}))
			]));
		}

		if(embedBold[0]) {
			const temp = new MessageEmbed()
				.setTitle(info.title)
				.setURL(siteUrl)
				.setThumbnail(nodes[0].image.large || coverImage.large);
			const embeds = [];
			let embed = new MessageEmbed(temp);

			for(let i = 0; i < info.union.length; i++) {
				if(i && i % 3 === 0) {
					embeds.push(embed);
					embed = new MessageEmbed(temp);
				}

				const staff = info.working[i], array = [
					"__Mostly known for__:",
					...info.union[i].map(
						roles => `•${roles.va ? " Worked as" : ""} ${roles.strings.join(", ")} on ${roles.anime}`
					),
					`**[Check out their page](${staff.siteUrl})** || Favourites: ${staff.favourites}`
				];
				embed.addField(Object.values(staff.name).join("/"), array.join("\n"));
			}
			if(embed.fields.length) embeds.push(embed);

			return embeds.length > 1 ? embeds : embeds[0];
		}

		let block = `**${info.title}**:\`\`\`md\n`;
		block += info.working.map((staff, index) => {
			const staffNames = Object.values(staff.name);
			return`[${staffNames[0]}](${staffNames[1] || ""})
Mostly known for:
${
	info.union[index].map(
		roles => `*${roles.va ? " Worked as" : ""} ${roles.strings.join(", ")} on ${roles.anime}`
	).join("\n")
}
<Favourites: ${staff.favourites}>`;
		}).join("\n\n");
		block += "```";

		return block;
	}

	generateCharacters({ characters: { nodes }, title, siteUrl, coverImage }, embedBold) {
		if(!nodes.length) return null;
		const info = {
			title: `Character${nodes.length > 1 ? "s" : ""} on ${title.romaji}`,
			descriptions: nodes.map(char =>
				char.description ? `${util.shortify(util.convertHtmlToMd(char.description), 300).trim()}\n` : ""
			)
		};

		if(embedBold[0]) {
			const temp = new MessageEmbed()
				.setTitle(info.title)
				.setURL(siteUrl)
				.setThumbnail(nodes[0].image.large || coverImage.large);
			const embeds = [];
			let embed = new MessageEmbed(temp);

			for(let i = 0; i < nodes.length; i++) {
				if(i && i % 3 === 0) {
					embeds.push(embed);
					embed = new MessageEmbed(temp);
				}

				const char = nodes[i];
				embed.addField(
					`${char.name.full}/${char.name.native}`,
					`${info.descriptions[i]}[Check the character out](${char.siteUrl}) || **Favourites**: ${char.favourites}`
				);
			}
			if(embed.fields.length) embeds.push(embed);

			return embeds.length > 1 ? embeds : embeds[0];
		}

		let block = `**${info.title}**:\`\`\`md\n`;
		block += nodes.map((char, index) =>
			`[${char.name.full}](${char.name.native})
${util.removeMdLinks(info.descriptions[index]).trim()}
<Favourites: ${char.favourites}>`
		).join("\n\n");
		block += "```";

		return block;
	}

	generateReviews({ reviews: { nodes }, title, siteUrl, coverImage }, embedBold) {
		if(!nodes.length) return null;
		title = `Review${nodes.length > 1 ? "s" : ""} on ${title.romaji}`;

		if(embedBold[0]) {
			const temp = new MessageEmbed()
				.setTitle(title)
				.setURL(siteUrl)
				.setThumbnail(coverImage.large);
			const embeds = [];
			let embed = new MessageEmbed(temp);

			for(let i = 0; i < nodes.length; i++) {
				if(i && i % 5 === 0) {
					embeds.push(embed);
					embed = new MessageEmbed(temp);
				}

				const review = nodes[i];
				embed.addField(review.user.name, `${review.summary}
	[See the full review](https://anilist.co/review/${review.id}) |\\| **Score**: ${review.score}/100 |\\| **Likes**: ${review.rating}`);
			}
			if(embed.fields.length) embeds.push(embed);

			return embeds.length > 1 ? embeds : embeds[0];
		}

		let block = `**${title}**:\`\`\`md\n`;
		block += nodes.map(rev =>
			`# ${rev.user.name}
${util.removeMdLinks(rev.summary).trim()}
<Score: ${rev.score}/100> <Likes: ${rev.rating}>`
		).join("\n\n");
		block += "```";
		return block;
	}

	generateRecommendations({ recommendations: { nodes }, title, siteUrl, coverImage }, embedBold) {
		if(!nodes.length) return null;
		title = `Recommendation${nodes.length > 1 ? "s" : ""} if you liked ${title.romaji}`;

		if(embedBold[0]) {
			const temp = new MessageEmbed()
				.setTitle(title)
				.setURL(siteUrl)
				.setThumbnail(coverImage.large);
			const embeds = [];
			let embed = new MessageEmbed(temp);
			for(let i = 0; i < nodes.length; i++) {
				if(i && i % 5 === 0) {
					embeds.push(embed);
					embed = new MessageEmbed(temp);
				}

				const rec = nodes[i];
				embed.addField(rec.user.name, `[${rec.mediaRecommendation.title.romaji}](${rec.mediaRecommendation.siteUrl}) || Likes: ${rec.rating}`);
			}
			if(embed.fields.length) embeds.push(embed);

			return embeds.length > 1 ? embeds : embeds[0];
		}

		let block = `**${title}**:\`\`\`md\n`;
		block += nodes.map(rec =>
			`# ${rec.user.name}
${rec.mediaRecommendation.title.romaji}
<Likes: ${rec.rating}>`
		).join("\n");
		block += "```";
		return block;
	}

};

function queryAnilist(query, variables) {
	return fetch(url, {
		...options,
		body: JSON.stringify({
			query, variables
		})
	}).then(res => res.json());
}

function formatStatus(media) {
	if(media.status === "NOT_YET_RELEASED") {
		return`Release ${media.startDate.year ? `is planned ${media.startDate.day ? "on" : "around"} ${convertFuzzyDate(media.startDate)}` : " is currently unknown"}`;
	} else if(media.status === "RELEASING") {
		return`It started releasing ${media.startDate.day ? "on" : "around"} ${convertFuzzyDate(media.startDate)}`;
	}
	if(JSON.stringify(media.startDate) === JSON.stringify(media.endDate)) {
		return`Released on ${convertFuzzyDate(media.endDate)}`;
	}
	return`Released from ${convertFuzzyDate(media.startDate)} to ${convertFuzzyDate(media.endDate)}`;
}

function formatEpisodes(media, embedBold) {
	if(media.episodes) {
		const str = {};
		if(media.duration) {
			str.title = "Episodes/Duration";
			str.desc = `${media.episodes}/${util.readableTime(`${media.duration}m`)}${
				media.episodes > 1 ? ` (${util.readableTime(`${media.duration * media.episodes}m`)})` : ""
			}`;
		} else{
			str.title = "Episodes";
			str.desc = media.episodes;
		}
		return`${embedBold.put(str.title)}: ${str.desc}`;
	}
	return"";
}

function formatLinks(media) {
	const links = [];
	if(media.trailer) {
		links.push(`[Trailer](${getVideoLink(media)})`);
	}
	if(media.idMal) {
		links.push(`[MAL](https://myanimelist.net/anime/${media.idMal})`);
	}

	links.push(...media.externalLinks.map(link => `[${link.site}](${link.url})`));

	return links.join(" - ");
}

function formatTitles(media, embedBold) {
	const titles = [`${embedBold[0] ? "**Native Title**" : "<Native Title>"}: ${media.title.native}`];

	if(media.title.english) {
		titles.push(`${embedBold[0] ? "**English Title**" : "<English Title>"}: ${media.title.english}`);
	}
	return titles.join("\n");
}

const relation = {
	ADAPTATION: "Adapted from this",
	PREQUEL: "Prequel",
	SEQUEL: "Sequel",
	PARENT: "Parent",
	SIDE_STORY: "Side story",
	CHARACTER: "Shares character",
	SUMMARY: "Summary",
	ALTERNATIVE: "Alternative",
	SPIN_OFF: "Spin-off",
	OTHER: "Other",
	SOURCE: "Source",
	COMPILATION: "Compilation",
	CONTAINS: "Contains"
};
function formatRelations({ relations: { nodes, edges } }, embedBold) {
	return nodes.map(embedBold[0] ?
		(val, index) => `[${val.title.romaji}](${val.siteUrl}) (${relation[edges[index].relationType]})` :
		(val, index) => `${val.title.romaji} (${relation[edges[index].relationType]})`
	);
}

function getVideoLink({ trailer }) {
	return`${trailer.site === "youtube" ? "https://www.youtube.com/watch?v=" : "https://www.dailymotion.com/video/"}${trailer.id}`;
}

function unionArrayElem(arr) {
	for(let i = 0; i < arr.length; i++) {
		const cur = arr[i];
		if(cur.ignore) continue;
		arr.forEach((other, index) => {
			if(other.id !== cur.id || index === i || other.ignore) return;
			if(cur.strings.includes(other.strings[0])) {
				other.ignore = true;
				return;
			}
			if(other.va) cur.va = true;
			other.ignore = true;
			cur.strings.push(...other.strings);
		});
	}
	return arr.filter(elem => !elem.ignore);
}

function convertFuzzyDate(date) {
	if(!date.year) return"";
	let str = "";
	str += date.year;
	str += date.month ? `/${date.month > 9 ? date.month : `0${date.month}`}` : "";
	str += date.day ? `/${date.day > 9 ? date.day : `0${date.day}`}` : "";
	return str;
}
