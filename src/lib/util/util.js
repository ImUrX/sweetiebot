const fetch = require("node-fetch");
const sharp = require("sharp");
const he = require("he");
const FormData = require("form-data");
const { kawaii } = require("../../../auth.json");
const { Duration } = require("klasa");

class Util {

	/**
	 * A Map with magic numbers of supported images for sharp
	 * @type {Map<string,string>}
	 */
	static magic = new Map(
		[
			["ffd8ffe0", "jpeg"],
			["ffd8ffdb", "jpeg"],
			["ffd8ffe1", "jpeg"],
			["89504e47", "png"],
			["52494646", "webp"],
			["49492a00", "tiff"],
			["4d4d002a", "tiff"],
			["47494638", "gif"]
		]
	);

	/**
	 * An array with sad emojis (˃w˂)
	 */
	static sadEmojis = [
		":c", ":/", ";-;", "T-T", "（´＿｀）", ":<",
		"（; ;）", "((´д｀))", "sad emoji", "¯\\_(ツ)_/¯",
		"\\:", "ɔ:", "(╯︵╰,)", ">:", ":p", "q:",
		"iįomɘ bɒƨ", "im out of ideas", ":(", "😖"
	]

	constructor() {
		throw "This is an static class :P";
	}

	/**
	 * gives you a sad emoji
	 * @returns {string}
	 */
	static randomSadEmoji() {
		return this.sadEmojis[
			Math.floor(Math.random() * this.sadEmojis.length)
		];
	}

	/**
	 * Makes your temporal url image or buffer to a kawaii URL
	 * @param {string|Buffer} img temporal url that returns an image or buffer
	 * @param {boolean=} notGif Don't upload as a gif if it is one (default false)
	 * @returns {Promise<string>}
	 * @static
	 */
	static async getKawaiiLink(img, notGif = false) {
		const form = new FormData();
		form.append("uploadFile", await Util.getBuffer(img, notGif), { filename: "test.png" });

		const data = await fetch("https://kawaii.sh/api/files/upload", {
			method: "POST", body: form,
			headers: form.getHeaders({ token: kawaii })
		}).then(res => res.json());

		if (!data.url) {
			throw data;
		}

		return data.url;
	}

	/**
	 * Gives the filename from a kawaii image
	 * @param {string} url The url of the image
	 * @returns {string}
	 */
	static grabIdFromKawaii(url) {
		return url.substring(20);
	}

	/**
	 * Converts your URL/Image to a buffer
	 * @param {string|Buffer} img Link to the image or maybe buffer
	 * @param {boolean=} notGif Conver to normal image instead of animated
	 * @returns {Promise<Buffer>}
	 * @static
	 */
	static async getBuffer(img, notGif = false) {
		let buffer = Buffer.isBuffer(img) ? img : await fetch(img).then(res => res.buffer());
		const type = Util.getImageType(buffer);

		if (!type) throw "This isn't an image";
		if (type === "gif" && notGif) buffer = await sharp(buffer).toBuffer();
		return buffer;
	}

	/**
	 * Uploads the text to GitHub Gists and returns the response
	 * @param {string} content The content of the gist
	 * @returns {Promise<Object>}
	 * @static
	 */
	static async uploadGist(content) {
		return fetch("https://api.github.com/gists", {
			method: "POST",
			body: JSON.stringify({ files: {
				"plain.txt": { content }
			} })
		}).then(res => res.json());
	}

	/**
	 * Tells you the type of image it is
	 * @param {Buffer} buffer Image
	 * @returns {string|null}
	 * @static
	 */
	static getImageType(buffer) {
		if (Buffer.isBuffer(buffer)) {
			const type = Util.magic.get(buffer.toString("hex", 0, 4));
			return type || null;
		}
		return null;
	}

	/**
	 * Converts Simple HTML to Markdown
	 * @param {string} html The HTML for conversion
	 * @returns {string}
	 * @static
	 */
	static convertHtmlToMd(html) {
		return he.decode(html
			.replace(/<br>(\\n)?/g, "\n")
			.replace(/<\/?(em|i)>/g, "*")
			.replace(/<\/?strong>/g, "**")
			.replace(/\n{3,}/g, "\n\n")
		);
	}

	/**
	 * Replaces Markdown links for their normal text
	 * @param {string} md The markdown string
	 * @returns {string}
	 */
	static removeMdLinks(md) {
		return md.replace(/\[(.*?)\]\(.*?\)/g, "$1");
	}

	/**
	 * Shortens the text to the specified limit
	 * @param {string} text The text to shortify
	 * @param {number=} limit The lenght limit (Unlimited if it's 0)
	 * @returns {string}
	 * @static
	 */
	static shortify(text, limit = 0) {
		if (limit && text.length <= limit) return text;

		let paragraph = text.match(/((?:.|\n)+?\.)( +)?\n/g);
		paragraph = paragraph ? paragraph[0] : text;
		return limit ? `${paragraph.substring(0, limit - 4)}...` : paragraph;
	}

	/**
	 * Returns a random RGB array
	 * @returns {number[]}
	 * @static
	 */
	static randomColor() {
		const rgb = [];
		for (let i = 0; i < 3; i++) {
			rgb.push(Math.floor(Math.random() * 256));
		}
		return rgb;
	}

	static readableTime(time) {
	// But unreadable code
		let { offset } = new Duration(time.toString());
		offset /= 1000;
		const years = Math.floor(offset / 3.154e+7);
		offset %= 3.154e+7;
		const months = Math.floor(offset / 2.628e+6);
		offset %= 2.628e+6;
		const days = Math.floor(offset / 86400);
		offset %= 86400;
		const hours = Math.floor(offset / 3600);
		offset %= 3600;
		const minutes = Math.floor(offset / 60);
		offset %= 60;

		return `${years > 0 ? `${years}y` : ""}${
			months > 0 ? `${months}mo` : ""}${
			days > 0 ? `${days}d ` : ""}${
			hours > 0 ? `${hours}h` : ""}${
			minutes > 0 ? `${minutes}m` : ""}${
			offset > 0 ? `${offset}s` : ""}`;
	}

}

module.exports = Util;
