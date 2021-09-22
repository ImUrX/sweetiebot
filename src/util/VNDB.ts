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
	/*[VNDBType.RELEASE]: "basic" | "details" | "vn"
	[VNDBType.PRODUCER]: "basic" | "details" | "relations"
	[VNDBType.CHARACTER]: "basic" | "details" | "meas" | "vns" | "voiced" | "instances"
	[VNDBType.STAFF]: "basic" | "details" | "aliases" | "vns" | "voiced"
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

export type VNData = {
	basic: VNBasicData,
	details: VNDetailsData,
	anime: VNAnimeData,
	relations: VNRelationData,
	tags: VNTagData,
	stats: VNStatsData,
	screens: VNScreenshotData,
	staff: VNStaffData	
}

interface VNBasicData {
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
