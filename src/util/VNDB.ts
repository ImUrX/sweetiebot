import EventEmitter from "events";
import tls from "tls";
import { Union } from "ts-toolbelt";

export default class VNDB extends EventEmitter {
	static api = {
		host: "api.vndb.org",
		port: 19535
	};
	connection = tls.connect(VNDB.api);
	client: string;
	logged: boolean;

	/**
	 * A class that makes VNDB API kind of simpler
	 */
	constructor(clientName: string) {
		super();

		this.connection.setEncoding("utf8");
		this.connection.setKeepAlive(true);

	
		this.client = clientName;
		this.logged = false;

		let currentData = "";
		this.connection.on("data", res => {
			currentData += res;
			if(res.endsWith("\x04")) {
				this.emit("data", currentData.slice());
				currentData = "";
			}
		});
	}

	/**
	 * For logging to VNDB's API
	 */
	login(log: VNDBAuth = {}): Promise<void> {
		return new Promise((res, rej) => {
			log = {
				...log,
				protocol: 1,
				client: this.client,
				clientver: 0.01,
			};
			this.connection.write(`login ${JSON.stringify(log)}\x04`);
			this.once("data", str => {
				if(str.includes("ok\x04")) {
					this.logged = true;
					this.emit("login");
					res();
				} else{
					rej(str);
				}
			});
		});
	}

	/**
	 * Gets you the current stats of VNDB
	 */
	dbstats(): Promise<VNDBStats> {
		return new Promise((res, rej) => {
			this.connection.write("dbstats\x04");
			this.once("data", str => {
				if(str.includes("dbstats")) {
					const data = JSON.parse(str.replace("dbstats", "").replace("\x04", ""));
					this.emit("dbstats", data);
					res(data);
				} else{
					rej(str);
				}
			});
		});
	}

	/**
	 * Gets you info from the VNDB
	 */
	get<
		K extends keyof VNDBFlag,
		V extends keyof VNDBFlag[K]
	>(type: VNDBType & K, flags: V[], filter: string, options: VNDBGetOptions = {}): Promise<Union.IntersectOf<VNDBFlag[K][V]>> {
	return new Promise((res, rej) => {
		this.connection.write(`get ${type} ${flags.join(",")} ${filter}${options ? ` ${JSON.stringify(options)}` : ""}\x04`);
		this.once("data", str => {
			if(str.includes("results")) {
				const data = JSON.parse(str.replace("results", "").replace("\x04", ""));
				this.emit("get", data, type, flags, filter, options);
				res(data);
			} else{
				rej(str);
			}
		});
	});
}

	end(): void {
		this.connection.end();
		this.logged = false;
	}

}

export type VNDBAuth = {
	user?: string;
	password?: string;
	protocol?: number,
	client?: string,
	clientver?: number
}

export type VNDBStats = {
	users: number,
	threads: number,
	tags: number
	releases: number,
	producers: number,
	chars: number,
	posts: number,
	vn: number,
	traits: number
}

export type VNDBGetOptions = {
	page?: number,
	results?: number,
	sort?: string,
	reverse?: boolean
}

export enum VNDBType {
	VN = "vn",
	RELEASE = "release",
	PRODUCER = "producer",
	CHARACTER = "character",
	STAFF = "staff",
	QUOTE = "quote",
	USER = "user",
	VOTELIST = "votelist",
	VNLIST = "vnlist",
	WISHLIST = "wishlist",
	ULIST_LABELS = "ulist-labels",
	ULIST = "ulist"
}

export type VNDBFlag = {
	[VNDBType.VN]: IDData<VNData>
	[VNDBType.RELEASE]: IDData<ReleaseData>
	[VNDBType.PRODUCER]: IDData<ProducerData>
	[VNDBType.CHARACTER]: IDData<CharacterData>
	/*[VNDBType.STAFF]: "basic" | "details" | "aliases" | "vns" | "voiced"
	[VNDBType.QUOTE]: "basic"
	[VNDBType.USER]: "basic"
	[VNDBType.ULIST_LABELS]: "basic"
	[VNDBType.ULIST]: "basic" | "labels"*/
}

type IDData<T> = {
	[P in keyof T]: T[P] & IdentifiedData
}

interface IdentifiedData {
	id: number
}

type VNData = {
	basic: VNBasicData,
	details: VNDetailsData,
	anime: VNAnimeData,
	relations: VNRelationData,
	tags: VNTagData,
	stats: VNStatsData,
	screens: VNScreenshotData,
	staff: VNStaffData	
}

type ReleaseData = {
	basic: ReleaseBasicData,
	details: ReleaseDetailsData,
	vn: ReleaseVNData,
	producers: ReleaseProducersData
}

type ProducerData = {
	basic: ProducerBasicData,
	details: ProducerDetailsData,
	relations: ProducerRelationData
}

type CharacterData = {
	basic: CharacterBasicData,
	details: CharacterDetailsData,
	meas: CharacterMeasData,
	traits: CharacterTraitData,
	vns: CharacterVNData,
	voiced: CharacterVoicedData,
	instances: CharacterInstanceData
}

export interface VNBasicData {
	title: string
	original?: string
	released?: string,
	languages: string[],
	orig_lang: string[],
	platforms: string[]
}

type ImageFlagData = {
	votecount: number,
	sexual_avg: number,
	violence_avg: number
}

export interface VNDetailsData {
	aliases?: string,
	length?: number,
	description?: string,
	links: {
		renai?: string,
		wikidata?: string
	},
	image?: string,
	image_flagging?: ImageFlagData
}


export interface VNAnimeData {
	anime: {
		id: number
	}[]
}

export interface VNRelationData {
	relations: {
		id: number,
		relation: string,
		title: string,
		original?: string,
		official: boolean
	}[],
}

export interface VNTagData {
	tags: [number, number, number][]
}

export interface VNStatsData {
	popularity: number,
	rating: number,
	votecount: number
}

export interface VNScreenshotData {
	screens: {
		image: string,
		rid: number,
		flagging: ImageFlagData,
		height: number,
		width: number
	}[]
}

export interface VNStaffData {
	staff: {
		sid: number,
		aid: number,
		name: string,
		original?: string,
		role: string,
		note?: string
	}[]
}

export interface ReleaseBasicData {
	title: string,
	original?: string,
	released?: string,
	type: string,
	patch: boolean,
	freeware: boolean,
	doujin: boolean,
	languages: string[]
}

export enum ReleaseVoiced {
	NOT = 1,
	ONLY_ERO = 2,
	PARTIALLY = 3,
	FULLY = 4
}

export enum ReleaseAnimation {
	NOT = 1,
	SIMPLE = 2,
	SOME = 3,
	ALL = 4
}

export interface ReleaseDetailsData {
	website?: string,
	notes?: string,
	minage?: number,
	gtin?: string,
	catalog?: string,
	platforms: string[],
	media: {
		medium: string,
		qty?: number
	}[],
	resolution?: string,
	voiced?: ReleaseVoiced,
	animation?: [ReleaseAnimation, ReleaseAnimation]
}

export interface ReleaseVNData {
	vn: (IdentifiedData & {
		title: string,
		original?: string
	})[]
}

export interface ReleaseProducersData {
	producers: (IdentifiedData & {
		developer: boolean,
		publisher: boolean,
		name: string,
		original?: string,
		type: string
	})[]
}

export interface ProducerBasicData {
	name: string,
	original?: string,
	type: string,
	language: string,
}

export interface ProducerDetailsData {
	links: {
		homepage?: string,
		wikidata?: string
	},
	aliases?: string,
	description?: string
}

export interface ProducerRelationData {
	relations: (IdentifiedData & {
		relation: string,
		name: string,
		original?: string
	})[]
}

export interface CharacterBasicData {
	name: string,
	original?: string,
	gender?: string,
	spoil_gender?: string,
	bloodt?: string,
	birthday: [number?, number?]
}

export interface CharacterDetailsData {
	aliases?: string,
	description?: string,
	age?: number,
	image?: string,
	image_flagging?: ImageFlagData
}

export interface CharacterMeasData {
	bust?: number,
	waist?: number,
	hip?: number,
	height?: number,
	weight?: number,
	cup_size?: string
}

export interface CharacterTraitData {
	traits: [number, number][]
}

export interface CharacterVNData {
	vns: [number, number, string][]
}

export interface CharacterVoicedData {
	voiced: {
		id: number,
		aid: number,
		vid: number,
		note: string
	}[]
}

export interface CharacterInstanceData {
	instances: {
		id: number,
		spoiler: number,
		name: string,
		original: string
	}[]
}
