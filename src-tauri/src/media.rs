//! Files a guy points at by path on its own machine (`MEDIA:/…` in a reply).
//!
//! OpenClaw serves them from `/__openclaw__/assistant-media`: an authorized
//! `meta=1` request says whether the file can be shown and mints a short-lived
//! media ticket; the ticketed URL then works without credentials, so the
//! webview can put it straight into an `<img>` or `<video>`.

use std::sync::Arc;
use std::time::Duration;

use serde_json::{json, Value};
use tauri::State;

use crate::gateway::client::RpcError;
use crate::hub::Hub;

const ROUTE: &str = "/__openclaw__/assistant-media";

/// `{available, url?, mimeType?, sizeBytes?, expiresAt?, code?, reason?}`
#[tauri::command]
pub async fn gw_media(
    hub: State<'_, Arc<Hub>>,
    gateway: String,
    source: String,
    session_key: Option<String>,
    agent_id: Option<String>,
) -> Result<Value, RpcError> {
    let runtime = hub.client(&gateway).ok_or_else(|| RpcError::new("UNKNOWN_GATEWAY", format!("no gateway {gateway}")))?;
    let client = runtime
        .as_openclaw()
        .ok_or_else(|| RpcError::new("UNSUPPORTED", "only OpenClaw serves files by path"))?;
    let origin = client.http_origin().ok_or_else(|| RpcError::new("NOT_CONNECTED", "not connected to the gateway"))?;

    let mut query: Vec<(&str, String)> = vec![("source", source)];
    if let Some(key) = session_key.filter(|k| !k.is_empty()) {
        query.push(("sessionKey", key));
        if let Some(agent) = agent_id.filter(|a| !a.is_empty()) {
            query.push(("agentId", agent));
        }
    }

    let mut meta = reqwest::Client::new()
        .get(format!("{origin}{ROUTE}"))
        .query(&query)
        .query(&[("meta", "1")])
        .timeout(Duration::from_secs(15));
    if let Some(token) = client.http_bearer() {
        meta = meta.bearer_auth(token);
    }
    let res = meta.send().await.map_err(|e| RpcError::new("UNAVAILABLE", e.to_string()))?;
    if !res.status().is_success() {
        return Ok(json!({ "available": false, "code": "http", "reason": format!("the gateway answered {}", res.status()) }));
    }
    let info: Value = res.json().await.map_err(|e| RpcError::new("BAD_RESPONSE", e.to_string()))?;
    let Some(ticket) = info["mediaTicket"].as_str().filter(|_| info["available"].as_bool() == Some(true)) else {
        return Ok(json!({ "available": false, "code": info["code"], "reason": info["reason"] }));
    };

    query.push(("mediaTicket", ticket.to_string()));
    // Formats the webview can't play get transcoded by the gateway on request.
    if info["playback"].as_str().is_some_and(|p| p != "native") {
        query.push(("playback", "1".to_string()));
    }
    let url = reqwest::Url::parse_with_params(&format!("{origin}{ROUTE}"), &query).map_err(|e| RpcError::new("BAD_RESPONSE", e.to_string()))?;
    Ok(json!({
        "available": true,
        "url": url.as_str(),
        "mimeType": info["mimeType"],
        "sizeBytes": info["sizeBytes"],
        "expiresAt": info["mediaTicketExpiresAt"],
    }))
}
