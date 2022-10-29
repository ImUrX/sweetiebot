pub struct UploadBlockName {
    block: String,
}

pub struct UploadBlockParameters {
    url: String,
    originalImageUrl: String,
    cbirId: String
}

pub struct UploadBlock {
    name: UploadBlockName,
    params: UploadBlockParameters,
    html: String
}

pub struct UploadResponse {
    blocks: Vec<UploadBlock>,
}

pub struct ImageData {
    url: String,
    height: u32,
    width: u32
}

pub struct SiteData {
    title: String,
    description: String,
    url: String,
    domain: String,
    thumb: ImageData,
    originalImage: ImageData
}

pub struct SiteResponse {
    sites: Vec<SiteData>,
    pageSize: usize,
    loadedPagesCount: usize,
    faviconSpriteSeed: String,
    withFavicon: bool,
    counterPaths: {
        item: String,
        itemThumbClick: String,
        itemTitleClick: String,
        itemDomainClick: String,
        loadPage: String
    },
    lazyThumbsFromIndex: usize,
    title: String
}