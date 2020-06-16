const { Command, TextPrompt, Usage } = require("klasa");
const { MessageEmbed, MessageAttachment } = require("discord.js");
const fetch = require("node-fetch");
const util = require("../../lib/util/util");
const { wolfram } = require("../../../auth.json");

module.exports = class TellCommand extends Command {

	constructor(...args) {
		super(...args, {
			cooldown: 20,
			aliases: ["wolfram"],
			description: "Uses Wolfram to answer the question",
			usage: "<question:str>",
			extendedHelp: `Flags:
	--interpret: gives you how Wolfram interpreted input
	--plain: gives a plain text instead of an image`
		});
	}

	async run(msg, [text]) {
		const sending = msg.send("Asking Wolfram...");
		const { queryresult } = await fetch(
			`https://api.wolframalpha.com/v2/query?input=${
				// `${msg.commandText === "tell" ? "tell " : ""}${text}`
				encodeURIComponent(text)
			}&appid=${wolfram}&output=json`
		).then(res => res.json());
		const sent = await sending;
		let answer = "";

		if (queryresult.error) {
			this.client.emit("error", queryresult);
			return sent.edit("An error happened...");
		}

		if (!queryresult.success) {
			if (queryresult.didyoumeans) {
				answer += "Did you mean ";
				if (queryresult.didyoumeans.length) {
					const didyoumeans = queryresult.didyoumeans.map(mean => mean.val);
					const pop = didyoumeans.pop();
					answer += `${didyoumeans.join(", ")} or ${pop}`;
				} else {
					answer += queryresult.didyoumeans.val;
				}
			} else if (queryresult.tips) {
				const tip = queryresult.tips.length ? queryresult.tips[0].text : queryresult.tips.text;
				answer += tip;
			} else {
				answer += `Sorry, couldn't find an answer to your question ${util.randomSadEmoji()}`;
			}
			return sent.edit(answer);
		}

		if (queryresult.warnings) {
			if (queryresult.warnings.length) {
				for (const { text: str } of queryresult.warnings) {
					answer += `\n${str}`;
				}
			} else {
				answer += queryresult.warnings.text;
			}
		}

		if (queryresult.assumptions) {
			answer += `\nThinking ${text} is ${
				queryresult.assumptions.length ? queryresult.assumptions[0].values[0].desc : queryresult.assumptions.values[0].desc
			}`;
		}

		if (msg.flagArgs.interpret) {
			sent.delete();
			return TellCommand.sendPod(msg, queryresult.pods[0], answer);
		}
		if (queryresult.pods.length < 3) {
			sent.delete();
			return TellCommand.sendPod(msg, queryresult.pods[queryresult.pods.length - 1], answer);
		}

		const prompt = new TextPrompt(
			msg,
			new Usage(this.client, `<option:int{1,${queryresult.pods.length - 1}}>`, ""),
			{ limit: 1 }
		);

		let question = `${answer}\`\`\`md\n\t\t\t\tCurrent options for ${queryresult.pods[0].subpods[0].plaintext}`;
		for (let i = 1; i < queryresult.pods.length; i++) {
			question += `\n[${i}]( ${queryresult.pods[i].title} )`;
		}
		question += "```To choose an option, reply with the number of the option.";
		sent.delete();
		const [index] = await prompt.run(question);
		return TellCommand.sendPod(msg, queryresult.pods[index], "");
	}

	static async sendPod(msg, pod, answer) {
		const [subpod] = pod.subpods;
		if (msg.flagArgs.plain || (subpod.plaintext && !isNaN(subpod.plaintext))) {
			if (!subpod.plaintext) {
				return msg.channel.send("There is no plain text...");
			}
			answer += `**${pod.title}**:`;
			if (subpod.plaintext.length > 200) {
				const gist = await util.uploadGist(subpod.plaintext);
				answer += ` <${gist.html_url}>`;
			} else {
				answer += `\`\`\`${subpod.plaintext}\`\`\``;
			}
			return msg.channel.send(answer.trim());
		}

		if (msg.channel.embedable) {
			const attachment = new MessageAttachment(await fetch(subpod.img.src).then(res => res.body), "file.png");
			const embed = new MessageEmbed()
				.setTitle(pod.title)
				.attachFiles([attachment])
				.setImage("attachment://file.png")
				.setColor([Math.floor(Math.random() * 255), 0, 0]);
			return msg.channel.send(answer.trim(), embed);
		}

		answer += `\n**${pod.title}**:`;
		if (subpod.plaintext && !msg.channel.attachable) {
			if (subpod.plaintext.length > 200) {
				const gist = await util.uploadGist(subpod.plaintext);
				answer += ` <${gist.html_url}>`;
			} else {
				answer += `\`\`\`${subpod.plaintext}\`\`\``;
			}
		} else {
			answer += `\n${subpod.img.alt}`;
		}
		return msg.channel.send(answer.trim(), msg.channel.attachable ? { files: [
			await fetch(subpod.plaintext.img.src).then(res => res.buffer())
		] } : {});
	}

};
