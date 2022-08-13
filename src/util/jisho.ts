import fetch from "node-fetch";
import * as cheerio from "cheerio";

interface TemporaryJishoScrap {
	furigana: string[];
	audio: {
		mp3?: string,
		ogg?: string
	}
}

export async function words(keyword: string): Promise<JishoWord[]> {
	const api = fetch(`https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(keyword)}`)
		.then(async res => {
			const json = await res.json() as JishoResult;
			if(json.data.length === 0) throw new Error("Unexpected end of data in response.");
			if(json.meta.status !== 200) throw new Error("Status code non-successful: " + json.meta.status);
			return json.data;
		});

	const htmlInfo = fetch(`https://jisho.org/search/${keyword}`)
		.then(async res => {
			const data: TemporaryJishoScrap[] = [], $ = cheerio.load(await res.text());
			$("#primary > div").children("div").each(function() {
				const obj: TemporaryJishoScrap = {
						furigana: [],
						audio: {}
					}, word = $(this);

				word.find(".furigana span").each(function() {
					obj.furigana.push($(this).text().trim());
				});
				word.find("source").each(function() {
					const src = $(this).attr("src");
					const [,type] = src?.match(/\.(\w+)$/) ?? [];
					if(!type) return;
					if(type === "mp3" || type === "ogg") {
						obj.audio[type] = `https:${src}`;
						return;
					}
					throw new Error("Unrecognized audio type: " + type);
				});

				data.push(obj);
			});
			return data;
		});
	
	const united = await Promise.all([api, htmlInfo]);
	if(united[0].length > united[1].length) {
		throw new Error(`Length of API is ${united[0].length}\nLength of Scrap is ${united[1].length}`);
	}

	for(let i = 0; i < united[0].length; i++) {
		const apiData = united[0][i], htmlData = united[1][i];
		apiData.japanese[0].furigana = htmlData.furigana;
		apiData.audio = htmlData.audio;
	}

	return united[0];
}

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
