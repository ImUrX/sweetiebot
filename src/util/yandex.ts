import { stripIndent } from "common-tags";
import { CommandInteraction } from "discord.js";
import FormData from "form-data";
import { decode } from "he";
import { request } from "undici";
import SweetieClient from "../lib/SweetieClient.js";
import EmbedList from "./EmbedList.js";
import { randomSadEmoji } from "./util";

export async function replyTo(interaction: CommandInteraction, show: number, url: string, client: SweetieClient): Promise<void> {
}

const searchUrl = "https://yandex.ru/images/search";

export async function getResponse(image: Buffer): Promise<SiteResponse> {
    const formData = new FormData();
    formData.append("upfile", image);
    const upload = await request(`${searchUrl}?rpt=imageview&format=json&request=${encodeURIComponent("{\"blocks\":[{\"block\":\"b-page_type_search-by-image__link\"}]}\")}")}`, {
        body: formData.getBuffer()
    }).then(res => res.body.json()) as UploadResponse;
    
    return await request(`${searchUrl}?${upload.blocks[0].params.url}`).then(res => res.body.text()).then(body => {
        const [,match] = body.match(/data-state="({&quot;sites&quot;:.+?)"/) ?? [];
        
        if(!match) {
            SweetieClient.LOGGER.error(body);
            throw new Error("Couldn't find the data-state from Yandex");
        }

        return JSON.parse(decode(body, { isAttributeValue: true })) as SiteResponse;
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
}

export type SiteResponse = {
    sites: {
        title: string,
        description: string,
        url: string,
        domain: string,
        thumb: ImageData,
        originalImage: ImageData
    }[],
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
}

export type ImageData = {
    url: string,
    height: number,
    width: number
}
