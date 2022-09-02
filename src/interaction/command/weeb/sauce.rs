use twilight_interactions::command::{CommandModel, CreateCommand};
use twilight_model::channel::Attachment;

#[derive(CommandModel, CreateCommand)]
#[command(name = "sauce", desc = "Searches the image's original source")]
pub enum SauceCommand {
    #[command(name = "saucenao")]
    SauceNAO(SauceSauceNAO),
    #[command(name = "tracemoe")]
    TraceMoe(SauceTraceMoe),
    #[command(name = "yandex")]
    Yandex(SauceYandex),
}

#[derive(CommandModel, CreateCommand)]
#[command(name = "saucenao", desc = "Searches the image's source with SauceNAO")]
pub struct SauceSauceNAO {
    #[command(desc = "Image to reverse-lookup for")]
    image: Attachment,
}

#[derive(CommandModel, CreateCommand)]
#[command(name = "tracemoe", desc = "Searches the image's source with trace.moe")]
pub struct SauceTraceMoe {
    #[command(desc = "Image to reverse-lookup for")]
    image: Attachment,
}

#[derive(CommandModel, CreateCommand)]
#[command(name = "tracemoe", desc = "Searches the image's source with Yandex")]
pub struct SauceYandex {
    #[command(desc = "Image to reverse-lookup for")]
    image: Attachment,
}
