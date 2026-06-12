use anyhow::{Context, Result};

#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub redis_url: String,
    pub horizon_url: String,
    pub treasury_public_key: String,
    pub usdc_asset_code: String,
    pub usdc_asset_issuer: String,
    pub stellar_network: String,
    pub metrics_port: u16,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        Ok(Self {
            database_url: std::env::var("DATABASE_URL").context("DATABASE_URL missing")?,
            redis_url: std::env::var("REDIS_URL").context("REDIS_URL missing")?,
            horizon_url: std::env::var("STELLAR_HORIZON_URL")
                .unwrap_or_else(|_| "https://horizon-testnet.stellar.org".into()),
            treasury_public_key: std::env::var("STELLAR_TREASURY_PUBLIC_KEY")
                .context("STELLAR_TREASURY_PUBLIC_KEY missing")?,
            usdc_asset_code: std::env::var("USDC_ASSET_CODE").unwrap_or_else(|_| "USDC".into()),
            usdc_asset_issuer: std::env::var("USDC_ASSET_ISSUER")
                .context("USDC_ASSET_ISSUER missing")?,
            stellar_network: std::env::var("STELLAR_NETWORK").unwrap_or_else(|_| "testnet".into()),
            metrics_port: std::env::var("METRICS_PORT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(9090),
        })
    }
}
