use anyhow::Result;
use serde::Deserialize;

pub async fn update_database(pool: &sqlx::MySqlPool) -> Result<()> {
    let client = reqwest::Client::new();
    let index = client
        .get("https://api.animethemes.moe/dump/")
        .send()
        .await?
        .json::<DumpIndex>()
        .await?;

    let sql = client.get(index.dumps.last().unwrap().link.clone()).send().await?.text().await?;
	sqlx::query(&sql).execute(pool).await?;
    Ok(())
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
