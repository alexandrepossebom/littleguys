//! Connects to the gateway described by the OpenClaw config (honoring
//! OPENCLAW_PROFILE / OPENCLAW_GATEWAY_PORT / OPENCLAW_GATEWAY_TOKEN) and runs
//! a few read RPCs. `cargo run --example gw_probe -- [method [json-params]]`
use std::time::Duration;

use std::sync::Arc;

use littleguys_lib::gateway::client::{EndpointSource, GatewayClient, Hooks, Phase};
use littleguys_lib::gateway::identity::{DeviceIdentity, DeviceTokenStore};
use littleguys_lib::openclaw::config::OpenclawPaths;
use serde_json::{json, Value};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let _ = rustls::crypto::ring::default_provider().install_default();
    // PROBE_DATA_DIR=<dir> reuses an existing device identity (e.g. the app's own).
    let dir = std::env::var("PROBE_DATA_DIR")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| dirs::data_dir().unwrap().join("ai.littleguys.app-probe"));
    std::fs::create_dir_all(&dir)?;
    let hooks = Hooks {
        status: Box::new(|s| eprintln!("[status] {:?} {}", s.phase, s.message.clone().unwrap_or_default())),
        event: Box::new(|name, payload, _| {
            if name != "tick" && name != "health" {
                let s = payload.to_string();
                let max: usize = std::env::var("PROBE_EVENT_CHARS").ok().and_then(|v| v.parse().ok()).unwrap_or(300);
                eprintln!("[event] {name} {}", &s[..s.len().min(max)]);
            }
        }),
        connected: Box::new(|| eprintln!("[connected]")),
    };
    // PROBE_URL=wss://host probes a gateway that isn't in the OpenClaw config.
    let source = match std::env::var("PROBE_URL") {
        Ok(url) => EndpointSource::Fixed { url: littleguys_lib::gateways::normalize_url(&url).map_err(anyhow::Error::msg)? },
        Err(_) => EndpointSource::OpenclawConfig,
    };
    let client = GatewayClient::new(
        "probe".into(),
        "probe".into(),
        source,
        None,
        Arc::new(DeviceIdentity::load_or_create(&dir)?),
        Arc::new(DeviceTokenStore::new(&dir)),
        OpenclawPaths::resolve(),
        "0.1.0".into(),
        hooks,
    );
    client.start();
    for _ in 0..100 {
        if client.status().phase == Phase::Connected {
            break;
        }
        tokio::time::sleep(Duration::from_millis(200)).await;
    }
    let status = client.status();
    if status.phase != Phase::Connected {
        anyhow::bail!("not connected: {:?} {:?} {:?}", status.phase, status.message, status.request_id);
    }
    println!("server {:?} scopes {:?}", status.server_version, status.scopes);
    let args: Vec<String> = std::env::args().skip(1).collect();
    let calls: Vec<(String, Value)> = if !args.is_empty() {
        args.chunks(2)
            .map(|c| (c[0].clone(), c.get(1).map(|p| serde_json::from_str(p).unwrap()).unwrap_or(json!({}))))
            .collect()
    } else {
        vec![
            ("agents.list".into(), json!({})),
            ("sessions.list".into(), json!({"limit": 5, "includeLastMessage": true})),
            ("cron.list".into(), json!({})),
        ]
    };
    for (method, params) in calls {
        match client.call(&method, params).await {
            Ok(v) => {
                let s = serde_json::to_string_pretty(&v)?;
                println!("== {method} ok\n{}", &s[..s.len().min(std::env::var("PROBE_OUT_CHARS").ok().and_then(|v| v.parse().ok()).unwrap_or(4000))]);
            }
            Err(e) => println!("== {method} ERR {e} {:?}", e.details),
        }
    }
    let wait: u64 = std::env::var("PROBE_WAIT").ok().and_then(|v| v.parse().ok()).unwrap_or(0);
    tokio::time::sleep(Duration::from_millis(300 + wait * 1000)).await;
    Ok(())
}
