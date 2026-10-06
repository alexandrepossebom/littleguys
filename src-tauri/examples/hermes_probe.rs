//! Drives a Hermes Agent install through littleguys' Hermes adapter.
//!
//! `cargo run --example hermes_probe -- [steps…]` where steps are any of
//! `agents sessions send approve cron` (default: all but `approve`).
//!
//! Env:
//! - `HERMES_URL`      backend / API server URL (local mode default: discovered via the spawn ledger)
//! - `HERMES_MODE`     `local` (default) or `api`
//! - `HERMES_PROFILE`  only this profile (also the guy used for send/cron; default: the default profile)
//! - `HERMES_KEY`      API server key (api mode)
//! - `PROBE_PROMPT`    prompt for `send` (default "reply with just: ok")
//! - `PROBE_APPROVE`   prompt that triggers a dangerous command for `approve` (default "LG_APPROVE")
//! - `PROBE_DECISION`  allow-once | allow-always | deny (default deny)
use std::time::Duration;

use littleguys_lib::gateway::client::{Hooks, Phase};
use littleguys_lib::gateways::{HermesConfig, HermesMode};
use littleguys_lib::openclaw::config::Credential;
use littleguys_lib::runtime::hermes::{self, HermesClient};
use serde_json::{json, Value};
use tokio::sync::mpsc;

fn short(v: &Value, max: usize) -> String {
    let s = v.to_string();
    if s.len() > max {
        format!("{}…", &s[..s.char_indices().take_while(|(i, _)| *i < max).last().map(|(i, c)| i + c.len_utf8()).unwrap_or(0)])
    } else {
        s
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let _ = rustls::crypto::ring::default_provider().install_default();
    let mode = match std::env::var("HERMES_MODE").as_deref() {
        Ok("api") => HermesMode::Api,
        _ => HermesMode::Local,
    };
    let url = std::env::var("HERMES_URL").ok().filter(|u| !u.is_empty());
    if let Some(u) = &url {
        println!("probe({u}) = {:?}", hermes::probe(u).await);
    }
    println!("local_backend_url() = {:?}", hermes::local_backend_url());
    let profile = std::env::var("HERMES_PROFILE").ok().filter(|p| !p.is_empty());
    let credential = std::env::var("HERMES_KEY").ok().map(Credential::Token);
    let config = HermesConfig { mode, url, profile: profile.clone() };
    let data_dir = std::env::temp_dir().join("littleguys-hermes-probe");
    std::fs::create_dir_all(&data_dir)?;

    let (tx, mut rx) = mpsc::unbounded_channel::<(String, Value)>();
    let hooks = Hooks {
        status: Box::new(|s| eprintln!("[status] {:?} {} {}", s.phase, s.url.clone().unwrap_or_default(), s.message.clone().unwrap_or_default())),
        event: Box::new(move |name, payload, _| {
            let _ = tx.send((name.to_string(), payload.clone()));
        }),
        connected: Box::new(|| eprintln!("[connected]")),
    };
    let client = HermesClient::new("probe".into(), "Hermes".into(), config, credential, data_dir, hooks);
    client.start();
    for _ in 0..150 {
        if client.status().phase == Phase::Connected {
            break;
        }
        tokio::time::sleep(Duration::from_millis(200)).await;
    }
    let status = client.status();
    if status.phase != Phase::Connected {
        anyhow::bail!("not connected: {:?} {:?}", status.phase, status.message);
    }
    println!("connected: url={:?} version={:?} message={:?}", status.url, status.server_version, status.message);
    println!("capabilities: {}", serde_json::to_string(&status.capabilities)?);

    let args: Vec<String> = std::env::args().skip(1).collect();
    let wants = |s: &str| if args.is_empty() { !matches!(s, "approve" | "abort" | "watch" | "reattach") } else { args.iter().any(|a| a == s) };

    let agents = client.call("agents.list", json!({})).await.map_err(anyhow::Error::msg)?;
    let guy = profile.clone().or_else(|| agents["defaultId"].as_str().map(str::to_string)).unwrap_or_else(|| "default".into());
    if wants("agents") {
        println!("== agents.list\n{}", serde_json::to_string_pretty(&agents)?);
    }
    if wants("sessions") {
        let sessions = client.call("sessions.list", json!({ "limit": 50 })).await.map_err(anyhow::Error::msg)?;
        println!("== sessions.list ({} rows)", sessions["sessions"].as_array().map_or(0, Vec::len));
        for row in sessions["sessions"].as_array().into_iter().flatten().take(12) {
            println!("  {}", short(row, 260));
        }
    }

    // Drain events until `pred` matches (or timeout); prints everything but noisy deltas.
    async fn wait_for(rx: &mut mpsc::UnboundedReceiver<(String, Value)>, secs: u64, mut pred: impl FnMut(&str, &Value) -> bool) -> Option<(String, Value)> {
        let deadline = tokio::time::Instant::now() + Duration::from_secs(secs);
        loop {
            match tokio::time::timeout_at(deadline, rx.recv()).await {
                Ok(Some((name, payload))) => {
                    if !(name == "chat" && payload["state"] == "delta") {
                        println!("  [event] {name} {}", short(&payload, 400));
                    }
                    if pred(&name, &payload) {
                        return Some((name, payload));
                    }
                }
                _ => return None,
            }
        }
    }
    let ended = |name: &str, p: &Value| name == "chat" && matches!(p["state"].as_str(), Some("final" | "aborted" | "error"));

    if wants("send") {
        let created = client.call("sessions.create", json!({ "agentId": guy, "label": "littleguys probe" })).await.map_err(anyhow::Error::msg)?;
        println!("== sessions.create {created}");
        let key = created["key"].as_str().unwrap_or_default().to_string();
        let prompt = std::env::var("PROBE_PROMPT").unwrap_or_else(|_| "reply with just: ok".into());
        let sent = client
            .call_with_timeout("chat.send", json!({ "sessionKey": key, "message": prompt, "idempotencyKey": "probe-1" }), Duration::from_secs(120))
            .await
            .map_err(anyhow::Error::msg)?;
        println!("== chat.send {sent}");
        if wait_for(&mut rx, 120, ended).await.is_none() {
            println!("!! no final event within 120s");
        }
        tokio::time::sleep(Duration::from_millis(800)).await;
        let history = client.call("chat.history", json!({ "sessionKey": key, "limit": 50 })).await.map_err(anyhow::Error::msg)?;
        println!("== chat.history {key}");
        for m in history["messages"].as_array().into_iter().flatten() {
            println!("  {}", short(m, 300));
        }
        let sessions = client.call("sessions.list", json!({ "limit": 50 })).await.map_err(anyhow::Error::msg)?;
        let row = sessions["sessions"].as_array().into_iter().flatten().find(|r| r["key"] == key.as_str());
        println!("== row for {key}: {}", row.map(|r| short(r, 400)).unwrap_or_else(|| "MISSING".into()));
        let patched = client.call("sessions.patch", json!({ "key": key, "label": "probe (renamed)", "pinned": true })).await;
        println!("== sessions.patch {patched:?}");
        let deleted = client.call("sessions.delete", json!({ "key": key })).await;
        println!("== sessions.delete {deleted:?}");
    }

    if wants("watch") {
        // Keep the connection up for PROBE_WAIT seconds (restart Hermes meanwhile to test reconnects).
        let secs: u64 = std::env::var("PROBE_WAIT").ok().and_then(|v| v.parse().ok()).unwrap_or(30);
        if let Ok(key) = std::env::var("PROBE_SUBSCRIBE") {
            let res = client.call("sessions.messages.subscribe", json!({ "key": key })).await;
            println!("== sessions.messages.subscribe {key} {res:?}");
        }
        wait_for(&mut rx, secs, |_, _| false).await;
        let s = client.status();
        println!("== after watch: {:?} url={:?} message={:?}", s.phase, s.url, s.message);
        match client.call("agents.list", json!({})).await {
            Ok(a) => println!("== agents.list ok ({} guys)", a["agents"].as_array().map_or(0, Vec::len)),
            Err(e) => println!("== agents.list ERR {e}"),
        }
    }

    if wants("reattach") {
        // Drop the socket mid-reply: the turn should be re-attached and still finish.
        let created = client.call("sessions.create", json!({ "agentId": guy })).await.map_err(anyhow::Error::msg)?;
        let key = created["key"].as_str().unwrap_or_default().to_string();
        let prompt = std::env::var("PROBE_SLOW").unwrap_or_else(|_| "LG_SLOW tell me a long story".into());
        let sent = client.call("chat.send", json!({ "sessionKey": key, "message": prompt, "idempotencyKey": "probe-4" })).await.map_err(anyhow::Error::msg)?;
        println!("== chat.send {sent}");
        tokio::time::sleep(Duration::from_millis(2500)).await;
        println!("== reconnect_now()");
        client.reconnect_now();
        match wait_for(&mut rx, 90, ended).await {
            Some((_, p)) => println!("== ended: state={} text={}", p["state"], short(&p["message"]["content"], 200)),
            None => println!("!! no end event within 90s"),
        }
        let history = client.call("chat.history", json!({ "sessionKey": key })).await.map_err(anyhow::Error::msg)?;
        println!("== history has {} messages; last: {}", history["messages"].as_array().map_or(0, Vec::len),
            short(history["messages"].as_array().and_then(|m| m.last()).unwrap_or(&Value::Null), 200));
        let _ = client.call("sessions.delete", json!({ "key": key })).await;
    }

    if wants("abort") {
        let created = client.call("sessions.create", json!({ "agentId": guy })).await.map_err(anyhow::Error::msg)?;
        let key = created["key"].as_str().unwrap_or_default().to_string();
        let prompt = std::env::var("PROBE_SLOW").unwrap_or_else(|_| "LG_SLOW tell me a long story".into());
        let sent = client.call("chat.send", json!({ "sessionKey": key, "message": prompt, "idempotencyKey": "probe-3" })).await.map_err(anyhow::Error::msg)?;
        println!("== chat.send (to abort) {sent}");
        wait_for(&mut rx, 60, |n, p| n == "chat" && p["state"] == "delta").await;
        tokio::time::sleep(Duration::from_millis(500)).await;
        let res = client.call("chat.abort", json!({ "sessionKey": key, "runId": sent["runId"] })).await;
        println!("== chat.abort {res:?}");
        if wait_for(&mut rx, 60, ended).await.is_none() {
            println!("!! no end event within 60s");
        }
        let deleted = client.call("sessions.delete", json!({ "key": key })).await;
        println!("== sessions.delete {deleted:?}");
    }

    if wants("approve") {
        let main_key = format!("agent:{guy}:main");
        let prompt = std::env::var("PROBE_APPROVE").unwrap_or_else(|_| "LG_APPROVE".into());
        let decision = std::env::var("PROBE_DECISION").unwrap_or_else(|_| "deny".into());
        let sent = client
            .call_with_timeout("chat.send", json!({ "sessionKey": main_key, "message": prompt, "idempotencyKey": "probe-2" }), Duration::from_secs(120))
            .await
            .map_err(anyhow::Error::msg)?;
        println!("== chat.send (main) {sent}");
        match wait_for(&mut rx, 120, |n, _| n == "exec.approval.requested").await {
            Some((_, approval)) => {
                let listed = client.call("exec.approval.list", json!({})).await.map_err(anyhow::Error::msg)?;
                println!("== exec.approval.list {}", short(&listed, 500));
                let id = approval["id"].as_str().unwrap_or_default();
                let res = client.call("exec.approval.resolve", json!({ "id": id, "decision": decision })).await;
                println!("== exec.approval.resolve {decision} -> {res:?}");
                if wait_for(&mut rx, 120, ended).await.is_none() {
                    println!("!! no final event within 120s");
                }
            }
            None => println!("!! no approval request within 120s"),
        }
        tokio::time::sleep(Duration::from_millis(800)).await;
        let history = client.call("chat.history", json!({ "sessionKey": main_key, "limit": 8 })).await.map_err(anyhow::Error::msg)?;
        println!("== chat.history {main_key} (last 8)");
        for m in history["messages"].as_array().into_iter().flatten() {
            println!("  {}", short(m, 300));
        }
    }

    if wants("cron") {
        let added = client
            .call("cron.add", json!({
                "name": "probe routine", "agentId": guy, "enabled": true,
                "schedule": { "kind": "every", "everyMs": 7_200_000 },
                "payload": { "kind": "agentTurn", "message": "reply with just: ok" },
                "sessionTarget": "isolated", "wakeMode": "now",
            }))
            .await
            .map_err(anyhow::Error::msg)?;
        println!("== cron.add {}", short(&added, 600));
        let id = added["id"].as_str().unwrap_or_default().to_string();
        let updated = client
            .call("cron.update", json!({ "id": id, "patch": { "name": "probe routine (edited)", "enabled": false, "schedule": { "kind": "cron", "expr": "0 9 * * 1-5" } } }))
            .await;
        println!("== cron.update {}", updated.as_ref().map(|v| short(v, 600)).unwrap_or_else(|e| e.to_string()));
        let list = client.call("cron.list", json!({ "agentId": guy, "includeDisabled": true })).await.map_err(anyhow::Error::msg)?;
        println!("== cron.list ({} jobs)", list["jobs"].as_array().map_or(0, Vec::len));
        for j in list["jobs"].as_array().into_iter().flatten() {
            println!("  {}", short(j, 300));
        }
        if std::env::var("PROBE_CRON_RUN").is_ok() {
            let run = client.call("cron.run", json!({ "id": id, "mode": "force" })).await;
            println!("== cron.run {run:?}");
            let finished = wait_for(&mut rx, 120, |n, p| n == "cron" && p["action"] == "finished").await;
            println!("== cron finished: {}", finished.map(|(_, p)| short(&p, 600)).unwrap_or_else(|| "none".into()));
            let runs = client.call("cron.runs", json!({ "jobId": id, "limit": 5 })).await;
            println!("== cron.runs {}", runs.as_ref().map(|v| short(v, 800)).unwrap_or_else(|e| e.to_string()));
        }
        let removed = client.call("cron.remove", json!({ "id": id })).await;
        println!("== cron.remove {removed:?}");
    }

    client.stop();
    tokio::time::sleep(Duration::from_millis(300)).await;
    Ok(())
}
