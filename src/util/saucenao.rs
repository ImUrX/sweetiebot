
use std::{env};

use serde::de::{Deserializer, Error};
use serde::Deserialize;
use serde_json::Value;
use twilight_model::channel::embed::EmbedFooter;
use twilight_model::{channel::Attachment, http::attachment::Attachment as HttpAttachment};
use twilight_util::builder::embed::{EmbedBuilder, ImageSource};

use super::{censor_image, get_bytes};

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

const NSFW_WARN: &str = "\n**WARNING:** Image is NSFW so it's been censored!";
pub async fn create_embed(
    data: &Res,
    nsfw_channel: bool,
) -> anyhow::Result<(EmbedBuilder, HttpAttachment)> {
    let nsfw = data.header.hidden != 0 && !nsfw_channel;
    let image = if nsfw {
        censor_image(get_bytes(&data.header.thumbnail).await?).await?
    } else {
        get_bytes(&data.header.thumbnail).await?
    };
    let attachment = HttpAttachment::from_bytes("saucenao.png".to_string(), image.into(), 1);
    let mut embed = EmbedBuilder::new()
        .description(format!(
            "Similarity {}%{}",
            data.header.similarity,
            if nsfw { NSFW_WARN } else { "" }
        ))
        .image(ImageSource::attachment("saucenao.png")?)
        .footer(EmbedFooter {
            icon_url: None,
            proxy_icon_url: None,
            text: data.header.index_name.clone(),
        })
        .color(0x9b59b6);

    {
        let ext_urls = data.data.get_ext_urls();
        if let Some(url) = ext_urls.get(0) {
            embed = embed.url(url)
        }
    }


    Ok((embed, attachment))
}

#[derive(Debug, Deserialize)]
pub struct DataHeader {
    pub status: u32,
}

#[derive(Debug, Deserialize)]
pub struct Data {
    pub header: DataHeader,
    pub res: Vec<Res>,
}

#[derive(Debug, Deserialize)]
pub struct ResHeader {
    pub similarity: String,
    pub thumbnail: String,
    pub index_id: u32,
    pub index_name: String,
    pub dupes: u32,
    pub hidden: u32,
}

#[derive(Debug)]
pub struct Res {
    pub header: ResHeader,
    pub data: ResData,
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
                .ok_or_else(|| D::Error::missing_field("header"))?,
        )
        .map_err(D::Error::custom)?;
        let data = value.get("data").ok_or_else(|| D::Error::missing_field("data"))?;
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

impl ResData {
    pub fn get_ext_urls(&'_ self) -> &'_ [String] {
        match self {
            Self::Pixiv(data) => &data.ext_urls,
            Self::NicoNico(data) => &data.ext_urls,
            Self::Danbooru(data) => &data.ext_urls,
            Self::Yandere(data) => &data.ext_urls,
            Self::FAKKU(data) => &data.ext_urls,
            Self::EHentai(data) => &data.ext_urls,
            Self::Anime(data) => &data.ext_urls,
            Self::Sankaku(data) => &data.ext_urls,
            Self::E621(data) => &data.ext_urls,
            Self::Bcy(data) => &data.ext_urls,
            Self::DeviantArt(data) => &data.ext_urls,
            Self::Pawoo(data) => &data.ext_urls,
            Self::Madokami(data) => &data.ext_urls,
            Self::Mangadex(data) => &data.ext_urls,
            Self::FurAffinity(data) => &data.ext_urls,
            Self::Twitter(data) => &data.ext_urls,
            Self::FurryNetwork(data) => &data.ext_urls,
            Self::Kemono(data) => &data.ext_urls,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct SaucePixivData {
    pub ext_urls: Vec<String>,
    pub member_name: String,
    pub member_id: u32,
    pub title: String,
}

#[derive(Debug, Deserialize)]
pub struct SauceNicoNicoData {
    pub ext_urls: Vec<String>,
    pub seiga_id: u32,
    pub member_name: String,
    pub member_id: u32,
    pub title: String,
}

#[derive(Debug, Deserialize)]
pub struct SauceDanbooruData {
    pub ext_urls: Vec<String>,
    /// Sometimes a URL String
    pub source: String,
    pub characters: String,
    pub material: String,
    pub creator: String,
    #[serde(rename = "anime-pictures_id")]
    pub anime_pictures_id: Option<u32>,
    pub gelbooru_id: Option<u32>,
    pub yandere_id: Option<u32>,
    pub danbooru_id: u32,
}

#[derive(Debug, Deserialize)]
pub struct SauceYandereData {
    pub ext_urls: Vec<String>,
    /// Sometimes a URL String
    pub source: String,
    pub characters: String,
    pub material: String,
    pub creator: String,
    #[serde(rename = "anime-pictures_id")]
    pub anime_pictures_id: Option<u32>,
    pub gelbooru_id: Option<u32>,
    pub yandere_id: u32,
    pub danbooru_id: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct SauceFAKKUData {
    pub ext_urls: Vec<String>,
    pub source: String,
    pub creator: String,
}

#[derive(Debug, Deserialize)]
pub struct SauceEHentaiData {
    pub ext_urls: Vec<String>,
    pub source: String,
    pub creator: Vec<String>,
    pub eng_name: Option<String>,
    pub jp_name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SauceAnimeData {
    pub ext_urls: Vec<String>,
    pub anidb_aid: u32,
    pub part: Option<String>,
    pub year: Option<String>,
    pub est_time: String,
    pub source: String,
}

#[derive(Debug, Deserialize)]
pub struct SauceSankakuData {
    pub ext_urls: Vec<String>,
    pub sankaku_id: u32,
    pub creator: String,
    pub material: String,
    pub characters: String,
    pub source: String,
}

#[derive(Debug, Deserialize)]
pub struct SauceE621Data {
    pub ext_urls: Vec<String>,
    /// Sometimes a URL String
    pub source: String,
    pub characters: String,
    pub material: String,
    pub creator: String,
    pub e621_id: u32,
    #[serde(rename = "anime-pictures_id")]
    pub anime_pictures_id: Option<u32>,
    pub gelbooru_id: Option<u32>,
    pub yandere_id: Option<u32>,
    pub danbooru_id: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct SauceBcyData {
    pub ext_urls: Vec<String>,
    pub bcy_id: u32,
    pub member_name: String,
    pub member_id: u32,
    pub member_link_id: u32,
    pub bcy_type: String,
    pub title: String,
}

#[derive(Debug, Deserialize)]
pub struct SauceDeviantArtData {
    pub ext_urls: Vec<String>,
    pub da_id: String,
    pub author_name: String,
    pub author_url: String,
    pub title: String,
}

#[derive(Debug, Deserialize)]
pub struct SaucePawooData {
    pub ext_urls: Vec<String>,
    pub created_at: String,
    pub pawoo_id: u32,
    pub pawoo_user_acct: String,
    pub pawoo_user_username: String,
    pub pawoo_user_display_name: String,
}

#[derive(Debug, Deserialize)]
pub struct SauceMadokamiData {
    pub ext_urls: Vec<String>,
    pub mu_id: u32,
    pub source: String,
    pub part: String,
    #[serde(rename = "type")]
    pub r#type: String,
}

#[derive(Debug, Deserialize)]
pub struct SauceMangadexData {
    pub ext_urls: Vec<String>,
    pub md_id: String,
    pub mu_id: Option<u32>,
    pub mal_id: Option<u32>,
    pub source: String,
    pub part: String,
    pub artist: String,
    pub author: String,
}

#[derive(Debug, Deserialize)]
pub struct SauceFurAffinityData {
    pub ext_urls: Vec<String>,
    pub fa_id: u32,
    pub author_name: String,
    pub author_url: String,
    pub title: String,
}

#[derive(Debug, Deserialize)]
pub struct SauceTwitterData {
    pub ext_urls: Vec<String>,
    pub created_at: String,
    pub tweet_id: String,
    pub twitter_user_id: String,
    pub twitter_user_handle: String,
}

#[derive(Debug, Deserialize)]
pub struct SauceFurryNetworkData {
    pub ext_urls: Vec<String>,
    pub fn_id: u32,
    pub fn_type: String,
    pub author_name: String,
    pub author_url: String,
    pub title: String,
}

#[derive(Debug, Deserialize)]
pub struct SauceKemonoData {
    pub ext_urls: Vec<String>,
    pub published: String,
    pub title: String,
    pub service: String,
    pub service_name: String,
    pub id: String,
    pub user_id: String,
    pub user_name: String,
}
