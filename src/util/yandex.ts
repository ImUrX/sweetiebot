import { CommandInteraction, EmbedBuilder } from "discord.js";
import he from "he";
import sharp from "sharp";
import { request, FormData } from "undici";
import SweetieClient from "../lib/SweetieClient.js";
import EmbedList from "./EmbedList.js";

export async function replyTo(interaction: CommandInteraction, show: number, url: string, client: SweetieClient): Promise<void> {
    interaction.deferReply();
    const buffer = await request(url).then(res => res.body.arrayBuffer());
    const res = await getResponse(Buffer.from(buffer));
    const embedList = new EmbedList({ time: 15000, displayAmount: show });
    for(const data of res.sites) {
        embedList.add(await createEmbed(data, client));
    }
    await embedList.send(interaction);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function createEmbed(data: SiteData, _client: SweetieClient): Promise<EmbedBuilder> {
    return new EmbedBuilder()
        .setTitle(data.title)
        .setDescription(data.description)
        .setImage(data.originalImage.url)
        .setURL(data.url)
        .setColor("Red");
}

const searchUrl = "https://yandex.ru/images/search";

export async function getResponse(image: Buffer): Promise<SiteResponse> {
    const formData = new FormData();
    formData.append("upfile", await sharp(image).toFormat("jpg").toBuffer());
    const upload = await request(`${searchUrl}?rpt=imageview&format=json&request=${encodeURIComponent("{\"blocks\":[{\"block\":\"b-page_type_search-by-image__link\"}]}\")}")}`, {
        body: formData
    }).then(res => res.body.json()) as UploadResponse;
    
    if(!upload.blocks[0]) {
        SweetieClient.LOGGER.error(upload);
        throw new Error("Couldn't find the image on the upload request to Yandex!");
    }

    return await request(`${searchUrl}?${upload.blocks[0].params.url}`).then(res => res.body.text()).then(body => {
        const [,match] = body.match(/data-state="({&quot;sites&quot;:.+?)"/) ?? [];
        
        if(!match) {
            SweetieClient.LOGGER.error(body);
            throw new Error("Couldn't find the data-state from Yandex");
        }

        return JSON.parse(he.decode(body, { isAttributeValue: true })) as SiteResponse;
    });
}

export type UploadResponse = {
    blocks: {
        name: {
            block: string
        },
        params: {
            url: string,
            originalImageUrl: string,
            cbirId: string
        },
        html: string
    }[]
};

export type ImageData = {
    url: string,
    height: number,
    width: number
};

export type SiteData = {
    title: string,
    description: string,
    url: string,
    domain: string,
    thumb: ImageData,
    originalImage: ImageData
};

export type SiteResponse = {
    sites: SiteData[],
    pageSize: number,
    loadedPagesCount: number,
    faviconSpriteSeed: string,
    withFavicon: boolean,
    counterPaths: {
        item: string,
        itemThumbClick: string,
        itemTitleClick: string,
        itemDomainClick: string,
        loadPage: string
    },
    lazyThumbsFromIndex: number,
    title: string
};
