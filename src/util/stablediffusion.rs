use anyhow::Result;
use once_cell::sync::Lazy;
use rand::Rng;
use serde::{Deserialize, Serialize};

static API_URL: Lazy<String> = Lazy::new(|| std::env::var("STABLE_DIFFUSION").unwrap());

pub async fn get_txt2img(req: &Txt2Img) -> Result<Txt2ImgRes> {
    let body = serde_json::to_string(&req)?;
    let client = reqwest::Client::new();
    let res = client
        .post(format!("{}/sdapi/v1/txt2img", API_URL.as_str()))
        .body(body)
        .header("Content-Type", "application/json")
        .send()
        .await?
        .json::<Txt2ImgRes>()
        .await?;
    Ok(res)
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Txt2Img {
    pub enable_hr: bool,
    pub denoising_strength: f32,
    pub firstphase_width: i32,
    pub firstphase_height: i32,
    pub prompt: String,
    pub styles: Vec<String>,
    pub seed: i32,
    pub subseed: i32,
    pub subseed_strength: f32,
    pub seed_resize_from_h: i32,
    pub seed_resize_from_w: i32,
    pub sampler_name: String,
    pub batch_size: i32,
    pub n_iter: i32,
    pub steps: i32,
    pub cfg_scale: f32,
    pub width: i32,
    pub height: i32,
    pub restore_faces: bool,
    pub tiling: bool,
    pub negative_prompt: String,
    pub eta: f32,
    pub s_churn: f32,
    pub s_tmax: f32,
    pub s_tmin: f32,
    pub s_noise: f32,
    pub sampler_index: String,
}

impl Default for Txt2Img {
    fn default() -> Self {
        let mut thread_rng = rand::thread_rng();
        Self {
            enable_hr: false,
            denoising_strength: 0.0,
            firstphase_width: 0,
            firstphase_height: 0,
            prompt: "".to_string(),
            styles: vec![],
            seed: thread_rng.gen::<i32>(),
            subseed: thread_rng.gen::<i32>(),
            subseed_strength: 0.0,
            seed_resize_from_h: -1,
            seed_resize_from_w: -1,
            sampler_name: "Euler a".to_string(),
            batch_size: 1,
            n_iter: 1,
            steps: 20,
            cfg_scale: 7.0,
            width: 512,
            height: 512,
            restore_faces: false,
            tiling: false,
            negative_prompt: "".to_string(),
            eta: 0.0,
            s_churn: 0.0,
            s_tmax: 0.0,
            s_tmin: 0.0,
            s_noise: 0.0,
            sampler_index: "Euler a".to_string(),
        }
    }
}

#[derive(Deserialize, Debug)]
pub struct Txt2ImgRes {
    pub images: Option<Vec<String>>,
    pub info: String,
}
