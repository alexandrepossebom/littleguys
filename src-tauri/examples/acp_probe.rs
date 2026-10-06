//! Drives an ACP agent through littleguys' adapter and prints every event.
//!
//! `cargo run --example acp_probe -- ["prompt" …]`
//!
//! - `PROBE_CMD`   command line (default `npx -y @agentclientprotocol/claude-agent-acp`)
//! - `PROBE_WS`    use the WebSocket transport at this URL instead (`PROBE_TOKEN` = bearer)
//! - `PROBE_ENV`   extra env for the agent, `K=V,K2=V2`
//! - `PROBE_CWD`   the agent's folder (default `<PROBE_DATA>/cwd`)
//! - `PROBE_DATA`  littleguys data dir (default `$TMPDIR/littleguys-acp-probe`)
//! - `PROBE_KEY`   send to this thread (e.g. `agent:bot:main`) instead of a new one
//! - `PROBE_DECISION` answer to permission requests: allow-once|allow-always|deny (default) |
//!   wait (leave them pending)
//! - `PROBE_ABORT_MS` call `chat.abort` this long after each send
//! - `PROBE_CRON`  after the prompts, add + run a routine with this message
//!   (`PROBE_CRON_TARGET`: isolated (default) | session:<key>), then remove it
//! - `PROBE_LINGER` seconds to wait after connecting (to watch late status changes)
//! - `PROBE_CALLS` JSON `[[method, params], …]` to call right after connecting
//! - `PROBE_REGISTRY=1` just print the launchable agents from the ACP registry
//! - `PROBE_EVENT_CHARS` how much of each event to print (default 400)
//!
//! With no prompts it only lists guys/threads (and history for `PROBE_KEY`).
use std::time::Duration;

use littleguys_lib::gateway::client::{Hooks, Phase};
use littleguys_lib::gateways::{AcpConfig, AcpTransport};
use littleguys_lib::openclaw::config::Credential;
use littleguys_lib::runtime::acp::AcpClient;
use serde_json::{json, Value};

fn short(v: &Value, max: usize) -> String {
    let s = v.to_string();
    if s.chars().count() > max {
        format!("{}…", s.chars().take(max).collect::<String>())
    } else {
        s
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let _ = rustls::crypto::ring::default_provider().install_default();
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("littleguys_lib=info")).init();
    if std::env::var("PROBE_REGISTRY").is_ok() {
        let agents = littleguys_lib::runtime::acp::fetch_registry().await.map_err(anyhow::Error::msg)?;
        for a in &agents {
            println!("{:<22} {:<22} {} {}", a.id, a.name, a.command, a.args.join(" "));
        }
        println!("== {} launchable agents", agents.len());
        return Ok(());
    }
    let max: usize = std::env::var("PROBE_EVENT_CHARS").ok().and_then(|v| v.parse().ok()).unwrap_or(400);
    let data = std::env::var("PROBE_DATA")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::env::temp_dir().join("littleguys-acp-probe"));
    let cwd = std::env::var("PROBE_CWD").map(std::path::PathBuf::from).unwrap_or_else(|_| data.join("cwd"));
    std::fs::create_dir_all(&cwd)?;

    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<(String, Value)>();
    let hooks = Hooks {
        status: Box::new(|s| {
            eprintln!(
                "[status] {:?} {} {}",
                s.phase,
                s.server_version.clone().unwrap_or_default(),
                s.message.clone().unwrap_or_default()
            )
        }),
        event: Box::new(move |name, payload, _| {
            eprintln!("[event] {name} {}", short(payload, max));
            let _ = tx.send((name.to_string(), payload.clone()));
        }),
        connected: Box::new(|| eprintln!("[connected]")),
    };

    let (config, credential) = match std::env::var("PROBE_WS") {
        Ok(url) => (
            AcpConfig { transport: AcpTransport::Websocket, url: Some(url), ..Default::default() },
            std::env::var("PROBE_TOKEN").ok().map(Credential::Token),
        ),
        Err(_) => {
            let line = std::env::var("PROBE_CMD").unwrap_or_else(|_| "npx -y @agentclientprotocol/claude-agent-acp".into());
            let mut parts = line.split_whitespace().map(str::to_string);
            let command = parts.next();
            (AcpConfig { transport: AcpTransport::Stdio, command, args: parts.collect(), ..Default::default() }, None)
        }
    };
    let env = std::env::var("PROBE_ENV")
        .unwrap_or_default()
        .split(',')
        .filter_map(|kv| kv.split_once('=').map(|(k, v)| (k.trim().to_string(), v.trim().to_string())))
        .collect();
    let config = AcpConfig {
        env,
        cwd: Some(cwd.display().to_string()),
        agent_name: "Probe".into(),
        emoji: Some("🧪".into()),
        ..config
    };
    let client = AcpClient::new("probe".into(), "Probe".into(), config, credential, data.clone(), hooks);
    client.start();
    for _ in 0..900 {
        if matches!(client.status().phase, Phase::Connected | Phase::AuthFailed | Phase::NoConfig | Phase::Error | Phase::Offline) {
            break;
        }
        tokio::time::sleep(Duration::from_millis(200)).await;
    }
    let linger: u64 = std::env::var("PROBE_LINGER").ok().and_then(|v| v.parse().ok()).unwrap_or(0);
    tokio::time::sleep(Duration::from_secs(linger)).await;
    let status = client.status();
    if status.phase != Phase::Connected {
        client.stop();
        anyhow::bail!("not connected: {:?} {:?}", status.phase, status.message);
    }
    println!("== connected to {:?} {:?}, caps {:?}", status.url, status.server_version, status.capabilities);
    println!("== agents.list {}", client.call("agents.list", json!({})).await.map_err(|e| anyhow::anyhow!("{e}"))?);

    if let Ok(raw) = std::env::var("PROBE_CALLS") {
        let calls: Vec<(String, Value)> = serde_json::from_str(&raw)?;
        for (method, params) in calls {
            let r = client.call(&method, params).await;
            println!("== {method} → {}", r.map(|v| short(&v, max)).unwrap_or_else(|e| format!("ERR {e}")));
        }
    }

    let prompts: Vec<String> = std::env::args().skip(1).collect();
    let key = match std::env::var("PROBE_KEY") {
        Ok(key) => key,
        Err(_) if prompts.is_empty() => String::new(),
        Err(_) => {
            let created = client.call("sessions.create", json!({ "agentId": "bot", "label": "probe" })).await;
            let created = created.map_err(|e| anyhow::anyhow!("sessions.create: {e}"))?;
            println!("== sessions.create {created}");
            created["key"].as_str().unwrap_or_default().to_string()
        }
    };
    let decision = std::env::var("PROBE_DECISION").unwrap_or_else(|_| "deny".into());

    for prompt in &prompts {
        // Drop events from earlier turns.
        while rx.try_recv().is_ok() {}
        let sent = client
            .call("chat.send", json!({ "sessionKey": key, "message": prompt, "idempotencyKey": uuid::Uuid::new_v4().to_string() }))
            .await
            .map_err(|e| anyhow::anyhow!("chat.send: {e}"))?;
        println!("== chat.send {prompt:?} → {sent}");
        if let Some(ms) = std::env::var("PROBE_ABORT_MS").ok().and_then(|v| v.parse::<u64>().ok()) {
            let (client, key) = (client.clone(), key.clone());
            tokio::spawn(async move {
                tokio::time::sleep(Duration::from_millis(ms)).await;
                let r = client.call("chat.abort", json!({ "sessionKey": key })).await;
                println!("== chat.abort → {}", r.map(|v| v.to_string()).unwrap_or_else(|e| e.to_string()));
            });
        }
        let deadline = tokio::time::Instant::now() + Duration::from_secs(300);
        loop {
            let Ok(Some((name, payload))) = tokio::time::timeout_at(deadline, rx.recv()).await else {
                println!("== timed out waiting for the turn to end");
                break;
            };
            if name == "exec.approval.requested" && decision != "wait" {
                let pending = client.call("exec.approval.list", json!({})).await;
                println!("== exec.approval.list {}", pending.map(|v| short(&v, max)).unwrap_or_else(|e| e.to_string()));
                let id = payload["id"].as_str().unwrap_or_default();
                let r = client.call("exec.approval.resolve", json!({ "id": id, "decision": decision })).await;
                println!("== exec.approval.resolve {decision} → {}", r.map(|v| v.to_string()).unwrap_or_else(|e| e.to_string()));
            }
            if name == "chat" && payload["sessionKey"] == key.as_str() {
                let state = payload["state"].as_str().unwrap_or_default();
                if matches!(state, "final" | "error" | "aborted") {
                    println!("== turn ended: {state} {}", payload["errorMessage"].as_str().unwrap_or_default());
                    break;
                }
            }
        }
    }

    if let Ok(message) = std::env::var("PROBE_CRON") {
        while rx.try_recv().is_ok() {}
        let target = std::env::var("PROBE_CRON_TARGET").unwrap_or_else(|_| "isolated".into());
        let job = client
            .call(
                "cron.add",
                json!({
                    "name": "Probe routine",
                    "agentId": "bot",
                    "schedule": { "kind": "every", "everyMs": 86_400_000 },
                    "payload": { "kind": "agentTurn", "message": message },
                    "sessionTarget": target,
                }),
            )
            .await
            .map_err(|e| anyhow::anyhow!("cron.add: {e}"))?;
        let id = job["id"].as_str().unwrap_or_default().to_string();
        println!("== cron.add {}", short(&job, max));
        println!("== cron.run {}", client.call("cron.run", json!({ "id": id })).await.map(|v| v.to_string()).unwrap_or_else(|e| e.to_string()));
        let deadline = tokio::time::Instant::now() + Duration::from_secs(300);
        while let Ok(Some((name, payload))) = tokio::time::timeout_at(deadline, rx.recv()).await {
            if name == "cron" && payload["action"] == "finished" {
                println!("== routine finished: {}", short(&payload, max));
                break;
            }
        }
        let runs = client.call("cron.runs", json!({ "id": id })).await;
        println!("== cron.runs {}", runs.map(|v| short(&v, max)).unwrap_or_else(|e| e.to_string()));
        println!("== cron.remove {}", client.call("cron.remove", json!({ "id": id })).await.map(|v| v.to_string()).unwrap_or_else(|e| e.to_string()));
    }

    if !key.is_empty() {
        let history = client.call_with_timeout("chat.history", json!({ "sessionKey": key, "limit": 50 }), Duration::from_secs(90)).await;
        match history {
            Ok(h) => {
                println!("== chat.history {key} ({} messages, hasMore {})", h["totalMessages"], h["hasMore"]);
                for m in h["messages"].as_array().into_iter().flatten() {
                    println!("   {:<10} {}", m["role"].as_str().unwrap_or("?"), short(&m["content"], 240));
                }
            }
            Err(e) => println!("== chat.history ERR {e}"),
        }
    }
    match client.call("sessions.list", json!({ "limit": 20 })).await {
        Ok(list) => {
            println!("== sessions.list");
            for row in list["sessions"].as_array().into_iter().flatten() {
                println!(
                    "   {} | {} | label={} | unread={} | {}",
                    row["key"],
                    row["derivedTitle"],
                    row["label"],
                    row["unread"],
                    row["lastMessagePreview"]
                );
            }
        }
        Err(e) => println!("== sessions.list ERR {e}"),
    }
    client.stop();
    tokio::time::sleep(Duration::from_millis(1500)).await;
    Ok(())
}
