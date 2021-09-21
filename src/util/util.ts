import fetch from "node-fetch";
import sharp from "sharp";
import he from "he";
import FormData from "form-data";
import { kawaii, gist } from "../../auth.json";
/**
 * A Map with magic numbers of supported images for sharp
 */
export const magic = new Map(
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
export const sadEmojis = [
	":c", ":/", ";-;", "T-T", "（´＿｀）", ":<",
	"（; ;）", "((´д｀))", "sad emoji", "¯\\_(ツ)_/¯",
	"\\:", "ɔ:", "(╯︵╰,)", ">:", ":p", "q:",
	"iįomɘ bɒƨ", "(im out of ideas)", ":(", "😖"
];

/**
 * gives you a sad emoji
 */
export function randomSadEmoji(): string {
	return sadEmojis[
		Math.floor(Math.random() * sadEmojis.length)
	];
}

interface KawaiiUploadData {
	url?: string
}

/**
 * Makes your temporal url image or buffer to a kawaii URL
 */
export async function getKawaiiLink(img: string | Buffer, notGif = false): Promise<string> {
	const form = new FormData();
	form.append("uploadFile", await getBuffer(img, notGif), { filename: "test.png" });

	const data = await fetch("https://kawaii.sh/api/files/upload", {
		method: "POST", body: form,
		headers: form.getHeaders({ token: kawaii })
	}).then(res => res.json() as Promise<KawaiiUploadData>);

	if(data.url) {
		return data.url;
	}
	throw data;
}

/**
 * Gives the filename from a kawaii image
 */
export function grabIdFromKawaii(url: string): string {
	return url.substring(20);
}

/**
 * Converts your URL/Image to a buffer
 */
export async function getBuffer(img: string | Buffer, notGif = false): Promise<Buffer> {
	let buffer = Buffer.isBuffer(img) ? img : await fetch(img).then(res => res.buffer());
	const type = getImageType(buffer);

	if(!type) throw "This isn't an image";
	if(type === "gif" && notGif) buffer = await sharp(buffer).toBuffer();
	return buffer;
}

export interface CreateGistData {
	url: string,
	forks_url: string,
	commits_url: string,
	id: string,
	node_id: string,
	git_pull_url: string,
	git_push_url: string,
	html_url: string,
	created_at: string,
	updated_at: string,
	description: string,
	comments: number,
	comments_url: string
}

/**
 * Uploads the text to GitHub Gists and returns the response
 */
export async function uploadGist(content: string): Promise<CreateGistData>  {
	return fetch("https://api.github.com/gists", {
		method: "POST",
		body: JSON.stringify({ files: {
			"plain.txt": { content }
		} }),
		headers: {
			Authorization: `token ${gist}`,
			"Content-Type": "application/json"
		}
	}).then(res => res.json() as Promise<CreateGistData>);
}

/**
 * Tells you the type of image it is
 */
export function getImageType(buffer: Buffer): string | null {
	if(Buffer.isBuffer(buffer)) {
		const type = magic.get(buffer.toString("hex", 0, 4));
		return type || null;
	}
	return null;
}

/**
 * Converts Simple HTML to Markdown
 */
export function convertHtmlToMd(html: string): string {
	return he.decode(html
		.replace(/<br>(\\n)?/g, "\n")
		.replace(/<\/?(em|i)>/g, "*")
		.replace(/<\/?strong>/g, "**")
		.replace(/\n{3,}/g, "\n\n")
	);
}

/**
 * Replaces Markdown links for their normal text
 */
export function removeMdLinks(md: string): string {
	return md.replace(/\[(.*?)\]\(.*?\)/g, "$1");
}

/**
 * Shortens the text to the specified limit
 */
export function shortify(text: string, limit = 0): string {
	if(limit && text.length <= limit) return text;

	const paragraph = text.match(/((?:.|\n)+?\.)( +)?\n/g);
	const res = paragraph ? paragraph[0] : text;
	return limit ? `${res.substring(0, limit - 4)}...` : res;
}

/**
 * Returns a random RGB array
 */
export function randomColor(): [number, number, number] {
	const rgb: [number, number, number] = [Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), Math.floor(Math.random() * 256)];
	return rgb;
}
