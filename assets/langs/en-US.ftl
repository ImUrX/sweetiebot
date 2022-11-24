## Japanese command
japanese = japanese
    .desc = Searches in Jisho for the word
japenese-options-word = word
    .desc = Can be a kanji, a japanese word or even an english word (Same search features as Jisho)

## Anime opening command
op = op
    .desc = Searches for an anime opening or ending
op-options-theme = theme
    .desc = Theme to look for
# $sad-emoji (String) - Sad emoji used when errors happen
op-notfound =
    Couldn't find the anime theme { $sad-emoji }
    Hint: Use the suggestions that pop up while you write so you can search the precise theme you are searching for.
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
