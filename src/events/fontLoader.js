const fs = require("fs-nextra");
const path = require("path");
const { Event } = require("klasa");
const { registerFont } = require("canvas");

module.exports = class extends Event {

	constructor(...args) {
		super(...args, {
			event: "klasaReady",
			once: true
		});
		this.validFontTypes = [
			".ttc", ".ttf", ".otf"
		];
	}

	async run() {
		const fontsFolder = `${this.client.userBaseDirectory}/../assets/fonts`;
		if(!await fs.pathExists(fontsFolder)) {
			return this.client.emit("error", "Fonts folder doesn't exist, canvas images won't have stylized font and maybe even have missing glyphs. Run \"yarn getFonts\" for getting missing fonts");
		}

		const dirs = await fs.readdir(fontsFolder), promises = [];
		for(const dir of dirs) {
			promises.push(fs.readdir(`${fontsFolder}/${dir}`).then(files => {
				for(const file of files) {
					if(!this.validFontTypes.includes(path.extname(file))) continue;
					const info = file.split("-");
					registerFont(`${fontsFolder}/${dir}/${file}`, {
						family: dir,
						weight: info[1] || "normal",
						style: info[2] || "normal"
					});
				}
			}));
		}

		await Promise.all(promises);
		return this.client.emit("log", `Loaded ${dirs.length} font families.`);
	}

};
