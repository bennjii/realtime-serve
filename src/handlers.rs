use crate::{ws, Clients, Result};
use warp::Reply;

pub async fn ws_handler(ws: warp::ws::Ws, clients: Clients, chat_log: crate::lib::ChatLog, subscriptions: crate::lib::Subscribe) -> Result<impl Reply> {
    Ok(ws.on_upgrade(move |socket| ws::client_connection(socket, clients, chat_log)))
}