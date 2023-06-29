use std::env;

use chrono::prelude::*;
use sentry::{add_breadcrumb, Breadcrumb, Level};
use serde::de::{Deserializer, Error};
use serde::Deserialize;
use serde_json::Value;
use twilight_model::channel::message::embed::EmbedFooter;
use twilight_model::util::Timestamp;
use twilight_model::{channel::Attachment, http::attachment::Attachment as HttpAttachment};
use twilight_util::builder::embed::{
    EmbedAuthorBuilder, EmbedBuilder, EmbedFieldBuilder, ImageSource,
};

use super::{censor_image, get_bytes, shortify};

pub async fn fetch(attachment: &Attachment) -> anyhow::Result<Data> {
    let client = reqwest::Client::new();
    add_breadcrumb(Breadcrumb {
        category: Some("saucenao".into()),
        message: Some(format!(
            "Searching in saucenao about {} ",
            attachment.proxy_url.clone()
        )),
        level: Level::Info,
        ..Default::default()
    });
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
pub async fn build_embed(
    res: &Res,
    nsfw_channel: bool,
) -> anyhow::Result<(EmbedBuilder, HttpAttachment)> {
    let nsfw = res.header.hidden != 0 && !nsfw_channel;
    let image = if nsfw {
        censor_image(get_bytes(&res.header.thumbnail).await?).await?
    } else {
        get_bytes(&res.header.thumbnail).await?
    };
    let attachment = HttpAttachment::from_bytes("saucenao.png".to_string(), image.into(), 1);
    let mut embed = EmbedBuilder::new()
        .description(format!(
            "Similarity {}%{}",
            res.header.similarity,
            if nsfw { NSFW_WARN } else { "" }
        ))
        .image(ImageSource::attachment("saucenao.png")?)
        .footer(EmbedFooter {
            icon_url: None,
            proxy_icon_url: None,
            text: res.header.index_name.clone(),
        })
        .color(0x9b59b6);

    {
        let ext_urls = res.data.get_ext_urls();
        if let Some(_slice @ Some(url)) = ext_urls.map(|x| x.get(0)) {
            embed = embed.url(url)
        }
    }

    let embed =
        match res.data.clone() {
            ResData::Pixiv(data) => embed
                .author(
                    EmbedAuthorBuilder::new(data.member_name)
                        .url(format!("https://www.pixiv.net/users/${}", data.member_id)),
                )
                .title(data.title),
            ResData::Anime(data) => if let Some(part) = data.part {
                embed.field(EmbedFieldBuilder::new("Part:", part).inline())
            } else {
                embed
            }
            .field(EmbedFieldBuilder::new("Timestamp:", data.est_time).inline())
            .title(data.source),
            ResData::DeviantArt(SauceDeviantArtData {
                title,
                author_name,
                author_url,
                ..
            })
            | ResData::FurAffinity(SauceFurAffinityData {
                title,
                author_name,
                author_url,
                ..
            })
            | ResData::FurryNetwork(SauceFurryNetworkData {
                title,
                author_name,
                author_url,
                ..
            }) => embed
                .title(title)
                .author(EmbedAuthorBuilder::new(author_name).url(author_url)),
            ResData::NicoNico(niconico) => embed.title(niconico.title).author(
                EmbedAuthorBuilder::new(niconico.member_name).url(format!(
                    "https://seiga.nicovideo.jp/user/illust/${}",
                    niconico.member_id
                )),
            ),
            ResData::Twitter(twitter) => embed
                .title(format!("Tweet by {}", twitter.twitter_user_handle))
                .timestamp(Timestamp::from_secs(
                    twitter.created_at.parse::<DateTime<Utc>>()?.timestamp(),
                )?),
            ResData::EHentai(ehentai) => {
                embed
                    .title(ehentai.source)
                    .author(EmbedAuthorBuilder::new(shortify(
                        &ehentai.creator.join(" & "),
                        50,
                    )))
            }
            ResData::Bcy(bcy) => embed.title(bcy.title).author(
                EmbedAuthorBuilder::new(bcy.member_name)
                    .url(format!("https://bcy.net/u/{}", bcy.member_link_id)),
            ),
            ResData::Pawoo(pawoo) => embed.title(format!("Toot by {}", pawoo.pawoo_user_username)),
            ResData::FAKKU(SauceFAKKUData {
                source, creator, ..
            })
            | ResData::Sankaku(SauceSankakuData {
                source, creator, ..
            })
            | ResData::Yandere(SauceYandereData {
                source, creator, ..
            })
            | ResData::Danbooru(SauceDanbooruData {
                source, creator, ..
            })
            | ResData::E621(SauceE621Data {
                source, creator, ..
            })
            | ResData::Gelbooru(SauceGelbooruData {
                source, creator, ..
            }) => embed.title(source).author(EmbedAuthorBuilder::new(creator)),
            ResData::Madokami(madokami) => embed
                .title(madokami.source)
                .field(EmbedFieldBuilder::new("Part:", madokami.part).inline()),
            ResData::Kemono(kemono) => embed.title(kemono.title).author(
                EmbedAuthorBuilder::new(kemono.user_name)
                    .url(kemono.ext_urls[1].clone())
                    .icon_url(ImageSource::url(format!(
                        "https://kemono.party/icons/{}/{}",
                        kemono.service, kemono.user_id
                    ))?),
            ),
            ResData::Mangadex(mangadex) => embed
                .title(mangadex.source)
                .author(EmbedAuthorBuilder::new(format!(
                    "{}{}",
                    mangadex.author,
                    if mangadex.author.contains(&mangadex.artist) {
                        format!(", {}", mangadex.artist)
                    } else {
                        "".to_string()
                    }
                )))
                .field(EmbedFieldBuilder::new("Chapter:", mangadex.part).inline()),
            ResData::Artstation(artstation) => embed
                .title(artstation.title)
                .author(EmbedAuthorBuilder::new(artstation.author_name).url(artstation.author_url)),
            ResData::Skeb(skeb) => embed
                .title("Artwork request")
                .author(EmbedAuthorBuilder::new(skeb.creator).url(skeb.author_url)),
            ResData::HMagazines(hmag) => embed
                .title(hmag.title)
                .field(EmbedFieldBuilder::new("Part:", hmag.part)),
            ResData::Movies(movie) => {
                let embed = embed
                    .title(format!("{} ({})", movie.source, movie.year))
                    .field(EmbedFieldBuilder::new("Timestamp:", movie.est_time).inline());
                if let Some(part) = movie.part {
                    embed.field(EmbedFieldBuilder::new("Part:", part).inline())
                } else {
                    embed
                }
            }
            ResData::Drawr(drawr) => embed
                .title(drawr.title)
                .author(EmbedAuthorBuilder::new(drawr.member_name)),
            ResData::AnimePictures(pictures) => embed
                .title(pictures.material)
                .author(EmbedAuthorBuilder::new(pictures.creator)),
            ResData::NijieImages(nijie) => embed.title(nijie.nijie_id.to_string()).author(
                EmbedAuthorBuilder::new(nijie.member_name).url(format!(
                    "https://nijie.info/members.php?id={}",
                    nijie.member_id
                )),
            ),
            ResData::MediBang(medi) => embed.title(medi.title).author(
                EmbedAuthorBuilder::new(medi.member_name)
                    .url(format!("https://medibang.com/author/{}", medi.member_id)),
            ),
        };

    Ok((embed, attachment))
}

#[derive(Debug, Deserialize, Clone)]
pub struct DataHeader {
    pub status: i32,
}

#[derive(Debug, Deserialize, Clone)]
pub struct Data {
    pub header: DataHeader,
    pub results: Vec<Res>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ResHeader {
    pub similarity: String,
    pub thumbnail: String,
    pub index_id: u32,
    pub index_name: String,
    pub dupes: u32,
    pub hidden: u32,
}

#[derive(Debug, Clone)]
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
        let data = value
            .get("data")
            .ok_or_else(|| D::Error::missing_field("data"))?;
        let data = match header.index_id {
            0 => ResData::HMagazines(
                SauceHMagazinesData::deserialize(data).map_err(D::Error::custom)?,
            ),
            5 | 6 => ResData::Pixiv(SaucePixivData::deserialize(data).map_err(D::Error::custom)?),
            8 => ResData::NicoNico(SauceNicoNicoData::deserialize(data).map_err(D::Error::custom)?),
            9 => ResData::Danbooru(SauceDanbooruData::deserialize(data).map_err(D::Error::custom)?),
            10 => ResData::Drawr(SauceDrawrData::deserialize(data).map_err(D::Error::custom)?),
            11 => ResData::NijieImages(SauceNijieImagesData::deserialize(data).map_err(D::Error::custom)?),
            12 => ResData::Yandere(SauceYandereData::deserialize(data).map_err(D::Error::custom)?),
            16 => ResData::FAKKU(SauceFAKKUData::deserialize(data).map_err(D::Error::custom)?),
            18 | 38 => {
                ResData::EHentai(SauceEHentaiData::deserialize(data).map_err(D::Error::custom)?)
            }
            20 => ResData::MediBang(SauceMediBangData::deserialize(data).map_err(D::Error::custom)?),
            21 | 22 => ResData::Anime(SauceAnimeData::deserialize(data).map_err(D::Error::custom)?),
            23 => ResData::Movies(SauceMovieData::deserialize(data).map_err(D::Error::custom)?),
            25 => {
                ResData::Gelbooru(SauceGelbooruData::deserialize(data).map_err(D::Error::custom)?)
            }
            27 => ResData::Sankaku(SauceSankakuData::deserialize(data).map_err(D::Error::custom)?),
            28 => ResData::AnimePictures(SauceAnimePicturesData::deserialize(data).map_err(D::Error::custom)?),
            29 => ResData::E621(SauceE621Data::deserialize(data).map_err(D::Error::custom)?),
            31 => ResData::Bcy(SauceBcyIllustData::deserialize(data).map_err(D::Error::custom)?),
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
            39 => ResData::Artstation(
                SauceArtstationData::deserialize(data).map_err(D::Error::custom)?,
            ),
            40 => ResData::FurAffinity(
                SauceFurAffinityData::deserialize(data).map_err(D::Error::custom)?,
            ),
            41 => ResData::Twitter(SauceTwitterData::deserialize(data).map_err(D::Error::custom)?),
            42 => ResData::FurryNetwork(
                SauceFurryNetworkData::deserialize(data).map_err(D::Error::custom)?,
            ),
            43 => ResData::Kemono(SauceKemonoData::deserialize(data).map_err(D::Error::custom)?),
            44 => ResData::Skeb(SauceSkebData::deserialize(data).map_err(D::Error::custom)?),
            _ => return Err(D::Error::unknown_variant(&header.index_name, &[])),
        };
        Ok(Res { header, data })
    }
}

#[derive(Debug, Clone)]
pub enum ResData {
    HMagazines(SauceHMagazinesData),
    Pixiv(SaucePixivData),
    NicoNico(SauceNicoNicoData),
    Danbooru(SauceDanbooruData),
    Yandere(SauceYandereData),
    FAKKU(SauceFAKKUData),
    EHentai(SauceEHentaiData),
    Anime(SauceAnimeData),
    Gelbooru(SauceGelbooruData),
    Sankaku(SauceSankakuData),
    E621(SauceE621Data),
    Bcy(SauceBcyIllustData),
    DeviantArt(SauceDeviantArtData),
    Pawoo(SaucePawooData),
    Madokami(SauceMadokamiData),
    Mangadex(SauceMangadexData),
    Artstation(SauceArtstationData),
    FurAffinity(SauceFurAffinityData),
    Twitter(SauceTwitterData),
    FurryNetwork(SauceFurryNetworkData),
    Kemono(SauceKemonoData),
    Skeb(SauceSkebData),
    Movies(SauceMovieData),
    Drawr(SauceDrawrData),
    AnimePictures(SauceAnimePicturesData),
    NijieImages(SauceNijieImagesData),
    MediBang(SauceMediBangData),
}

impl ResData {
    pub fn get_ext_urls(&'_ self) -> Option<&'_ [String]> {
        match self {
            Self::HMagazines(_) => None,
            Self::Movies(data) => Some(&data.ext_urls),
            Self::Drawr(_) => None, // FIXME: Drawr no longer exists, find some way to convert the URL to pixiv sketch if possible
            Self::Pixiv(data) => Some(&data.ext_urls),
            Self::NicoNico(data) => Some(&data.ext_urls),
            Self::Danbooru(data) => Some(&data.ext_urls),
            Self::Yandere(data) => Some(&data.ext_urls),
            Self::FAKKU(data) => Some(&data.ext_urls),
            Self::EHentai(data) => data.ext_urls.as_ref().map(|x| &x[..]),
            Self::Anime(data) => Some(&data.ext_urls),
            Self::Gelbooru(data) => Some(&data.ext_urls),
            Self::Sankaku(data) => Some(&data.ext_urls),
            Self::E621(data) => Some(&data.ext_urls),
            Self::Bcy(data) => Some(&data.ext_urls),
            Self::DeviantArt(data) => Some(&data.ext_urls),
            Self::Pawoo(data) => Some(&data.ext_urls),
            Self::Madokami(SauceMadokamiData { ext_urls, .. })
            | Self::Mangadex(SauceMangadexData { ext_urls, .. })
            | Self::Artstation(SauceArtstationData { ext_urls, .. })
            | Self::FurAffinity(SauceFurAffinityData { ext_urls, .. })
            | Self::Twitter(SauceTwitterData { ext_urls, .. })
            | Self::FurryNetwork(SauceFurryNetworkData { ext_urls, .. })
            | Self::Kemono(SauceKemonoData { ext_urls, .. })
            | Self::Skeb(SauceSkebData { ext_urls, .. })
            | Self::AnimePictures(SauceAnimePicturesData { ext_urls, .. })
            | Self::NijieImages(SauceNijieImagesData { ext_urls, .. })
            | Self::MediBang(SauceMediBangData { ext_urls, .. }) => Some(ext_urls),
        }
    }
}

#[derive(Debug, Deserialize, Clone)]
pub struct SauceHMagazinesData {
    pub title: String,
    pub part: String,
    pub date: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SaucePixivData {
    pub ext_urls: Vec<String>,
    pub member_name: String,
    pub member_id: u32,
    pub title: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SauceNicoNicoData {
    pub ext_urls: Vec<String>,
    pub seiga_id: u32,
    pub member_name: String,
    pub member_id: u32,
    pub title: String,
}

#[derive(Debug, Deserialize, Clone)]
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

#[derive(Debug, Deserialize, Clone)]
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

#[derive(Debug, Deserialize, Clone)]
pub struct SauceFAKKUData {
    pub ext_urls: Vec<String>,
    pub source: String,
    pub creator: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SauceEHentaiData {
    pub ext_urls: Option<Vec<String>>,
    pub source: String,
    pub creator: Vec<String>,
    pub eng_name: Option<String>,
    pub jp_name: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SauceAnimeData {
    pub ext_urls: Vec<String>,
    pub anidb_aid: u32,
    pub part: Option<String>,
    pub year: Option<String>,
    pub est_time: String,
    pub source: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SauceGelbooruData {
    pub ext_urls: Vec<String>,
    /// Sometimes a URL String
    pub source: String,
    pub characters: String,
    pub material: String,
    pub creator: String,
    #[serde(rename = "anime-pictures_id")]
    pub anime_pictures_id: Option<u32>,
    pub gelbooru_id: u32,
    pub yandere_id: Option<u32>,
    pub danbooru_id: Option<u32>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SauceSankakuData {
    pub ext_urls: Vec<String>,
    pub sankaku_id: u32,
    pub creator: String,
    pub material: String,
    pub characters: String,
    pub source: String,
}

#[derive(Debug, Deserialize, Clone)]
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

#[derive(Debug, Deserialize, Clone)]
pub struct SauceBcyIllustData {
    pub ext_urls: Vec<String>,
    pub bcy_id: u32,
    pub member_name: String,
    pub member_id: u32,
    pub member_link_id: u32,
    pub bcy_type: String,
    pub title: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SauceDeviantArtData {
    pub ext_urls: Vec<String>,
    pub da_id: String,
    pub author_name: String,
    pub author_url: String,
    pub title: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SaucePawooData {
    pub ext_urls: Vec<String>,
    pub created_at: String,
    pub pawoo_id: u32,
    pub pawoo_user_acct: String,
    pub pawoo_user_username: String,
    pub pawoo_user_display_name: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SauceMadokamiData {
    pub ext_urls: Vec<String>,
    pub mu_id: u32,
    pub source: String,
    pub part: String,
    #[serde(rename = "type")]
    pub r#type: String,
}

#[derive(Debug, Deserialize, Clone)]
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

#[derive(Debug, Deserialize, Clone)]
pub struct SauceArtstationData {
    pub ext_urls: Vec<String>,
    /// ID of the project
    pub as_project: String,
    pub author_name: String,
    pub author_url: String,
    pub title: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SauceFurAffinityData {
    pub ext_urls: Vec<String>,
    pub fa_id: u32,
    pub author_name: String,
    pub author_url: String,
    pub title: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SauceTwitterData {
    pub ext_urls: Vec<String>,
    pub created_at: String,
    pub tweet_id: String,
    pub twitter_user_id: String,
    pub twitter_user_handle: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SauceFurryNetworkData {
    pub ext_urls: Vec<String>,
    pub fn_id: u32,
    pub fn_type: String,
    pub author_name: String,
    pub author_url: String,
    pub title: String,
}

#[derive(Debug, Deserialize, Clone)]
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

#[derive(Debug, Deserialize, Clone)]
pub struct SauceSkebData {
    pub ext_urls: Vec<String>,
    pub path: String,
    pub creator: String,
    pub creator_name: String,
    pub author_name: Option<String>,
    pub author_url: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SauceMovieData {
    pub ext_urls: Vec<String>,
    pub source: String,
    pub imdb_id: String,
    pub part: Option<String>,
    pub year: String,
    pub est_time: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SauceDrawrData {
    pub ext_urls: Vec<String>,
    pub title: String,
    pub drawr_id: u32,
    pub member_name: String,
    pub member_id: u32,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SauceAnimePicturesData {
    pub ext_urls: Vec<String>,
    #[serde(rename = "anime-pictures_id")]
    pub anime_pictures_id: u32,
    /// Can be empty
    pub creator: String,
    /// Can be empty
    pub material: String,
    /// Can be empty
    pub characters: String,
    /// Can be empty
    pub source: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SauceNijieImagesData {
    pub ext_urls: Vec<String>,
    pub title: String,
    pub nijie_id: u32,
    pub member_name: String,
    pub member_id: u32,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SauceMediBangData {
    pub ext_urls: Vec<String>,
    pub title: String,
    pub url: String,
    pub member_name: String,
    pub member_id: u32,
}
