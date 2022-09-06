// #[path = "../src/main.rs"]
// mod main;
mod common;
use websockets::WebSocket;

// `tokio::test` is the testing equivalent of `tokio::main`.
// It also spares you from having to specify the `#[test]` attribute.
//
// You can inspect what code gets generated using
// `cargo expand --test health_check` (<- name of the test file)
#[tokio::test]
async fn check_connection() {
    common::spawn_app().await.expect("Failed to spawn our app.");

    let ws = WebSocket::connect("wss://localhost:8000/").await;
    let mut res = ws.unwrap();

    println!("{:?}", res.handshake_response_headers());

    res.close(None).await.unwrap();
}