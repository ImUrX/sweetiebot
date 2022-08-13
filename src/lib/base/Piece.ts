import path from "path";
import { Base } from "discord.js";
import SweetieClient from "../SweetieClient";
import { P } from "pino";

export type PieceOptions = {
	name: string | null;
	category?: string;
}

export default abstract class Piece extends Base {
	declare client: SweetieClient;
	name: string;
	category?: string;
	abstract logger: P.Logger;

	constructor(client: SweetieClient, { name, category }: PieceOptions) {
		super(client);
		this.name = name ?? path.basename(__filename);
		this.category = category;
	}

	async init(): Promise<unknown> {
		return undefined;
	}
}
