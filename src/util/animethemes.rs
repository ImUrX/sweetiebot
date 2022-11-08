use std::{env, process::Stdio};

use anyhow::Result;
use chrono::{prelude::*, serde::ts_seconds_option};
use lazy_static::lazy_static;
use regex::Regex;
use serde::Deserialize;
use sqlx::{prelude::*, query, query_as, query_file, MySql, Pool};
use substring::Substring;
use tempfile::NamedTempFile;
use tokio::{fs::File, io, process::Command};
use tokio_util::io::StreamReader;

pub async fn update_database() -> Result<()> {
    let client = reqwest::Client::new();
    let index = client
        .get("https://api.animethemes.moe/dump/")
        .send()
        .await?
        .json::<DumpIndex>()
        .await?;

    use futures::TryStreamExt;
    let mut reader = StreamReader::new(
        client
            .get(index.dumps.last().unwrap().link.clone())
            .send()
            .await?
            .bytes_stream()
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e)),
    );

    let url = env::var("DATABASE_URL").unwrap();
    let (dot, at, slash) = (
        url[8..].find(':').unwrap() + 8,
        url.find('@').unwrap(),
        url[8..].find("/").unwrap() + 8,
    );
    let database = if let Some(question) = url.find('?') {
        &url[slash + 1..question]
    } else {
        &url[slash + 1..]
    };

    let mut child = Command::new("mysql")
        .args(&[
            "-u",
            &url[8..dot],
            &format!("--password={}", &url[dot + 1..at]),
            database,
        ])
        .stdin(Stdio::piped())
        .spawn()
        .expect("failed to spawn mysql cli");

    let mut stdin = child.stdin.take().unwrap();
    io::copy(&mut reader, &mut stdin).await?;
    drop(stdin);
    Ok(child.wait().await?.exit_ok()?)
}

pub async fn search_theme(
    query: &str,
    limit: u8,
    pool: Pool<MySql>,
) -> Result<Vec<AnimeThemeSearch>> {
    lazy_static! {
        static ref RE: Regex = Regex::new(r"((?:OP|ED)\d*) ?").unwrap();
    }
    let query = query.to_uppercase();
    let result = RE.captures(&query);
    let which = if let Some(capture) = result {
        capture.get(1).map_or("", |x| x.as_str())
    } else {
        ""
    };
    let replaced = RE.replace(&query, "");

    let res = query_as!(
        AnimeThemeSearch,
        r#"
SELECT theme_id, anime.name as name, anime_themes.slug as slug, songs.title as title
FROM anime_themes
INNER JOIN anime
ON anime.anime_id = anime_themes.anime_id
LEFT JOIN anime_synonyms
ON anime_synonyms.anime_id = anime.anime_id
LEFT JOIN songs
ON songs.song_id = anime_themes.song_id
WHERE (anime.name LIKE CONCAT("%", ?, "%")
OR songs.title LIKE CONCAT("%", ?, "%")
OR anime_synonyms.text LIKE CONCAT("%", ?, "%"))
AND anime_themes.slug LIKE CONCAT("%", ?, "%")
LIMIT ?
        "#,
        replaced,
        replaced,
        replaced,
        which,
        limit
    )
    .fetch_all(&pool)
    .await?;

    Ok(res)
}

pub async fn get_video(theme_id: u64, pool: Pool<MySql>) -> Result<Vec<AnimeThemeVideo>> {
    Ok(query_as!(AnimeThemeVideo,
    "
SELECT songs.title as title, videos.basename as basename,
    artists.name as artist_name, artist_song.as as as_who
FROM anime_theme_entries
INNER JOIN anime_themes
ON anime_theme_entries.theme_id = anime_themes.theme_id
INNER JOIN anime_theme_entry_video
ON anime_theme_entry_video.entry_id = anime_theme_entries.entry_id
INNER JOIN videos
ON anime_theme_entry_video.video_id = videos.video_id
LEFT JOIN songs
ON songs.song_id = anime_themes.song_id
LEFT JOIN artist_song
ON songs.song_id = artist_song.song_id
LEFT JOIN artists
ON artists.artist_id = artist_song.artist_id
WHERE anime_theme_entries.theme_id = ?
    ",
    theme_id
    )
    .fetch_all(&pool)
    .await?)
}

#[derive(Debug)]
pub struct AnimeThemeVideo {
    pub title: Option<String>,
    pub basename: String,
    pub artist_name: Option<String>,
    pub as_who: Option<String>,
}

#[derive(Debug)]
pub struct AnimeThemeSearch {
    pub theme_id: u64,
    pub name: String,
    pub slug: String,
    pub title: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct Dump {
    pub id: u64,
    pub path: String,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub deleted_at: Option<String>,
    /// URL to dump
    pub link: String,
}

#[derive(Debug, Deserialize)]
/// Dump index paging
pub struct DumpLinks {
    pub first: Option<String>,
    pub last: Option<String>,
    pub prev: Option<String>,
    pub next: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DumpMeta {
    pub current_page: usize,
    pub from: usize,
    pub path: String,
    pub per_page: usize,
    pub to: usize,
}

#[derive(Debug, Deserialize)]
pub struct DumpIndex {
    pub dumps: Vec<Dump>,
    pub links: DumpLinks,
    pub meta: DumpMeta,
}

#[derive(Debug, Deserialize)]
pub struct Anime {
    pub anime_id: String,
    #[serde(with = "ts_seconds_option")]
    pub created_at: Option<DateTime<Utc>>,
    #[serde(with = "ts_seconds_option")]
    pub updated_at: Option<DateTime<Utc>>,
    #[serde(with = "ts_seconds_option")]
    pub deleted_at: Option<DateTime<Utc>>,
    pub slug: String,
    pub name: String,
    pub year: u16,
    pub season: u32,
    pub synopsis: String,
}

#[derive(Debug, Deserialize)]
pub struct AnimeSynonym {
    pub synonym_id: u64,
    #[serde(with = "ts_seconds_option")]
    pub created_at: Option<DateTime<Utc>>,
    #[serde(with = "ts_seconds_option")]
    pub updated_at: Option<DateTime<Utc>>,
    #[serde(with = "ts_seconds_option")]
    pub deleted_at: Option<DateTime<Utc>>,
    pub text: Option<String>,
    pub anime_id: u64,
}

#[derive(Debug, Deserialize)]
pub struct AnimeTheme {
    pub theme_id: u64,
    #[serde(with = "ts_seconds_option")]
    pub created_at: Option<DateTime<Utc>>,
    #[serde(with = "ts_seconds_option")]
    pub updated_at: Option<DateTime<Utc>>,
    #[serde(with = "ts_seconds_option")]
    pub deleted_at: Option<DateTime<Utc>>,
    pub group: Option<String>,
    #[serde(rename = "type")]
    pub r#type: Option<u32>,
    pub sequence: u32,
    pub slug: String,
    pub anime_id: u64,
    pub song_id: Option<u64>,
}

#[derive(Debug, Deserialize)]
pub struct AnimeThemeEntry {
    pub entry_id: u64,
    #[serde(with = "ts_seconds_option")]
    pub created_at: Option<DateTime<Utc>>,
    #[serde(with = "ts_seconds_option")]
    pub updated_at: Option<DateTime<Utc>>,
    #[serde(with = "ts_seconds_option")]
    pub deleted_at: Option<DateTime<Utc>>,
    pub version: Option<u32>,
    pub episodes: Option<String>,
    pub nsfw: bool,
    pub spoiler: bool,
    pub notes: String,
    pub theme_id: u64,
}

#[derive(Debug, Deserialize)]
pub struct AnimeThemeEntryVideo {
    #[serde(with = "ts_seconds_option")]
    pub created_at: Option<DateTime<Utc>>,
    #[serde(with = "ts_seconds_option")]
    pub updated_at: Option<DateTime<Utc>>,
    pub entry_id: u64,
    pub video_id: u64,
}

#[derive(Debug, Deserialize)]
pub struct Song {
    pub song_id: u64,
    #[serde(with = "ts_seconds_option")]
    pub created_at: Option<DateTime<Utc>>,
    #[serde(with = "ts_seconds_option")]
    pub updated_at: Option<DateTime<Utc>>,
    #[serde(with = "ts_seconds_option")]
    pub deleted_at: Option<DateTime<Utc>>,
    pub title: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct Artist {
    pub artist_id: u64,
    #[serde(with = "ts_seconds_option")]
    pub created_at: Option<DateTime<Utc>>,
    #[serde(with = "ts_seconds_option")]
    pub updated_at: Option<DateTime<Utc>>,
    #[serde(with = "ts_seconds_option")]
    pub deleted_at: Option<DateTime<Utc>>,
    pub slug: String,
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct Video {
    pub video_id: u64,
    #[serde(with = "ts_seconds_option")]
    pub created_at: Option<DateTime<Utc>>,
    #[serde(with = "ts_seconds_option")]
    pub updated_at: Option<DateTime<Utc>>,
    #[serde(with = "ts_seconds_option")]
    pub deleted_at: Option<DateTime<Utc>>,
    pub basename: String,
    pub filename: String,
    pub path: String,
    pub size: u32,
    pub mimetype: String,
    pub resolution: Option<u32>,
    pub nc: bool,
    pub subbed: bool,
    pub lyrics: bool,
    pub uncen: bool,
    pub overlap: u32,
    pub source: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct ArtistSong {
    #[serde(with = "ts_seconds_option")]
    pub created_at: Option<DateTime<Utc>>,
    #[serde(with = "ts_seconds_option")]
    pub updated_at: Option<DateTime<Utc>>,
    pub artist_id: u64,
    pub song_id: u64,
    #[serde(rename = "as")]
    pub r#as: Option<String>,
}
