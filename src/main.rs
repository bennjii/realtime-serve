use std::{collections::HashMap, convert::Infallible, sync::Arc};
use realtime_serve::Subscriptions;
use tokio::sync::{mpsc, Mutex};
use warp::{ws::Message, Filter, Rejection};
mod handlers;
mod ws;
mod lib;

#[derive(Debug, Clone)]
pub struct Client {
    pub client_id: String,
    pub sender: Option<mpsc::UnboundedSender<std::result::Result<Message, warp::Error>>>,
}

type Clients = Arc<Mutex<HashMap<String, Client>>>;
type Result<T> = std::result::Result<T, Rejection>;

#[tokio::main]
async fn main() {
    let clients: Clients = Arc::new(Mutex::new(HashMap::new()));
    let chat_log = Arc::new(Mutex::new(vec!()));
    let subscriptions: lib::Subscribe = Arc::new(Mutex::new(HashMap::new()));

    println!("[SERVICE] ws_handler::start");

    let ws_route = warp::path::end()
        .and(warp::ws())
        .and(with_clients(clients.clone()))
        .and(with_chat(chat_log))
        .and(with_subscriptions(subscriptions))
        .and_then(handlers::ws_handler);

    let routes = ws_route.with(warp::cors().allow_any_origin());
    warp::serve(routes).run(([127, 0, 0, 1], 8000)).await;
}

fn with_clients(clients: Clients) -> impl Filter<Extract = (Clients,), Error = Infallible> + Clone {
    warp::any().map(move || clients.clone())
}

fn with_chat(chat_log: lib::ChatLog) -> impl Filter<Extract = (lib::ChatLog,), Error = Infallible> + Clone {
    warp::any().map(move || chat_log.clone())
}

fn with_subscriptions(subscriptions: lib::Subscribe) -> impl Filter<Extract = (Subscriptions,), Error = Infallible> + Clone {
    warp::any().map(move || subscriptions.clone())
}
