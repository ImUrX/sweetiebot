import { Blob } from "buffer";
import { CommandInteraction, EmbedBuilder } from "discord.js";
import he from "he";
import { fetch, FormData } from "undici";
import SweetieClient from "../lib/SweetieClient.js";
import EmbedList from "./EmbedList.js";

export async function replyTo(interaction: CommandInteraction, show: number, url: string, client: SweetieClient): Promise<void> {
    interaction.deferReply();
    const blob = await fetch(url).then(res => res.blob());
    const res = await getResponse(blob);
    const embedList = new EmbedList({ time: 15000, displayAmount: show });
    for(const data of res.sites) {
        embedList.add(await createEmbed(data, client));
    }
    await embedList.send(interaction);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function createEmbed(data: SiteData, _client: SweetieClient): Promise<EmbedBuilder> {
    const embed = new EmbedBuilder()
        .setTitle(data.title)
        .setImage(data.originalImage.url)
        .setURL(data.url)
        .setColor("Red");
    if(data.description) embed.setDescription(data.description);
    return embed;
}

const searchUrl = "https://yandex.ru/images/search";

export async function getResponse(image: Blob): Promise<SiteResponse> {
    const formData = new FormData();
    formData.append("upfile", image);
    const upload = await fetch(`${searchUrl}?rpt=imageview&format=json&request=${encodeURIComponent("{\"blocks\":[{\"block\":\"b-page_type_search-by-image__link\"}]}")}`, {
        body: formData,
        method: "POST"
    }).then(res => res.json()) as UploadResponse;
    
    if(!upload.blocks[0]) {
        SweetieClient.LOGGER.error(upload);
        throw new Error("Couldn't find the image on the upload request to Yandex!");
    }

    return await fetch(`${searchUrl}?${upload.blocks[0].params.url}`).then(res => res.text()).then(body => {
        const [,match] = body.match(/data-state="({&quot;sites&quot;:.+?)"/) ?? [];
        
        if(!match) {
            SweetieClient.LOGGER.error(body);
            SweetieClient.LOGGER.error(`${searchUrl}?${upload.blocks[0].params.url}`);
            throw new Error("Couldn't find the data-state from Yandex");
        }

        return JSON.parse(he.decode(match, { isAttributeValue: true })) as SiteResponse;
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
