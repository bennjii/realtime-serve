use crate::{ws, Clients, Result};
use warp::Reply;
use std::sync::Arc;

pub async fn ws_handler(ws: warp::ws::Ws, clients: Clients, chat_log: crate::lib::ChatLog) -> Result<impl Reply> {
    Ok(ws.on_upgrade(move |socket| ws::client_connection(socket, clients, chat_log)))
}