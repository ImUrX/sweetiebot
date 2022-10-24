use std::marker::PhantomData;
use std::{env, fmt};

use serde::de::{Deserializer, Error, MapAccess, Visitor};
use serde::Deserialize;
use serde_json::Value;
use twilight_model::channel::Attachment;

pub async fn fetch(attachment: &Attachment) -> anyhow::Result<Data> {
    let client = reqwest::Client::new();
    let res = client
        .get("https://saucenao.com/search.php?db=999&output_type=2&numres=5&hide=3")
        .query(&[
            ("api_key", env::var("SAUCENAO_TOKEN")?),
            ("url", attachment.proxy_url.clone()),
        ])
        .send()
        .await?
        .json::<Data>()
        .await?;
    Ok(res)
}

#[derive(Debug, Deserialize)]
pub struct DataHeader {
    status: u32,
}

#[derive(Debug, Deserialize)]
pub struct Data {
    header: DataHeader,
    Ress: Vec<Res>,
}

#[derive(Debug, Deserialize)]
pub struct ResHeader {
    similarity: String,
    thumbnail: String,
    index_id: u32,
    index_name: String,
    dupes: u32,
    hidden: u32,
}

#[derive(Debug)]
pub struct Res {
    header: ResHeader,
    data: ResData,
}

impl<'de> Deserialize<'de> for Res {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = Value::deserialize(deserializer)?;
        let header = ResHeader::deserialize(
            value
                .get("header")
                .ok_or(D::Error::missing_field("header"))?,
        )
        .map_err(D::Error::custom)?;
        let data = value.get("data").ok_or(D::Error::missing_field("data"))?;
        let data = match header.index_id {
            5 | 6 => ResData::Pixiv(SaucePixivData::deserialize(data).map_err(D::Error::custom)?),
            8 => ResData::NicoNico(SauceNicoNicoData::deserialize(data).map_err(D::Error::custom)?),
            9 => ResData::Danbooru(SauceDanbooruData::deserialize(data).map_err(D::Error::custom)?),
            12 => ResData::Yandere(SauceYandereData::deserialize(data).map_err(D::Error::custom)?),
            16 => ResData::FAKKU(SauceFAKKUData::deserialize(data).map_err(D::Error::custom)?),
            18 | 38 => {
                ResData::EHentai(SauceEHentaiData::deserialize(data).map_err(D::Error::custom)?)
            }
            21 | 22 => ResData::Anime(SauceAnimeData::deserialize(data).map_err(D::Error::custom)?),
            27 => ResData::Sankaku(SauceSankakuData::deserialize(data).map_err(D::Error::custom)?),
            29 => ResData::E621(SauceE621Data::deserialize(data).map_err(D::Error::custom)?),
            31 => ResData::Bcy(SauceBcyData::deserialize(data).map_err(D::Error::custom)?),
            34 => ResData::DeviantArt(
                SauceDeviantArtData::deserialize(data).map_err(D::Error::custom)?,
            ),
            35 => ResData::Pawoo(SaucePawooData::deserialize(data).map_err(D::Error::custom)?),
            36 => {
                ResData::Madokami(SauceMadokamiData::deserialize(data).map_err(D::Error::custom)?)
            }
            37 | 371 => {
                ResData::Mangadex(SauceMangadexData::deserialize(data).map_err(D::Error::custom)?)
            }
            40 => ResData::FurAffinity(
                SauceFurAffinityData::deserialize(data).map_err(D::Error::custom)?,
            ),
            41 => ResData::Twitter(SauceTwitterData::deserialize(data).map_err(D::Error::custom)?),
            42 => ResData::FurryNetwork(
                SauceFurryNetworkData::deserialize(data).map_err(D::Error::custom)?,
            ),
            43 => ResData::Kemono(SauceKemonoData::deserialize(data).map_err(D::Error::custom)?),
            _ => return Err(D::Error::unknown_variant(&header.index_name, &[])),
        };
        Ok(Res { header, data })
    }
}

#[derive(Debug)]
pub enum ResData {
    Pixiv(SaucePixivData),
    NicoNico(SauceNicoNicoData),
    Danbooru(SauceDanbooruData),
    Yandere(SauceYandereData),
    FAKKU(SauceFAKKUData),
    EHentai(SauceEHentaiData),
    Anime(SauceAnimeData),
    Sankaku(SauceSankakuData),
    E621(SauceE621Data),
    Bcy(SauceBcyData),
    DeviantArt(SauceDeviantArtData),
    Pawoo(SaucePawooData),
    Madokami(SauceMadokamiData),
    Mangadex(SauceMangadexData),
    FurAffinity(SauceFurAffinityData),
    Twitter(SauceTwitterData),
    FurryNetwork(SauceFurryNetworkData),
    Kemono(SauceKemonoData),
}

#[derive(Debug, Deserialize)]
pub struct SaucePixivData {
    ext_urls: Vec<String>,
    member_name: String,
    member_id: u32,
    title: String,
}

#[derive(Debug, Deserialize)]
pub struct SauceNicoNicoData {
    ext_urls: Vec<String>,
    seiga_id: u32,
    member_name: String,
    member_id: u32,
    title: String,
}

#[derive(Debug, Deserialize)]
pub struct SauceDanbooruData {
    ext_urls: Vec<String>,
    /// Sometimes a URL String
    source: String,
    characters: String,
    material: String,
    creator: String,
    #[serde(rename = "anime-pictures_id")]
    anime_pictures_id: Option<u32>,
    gelbooru_id: Option<u32>,
    yandere_id: Option<u32>,
    danbooru_id: u32,
}

#[derive(Debug, Deserialize)]
pub struct SauceYandereData {
    ext_urls: Vec<String>,
    /// Sometimes a URL String
    source: String,
    characters: String,
    material: String,
    creator: String,
    #[serde(rename = "anime-pictures_id")]
    anime_pictures_id: Option<u32>,
    gelbooru_id: Option<u32>,
    yandere_id: u32,
    danbooru_id: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct SauceFAKKUData {
    ext_urls: Vec<String>,
    source: String,
    creator: String,
}

#[derive(Debug, Deserialize)]
pub struct SauceEHentaiData {
    ext_urls: Vec<String>,
    source: String,
    creator: Vec<String>,
    eng_name: Option<String>,
    jp_name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SauceAnimeData {
    ext_urls: Vec<String>,
    anidb_aid: u32,
    part: Option<String>,
    year: Option<String>,
    est_time: String,
    source: String,
}

#[derive(Debug, Deserialize)]
pub struct SauceSankakuData {
    ext_urls: Vec<String>,
    sankaku_id: u32,
    creator: String,
    material: String,
    characters: String,
    source: String,
}

#[derive(Debug, Deserialize)]
pub struct SauceE621Data {
    ext_urls: Vec<String>,
    /// Sometimes a URL String
    source: String,
    characters: String,
    material: String,
    creator: String,
    e621_id: u32,
    #[serde(rename = "anime-pictures_id")]
    anime_pictures_id: Option<u32>,
    gelbooru_id: Option<u32>,
    yandere_id: Option<u32>,
    danbooru_id: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct SauceBcyData {
    bcy_id: u32,
    member_name: String,
    member_id: u32,
    member_link_id: u32,
    bcy_type: String,
    title: String,
}

#[derive(Debug, Deserialize)]
pub struct SauceDeviantArtData {
    da_id: String,
    author_name: String,
    author_url: String,
    title: String,
}

#[derive(Debug, Deserialize)]
pub struct SaucePawooData {
    created_at: String,
    pawoo_id: u32,
    pawoo_user_acct: String,
    pawoo_user_username: String,
    pawoo_user_display_name: String,
}

#[derive(Debug, Deserialize)]
pub struct SauceMadokamiData {
    mu_id: u32,
    source: String,
    part: String,
    #[serde(rename = "type")]
    r#type: String,
}

#[derive(Debug, Deserialize)]
pub struct SauceMangadexData {
    md_id: String,
    mu_id: Option<u32>,
    mal_id: Option<u32>,
    source: String,
    part: String,
    artist: String,
    author: String,
}

#[derive(Debug, Deserialize)]
pub struct SauceFurAffinityData {
    fa_id: u32,
    author_name: String,
    author_url: String,
    title: String,
}

#[derive(Debug, Deserialize)]
pub struct SauceTwitterData {
    created_at: String,
    tweet_id: String,
    twitter_user_id: String,
    twitter_user_handle: String,
}

#[derive(Debug, Deserialize)]
pub struct SauceFurryNetworkData {
    fn_id: u32,
    fn_type: String,
    author_name: String,
    author_url: String,
    title: String,
}

#[derive(Debug, Deserialize)]
pub struct SauceKemonoData {
    published: String,
    title: String,
    service: String,
    service_name: String,
    id: String,
    user_id: String,
    user_name: String,
}
