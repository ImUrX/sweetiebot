use anyhow::{bail, ensure, Result};
use lazy_static::lazy_static;
use regex::Regex;
use reqwest::multipart;
use serde::Deserialize;
use twilight_model::channel::Attachment;
use twilight_util::builder::embed::{EmbedBuilder, ImageSource};

const URL: &str = "https://yandex.ru/images/search";

/// Returns a captcha packet so not possible to use yandex at the end.
pub async fn fetch(attachment: &Attachment) -> Result<SiteResponse> {
    lazy_static! {
        static ref RE: Regex = Regex::new(r#"data-state="(\{&quot;sites&quot;:.+?)"#).unwrap();
    }

    let form = multipart::Form::new().part(
        "upfile",
        multipart::Part::bytes(super::get_bytes(&attachment.proxy_url).await?.to_vec())
            .mime_str(attachment.content_type.as_deref().unwrap_or("image/jpeg"))?,
    );

    let client = reqwest::Client::new();
    let upload = client
        .post(URL)
        .query(&[
            ("rpt", "imageview"),
            ("format", "json"),
            (
                "request",
                r#"{"blocks":[{"block":"b-page_type_search-by-image__link"}]}"#,
            ),
        ])
        .multipart(form)
        .send()
        .await?
        .json::<UploadResponse>()
        .await?;

    ensure!(
        !upload.blocks.is_empty(),
        "Couldn't find the image on the upload request to Yandex!"
    );

    let res = client
        .get(format!("{}?{}", URL, upload.blocks[0].params.url))
        .send()
        .await?
        .text()
        .await?;

    if let Some(_cpt @ Some(site)) = RE.captures(&res).map(|c| c.get(1)) {
        Ok(serde_json::from_str(
            html_escape::decode_html_entities(site.as_str()).as_ref(),
        )?)
    } else {
        bail!("Couldn't find the data-state from Yandex")
    }
}

pub async fn build_embed(site: &SiteData) -> Result<EmbedBuilder> {
    Ok(EmbedBuilder::new()
        .title(site.title.clone())
        .image(ImageSource::url(site.original_image.url.clone())?)
        .url(site.url.clone())
        .color(0xed4245))
}

#[derive(Debug, Deserialize)]
pub struct UploadBlockName {
    pub block: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadBlockParameters {
    pub url: String,
    pub original_image_url: String,
    pub cbir_id: String,
}

#[derive(Debug, Deserialize)]
pub struct UploadBlock {
    pub name: UploadBlockName,
    pub params: UploadBlockParameters,
    pub html: String,
}

#[derive(Debug, Deserialize)]
pub struct UploadResponse {
    pub blocks: Vec<UploadBlock>,
}

#[derive(Debug, Deserialize)]
pub struct ImageData {
    pub url: String,
    pub height: u32,
    pub width: u32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SiteData {
    pub title: String,
    pub description: String,
    pub url: String,
    pub domain: String,
    pub thumb: ImageData,
    pub original_image: ImageData,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SiteAnalytics {
    pub item: String,
    pub item_thumb_click: String,
    pub item_title_click: String,
    pub item_domain_click: String,
    pub load_page: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SiteResponse {
    pub sites: Vec<SiteData>,
    pub page_size: usize,
    pub loaded_pages_count: usize,
    pub favicon_sprite_seed: String,
    pub with_favicon: bool,
    pub counter_paths: SiteAnalytics,
    pub lazy_thumbs_from_index: usize,
    pub title: String,
}
