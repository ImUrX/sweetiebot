import { execSync } from "child_process";
import { tmpdir } from "os";
import fs from "fs/promises";
import fetch from "node-fetch";
import auth from "./auth.json" assert { type: "json" };
import path from "path";

const sql = await fetch("https://raw.githubusercontent.com/AnimeThemes/animethemes-db-dump/main/mysql/wiki/animethemes-db-dump-create-tables.sql").then(res => res.text());

const filePath = path.join(tmpdir(), "help.sql");
await fs.writeFile(filePath, sql, "utf8");

const proc = execSync(`mysql -h ${auth.mysql.host} -P ${auth.mysql.port} -u ${auth.mysql.user} --password="${auth.mysql.password}" ${auth.mysql.database} < ${filePath}`);
if(proc) {
    console.log(proc.toString("utf8"));
}

execSync(`mysql -h ${auth.mysql.host} -P ${auth.mysql.port} -u ${auth.mysql.user} --password="${auth.mysql.password}" ${auth.mysql.database} -e "alter table anime add fulltext index_text(name);"`);
execSync(`mysql -h ${auth.mysql.host} -P ${auth.mysql.port} -u ${auth.mysql.user} --password="${auth.mysql.password}" ${auth.mysql.database} -e "alter table anime_themes add fulltext index_text(slug);"`);
execSync(`mysql -h ${auth.mysql.host} -P ${auth.mysql.port} -u ${auth.mysql.user} --password="${auth.mysql.password}" ${auth.mysql.database} -e "alter table songs add fulltext index_text(title);"`);
