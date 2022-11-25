## Japanese command
japanese = japones
    .desc = Busca en Jisho por la palabra
japenese-options-word = palabra
    .desc = Puede ser un kanji, silabas japonesas o incluso texto en ingles. (Funciona igual que Jisho)

## Anime opening command
op = op
    .desc = Busca por un opening o ending de anime
op-options-theme = tema
    .desc = El tema que queres buscar
# $sad-emoji (String) - Sad emoji used when errors happen
op-notfound =
    No se pudo encontrar el tema { $sad-emoji }
    Ayuda: Usa las sugerencias que aparecen mientras escribis para elegir el tema exacto que estas buscando.
# $sad-emoji (String) - Sad emoji used when errors happen
op-notuploaded = This theme is yet to be uploaded. { $sad-emoji }
# What appears before the video link
# $title (String) - Anime theme's title
# $artist (String) - Artist's name (can be a band)
op-message-prelude = **{ $title }** {$artist ->
    [none] { "" }
    *[some] from { $artist }
}
    { $link }

## Sauce command
sauce = sauce
    .desc = Searches the image's original source
sauce-options-image = image
    .desc = Image to reverse-lookup for
sauce-nsfw = **WARNING**: Image is NSFW so it's been censored!


## Sauce trace.moe command
sauce-tracemoe = tracemoe
    .desc = Searches the image's source with trace.moe
sauce-tracemoe-similarity = Similarity:
    .value = { NUMBER($amount, maximumFractionDigits: 2, style: "percent") }
sauce-tracemoe-timestamp = Timestamp:
    .value = Episode { $num } at { $timestamp }

## Sauce saucenao command
sauce-saucenao = saucenao
    .desc = Searches the image's source with SauceNAO
sauce-saucenao-similarity = Similarity { NUMBER($amount, maximumFractionDigits: 2, style: "percent") }
sauce-saucenao-part = Part:
    .value = { $num }
sauce-saucenao-timestamp = Timestamp:
    .value = { $timestamp }/{ $length }
sauce-saucenao-tweet = Tweet by { $user-handle }
sauce-saucenao-toot = Toot by { $pawoo-user }
sauce-saucenao-mangadex-authors = { $author }{$artist ->
    [none] { "" }
    *[artist] , { $artist }
}
sauce-saucenao-mangadex-part = Part:
    .value = {$type ->
    *[Chapter] Chapter { $num }
}
sauce-saucenao-skeb-title = Artwork request
sauce-saucenao-hmag-part = Part:
    .value = {$type ->
    *[vol] Volume { $num }
}
