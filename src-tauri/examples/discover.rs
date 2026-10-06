//! `cargo run --example discover` — list OpenClaw gateways on the tailnet/LAN.
#[tokio::main]
async fn main() {
    let _ = rustls::crypto::ring::default_provider().install_default();
    let started = std::time::Instant::now();
    for g in littleguys_lib::gateways::discover().await {
        println!("{:<12} {:<45} via {}", g.name, g.url, g.via);
    }
    println!("({} ms)", started.elapsed().as_millis());
}
