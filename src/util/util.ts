import fetch from "node-fetch";
import sharp from "sharp";
import he from "he";
import FormData from "form-data";
import auth from "../../auth.json" assert { type: "json" };
import moment from "moment";
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
		headers: form.getHeaders({ token: auth.kawaii })
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
	let buffer = Buffer.isBuffer(img) ? img : Buffer.from(await fetch(img).then(res => res.arrayBuffer()));

	if(notGif) buffer = await sharp(buffer).toBuffer();
	return buffer;
}

export async function censorImage(img: Buffer): Promise<Buffer> {
	const metadata = await sharp(img).metadata();
	const smol = await sharp(img)
		.resize(18, null, { kernel: sharp.kernel.nearest })
		.toBuffer();
	return sharp(smol)
		.resize({
			width: metadata.width,
			kernel: sharp.kernel.nearest
		})
		.toBuffer();
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
			Authorization: `token ${auth.gist}`,
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
	const hsv: [number, number, number] = [
		Math.floor(Math.random() * 361),
		Math.min((Math.random() * 0.26 + 0.75), 1),
		Math.random()
	];
	return hsvToRgb(...hsv);
}

export function hsvToRgb(hue: number, saturation: number, value: number): [number, number, number] {
	const chroma = saturation * value;
	const hueM = hue/60;
	const x = chroma * (1 - Math.abs((hueM % 2) - 1));
	let base: [number, number, number];
	switch(Math.trunc(hueM)) {
		default:
		case 0:
			base = [chroma, x, 0];
			break;
		case 1:
			base = [x, chroma, 0];
			break;
		case 2:
			base = [0, chroma, x];
			break;
		case 3:
			base = [0, x, chroma];
			break;
		case 4:
			base = [x, 0, chroma];
			break;
		case 5:
			base = [chroma, 0, x];
	}
	const m = value - chroma;
	return [base[0] + m, base[1] + m, base[2] + m];
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function getAllStringsOfObject(obj: object): string[] {
	const arr = [];
	for(const value of Object.values(obj)) {
		if(typeof value === "string") {
			arr.push(value);
			continue;
		}
		if(typeof value === "object" && value !== null) {
			arr.push(...getAllStringsOfObject(value));
		}
	}
	return arr;
} 

const tokens = new RegExp(getAllStringsOfObject(auth).filter(s => s).join("|"), "g");
export function censorTokens(text: string): string {
	return text.replace(tokens, "□");
}

const order: ["hours", "minutes", "seconds"] = ["hours", "minutes", "seconds"];
export function msToTimestamp(ms: number): string {
	const duration = moment.duration(ms);
	const arr = [];
	for(const type of order) {
		if(duration[type]()) {
			arr.push( duration[type]().toString().padStart(2, "0"));
		}
	}
	return arr.join(":");
}
