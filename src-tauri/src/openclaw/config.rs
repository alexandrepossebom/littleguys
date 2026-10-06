//! Reads the user's OpenClaw config (`~/.openclaw/openclaw.json`, JSON5) and
//! resolves how to reach the gateway it describes. littleguys shares this
//! install with the openclaw CLI and OpenClaw.app; it never writes this file
//! directly (writes go through `config.patch` on the gateway).

use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::Value;

pub const DEFAULT_GATEWAY_PORT: u16 = 18789;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenclawPaths {
    pub state_dir: PathBuf,
    pub config_path: PathBuf,
}

impl OpenclawPaths {
    /// Mirrors OpenClaw's own resolution: `OPENCLAW_STATE_DIR` /
    /// `OPENCLAW_CONFIG_PATH` / `OPENCLAW_PROFILE`, defaulting to `~/.openclaw`.
    pub fn resolve() -> Self {
        let home = std::env::var("OPENCLAW_HOME")
            .map(PathBuf::from)
            .ok()
            .or_else(dirs::home_dir)
            .unwrap_or_else(|| PathBuf::from("/"));
        let state_dir = match std::env::var("OPENCLAW_STATE_DIR") {
            Ok(dir) if !dir.trim().is_empty() => expand_home(dir.trim(), &home),
            _ => match std::env::var("OPENCLAW_PROFILE") {
                Ok(profile) if !profile.trim().is_empty() => {
                    home.join(format!(".openclaw-{}", profile.trim()))
                }
                _ => home.join(".openclaw"),
            },
        };
        let config_path = match std::env::var("OPENCLAW_CONFIG_PATH") {
            Ok(path) if !path.trim().is_empty() => expand_home(path.trim(), &home),
            _ => state_dir.join("openclaw.json"),
        };
        Self { state_dir, config_path }
    }
}

fn expand_home(path: &str, home: &Path) -> PathBuf {
    if path == "~" {
        home.to_path_buf()
    } else if let Some(rest) = path.strip_prefix("~/") {
        home.join(rest)
    } else {
        PathBuf::from(path)
    }
}

pub fn load_config(paths: &OpenclawPaths) -> anyhow::Result<Option<Value>> {
    match std::fs::read_to_string(&paths.config_path) {
        Ok(raw) => {
            let value: Value = json5::from_str(&raw)
                .map_err(|e| anyhow::anyhow!("could not parse {}: {e}", paths.config_path.display()))?;
            Ok(Some(value))
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.into()),
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum GatewayMode {
    Local,
    Remote,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Credential {
    Token(String),
    Password(String),
    /// Short-lived bootstrap token from an OpenClaw setup code (single use).
    Bootstrap(String),
    None,
}

#[derive(Debug, Clone)]
pub struct Endpoint {
    pub mode: GatewayMode,
    pub url: String,
    /// Loopback port for local gateways (used for the HTTP health probe).
    pub port: Option<u16>,
    pub credential: Credential,
    /// Set when the config names a credential we could not read (e.g. a
    /// SecretRef backed by the gateway's secret store).
    pub credential_issue: Option<String>,
    /// Version of OpenClaw that last wrote the config (`meta.lastTouchedVersion`).
    pub config_version: Option<String>,
}

fn get<'a>(value: &'a Value, path: &[&str]) -> Option<&'a Value> {
    path.iter().try_fold(value, |acc, key| acc.get(*key))
}

fn get_str<'a>(value: &'a Value, path: &[&str]) -> Option<&'a str> {
    get(value, path).and_then(Value::as_str).map(str::trim).filter(|s| !s.is_empty())
}

/// Resolve a config secret: either a plain string or a SecretRef object.
/// Only env-backed refs can be resolved outside the gateway.
fn resolve_secret(value: Option<&Value>, state_dir: &Path) -> Result<Option<String>, String> {
    match value {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(s)) if s.trim().is_empty() => Ok(None),
        Some(Value::String(s)) => Ok(Some(s.trim().to_string())),
        Some(Value::Object(obj)) => {
            let source = obj.get("source").and_then(Value::as_str).unwrap_or_default();
            let id = obj
                .get("id")
                .or_else(|| obj.get("name"))
                .or_else(|| obj.get("key"))
                .and_then(Value::as_str)
                .unwrap_or_default();
            if source == "env" && !id.is_empty() {
                if let Ok(v) = std::env::var(id) {
                    return Ok(Some(v));
                }
                if let Some(v) = read_dotenv_value(&state_dir.join(".env"), id) {
                    return Ok(Some(v));
                }
                return Err(format!("environment variable {id} is not set"));
            }
            Err(format!("secret is stored in the gateway's {source} secret store"))
        }
        Some(_) => Err("unsupported secret format".into()),
    }
}

fn read_dotenv_value(path: &Path, key: &str) -> Option<String> {
    let raw = std::fs::read_to_string(path).ok()?;
    raw.lines().find_map(|line| {
        let line = line.trim().strip_prefix("export ").unwrap_or(line.trim());
        let (k, v) = line.split_once('=')?;
        (k.trim() == key).then(|| v.trim().trim_matches('"').trim_matches('\'').to_string())
    })
}

fn env_nonempty(key: &str) -> Option<String> {
    std::env::var(key).ok().map(|v| v.trim().to_string()).filter(|v| !v.is_empty())
}

pub fn resolve_endpoint(config: Option<&Value>, paths: &OpenclawPaths) -> Endpoint {
    let empty = Value::Null;
    let cfg = config.unwrap_or(&empty);
    let config_version = get_str(cfg, &["meta", "lastTouchedVersion"]).map(str::to_string);
    let mode = match get_str(cfg, &["gateway", "mode"]) {
        Some("remote") => GatewayMode::Remote,
        _ => GatewayMode::Local,
    };

    if mode == GatewayMode::Remote {
        let url = get_str(cfg, &["gateway", "remote", "url"]).unwrap_or_default().to_string();
        let (credential, credential_issue) = pick_credential(
            resolve_secret(get(cfg, &["gateway", "remote", "token"]), &paths.state_dir),
            resolve_secret(get(cfg, &["gateway", "remote", "password"]), &paths.state_dir),
        );
        return Endpoint { mode, url, port: None, credential, credential_issue, config_version };
    }

    let port = env_nonempty("OPENCLAW_GATEWAY_PORT")
        .and_then(|p| p.parse().ok())
        .or_else(|| get(cfg, &["gateway", "port"]).and_then(Value::as_u64).map(|p| p as u16))
        .unwrap_or(DEFAULT_GATEWAY_PORT);
    let tls = get(cfg, &["gateway", "tls", "enabled"]).and_then(Value::as_bool).unwrap_or(false);
    let scheme = if tls { "wss" } else { "ws" };
    let url = format!("{scheme}://127.0.0.1:{port}");

    let auth_mode = get_str(cfg, &["gateway", "auth", "mode"]).unwrap_or("token");
    let token = env_nonempty("OPENCLAW_GATEWAY_TOKEN")
        .map(|t| Ok(Some(t)))
        .unwrap_or_else(|| resolve_secret(get(cfg, &["gateway", "auth", "token"]), &paths.state_dir));
    let password = env_nonempty("OPENCLAW_GATEWAY_PASSWORD")
        .map(|t| Ok(Some(t)))
        .unwrap_or_else(|| resolve_secret(get(cfg, &["gateway", "auth", "password"]), &paths.state_dir));
    let (credential, credential_issue) = match auth_mode {
        "none" | "trusted-proxy" => (Credential::None, None),
        "password" => pick_credential(Ok(None), password),
        _ => pick_credential(token, password),
    };
    Endpoint { mode, url, port: Some(port), credential, credential_issue, config_version }
}

fn pick_credential(
    token: Result<Option<String>, String>,
    password: Result<Option<String>, String>,
) -> (Credential, Option<String>) {
    match (token, password) {
        (Ok(Some(t)), _) => (Credential::Token(t), None),
        (_, Ok(Some(p))) => (Credential::Password(p), None),
        (Err(issue), _) | (_, Err(issue)) => (Credential::None, Some(issue)),
        _ => (Credential::None, None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn paths() -> OpenclawPaths {
        OpenclawPaths { state_dir: PathBuf::from("/nonexistent"), config_path: PathBuf::from("/nonexistent/openclaw.json") }
    }

    #[test]
    fn remote_mode_uses_remote_url_and_token() {
        let cfg = json!({"gateway": {"mode": "remote", "remote": {"url": "wss://attic.example.ts.net", "token": "abc"}}});
        let ep = resolve_endpoint(Some(&cfg), &paths());
        assert_eq!(ep.mode, GatewayMode::Remote);
        assert_eq!(ep.url, "wss://attic.example.ts.net");
        assert_eq!(ep.credential, Credential::Token("abc".into()));
    }

    #[test]
    fn local_mode_defaults_to_loopback_port() {
        let cfg = json!({"gateway": {"mode": "local", "auth": {"mode": "token", "token": "t"}}});
        let ep = resolve_endpoint(Some(&cfg), &paths());
        assert_eq!(ep.url, format!("ws://127.0.0.1:{DEFAULT_GATEWAY_PORT}"));
        assert_eq!(ep.credential, Credential::Token("t".into()));
    }

    #[test]
    fn missing_config_is_local_default() {
        let ep = resolve_endpoint(None, &paths());
        assert_eq!(ep.mode, GatewayMode::Local);
        assert_eq!(ep.port, Some(DEFAULT_GATEWAY_PORT));
        assert_eq!(ep.credential, Credential::None);
    }

    #[test]
    fn store_secret_ref_is_reported_not_resolved() {
        let cfg = json!({"gateway": {"mode": "remote", "remote": {"url": "wss://x", "token": {"source": "store", "provider": "default", "id": "gw"}}}});
        let ep = resolve_endpoint(Some(&cfg), &paths());
        assert_eq!(ep.credential, Credential::None);
        assert!(ep.credential_issue.is_some());
    }

    #[test]
    fn parses_json5() {
        let raw = "{ // comment\n gateway: { mode: 'remote', remote: { url: 'wss://y', }, }, }";
        let v: Value = json5::from_str(raw).unwrap();
        assert_eq!(get_str(&v, &["gateway", "remote", "url"]), Some("wss://y"));
    }
}
