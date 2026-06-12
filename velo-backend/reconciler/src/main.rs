mod config;
mod matcher;
mod metrics;
mod processor;
mod stream;

use anyhow::Result;
use http_body_util::Full;
use hyper::body::Bytes;
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper::{Request, Response};
use hyper_util::rt::TokioIo;
use prometheus::{Encoder, Registry, TextEncoder};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::TcpListener;
use tracing::info;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(EnvFilter::from_default_env().add_directive("info".parse()?))
        .with(fmt::layer().json())
        .init();

    let config = config::Config::from_env()?;

    let db = sqlx::PgPool::connect(&config.database_url).await?;
    info!("Database connected");

    let redis_client = redis::Client::open(config.redis_url.clone())?;
    let redis_conn = redis::aio::ConnectionManager::new(redis_client).await?;
    info!("Redis connected");

    let registry = Registry::new();
    let metrics = Arc::new(metrics::Metrics::new(&registry));

    let cursor: String = sqlx::query_scalar("SELECT value FROM reconciler_state WHERE key = 'cursor'")
        .fetch_optional(&db)
        .await?
        .unwrap_or_default();
    info!(cursor = %cursor, "Loaded cursor");

    let metrics_port = config.metrics_port;
    let registry_clone = registry.clone();
    tokio::spawn(async move {
        serve_metrics(metrics_port, registry_clone).await.ok();
    });

    info!("Starting Horizon SSE stream");
    stream::listen_payments(config, db, redis_conn, metrics, cursor).await;

    Ok(())
}

async fn serve_metrics(port: u16, registry: Registry) -> Result<()> {
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = TcpListener::bind(addr).await?;
    info!(port, "Metrics server listening");

    loop {
        let (stream, _) = listener.accept().await?;
        let io = TokioIo::new(stream);
        let registry = registry.clone();
        tokio::spawn(async move {
            let svc = service_fn(move |_req: Request<hyper::body::Incoming>| {
                let registry = registry.clone();
                async move {
                    let encoder = TextEncoder::new();
                    let families = registry.gather();
                    let mut buffer = Vec::new();
                    encoder.encode(&families, &mut buffer).unwrap();
                    Ok::<_, hyper::Error>(
                        Response::builder()
                            .header("Content-Type", encoder.format_type())
                            .body(Full::new(Bytes::from(buffer)))
                            .unwrap(),
                    )
                }
            });
            http1::Builder::new().serve_connection(io, svc).await.ok();
        });
    }
}
