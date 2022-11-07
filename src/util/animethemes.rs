use std::{env, process::Stdio};

use anyhow::Result;
use serde::Deserialize;
use sqlx::{prelude::*, query_file, MySql, Pool};
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

#[derive(Debug, Deserialize)]
pub struct Dump {
    pub id: u32,
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
