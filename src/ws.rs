use crate::{Client, Clients};
use futures::{FutureExt, StreamExt};
use tokio::sync::mpsc;
use tokio_stream::wrappers::UnboundedReceiverStream;
use uuid::Uuid;
use warp::ws::{Message, WebSocket};
use std::sync::Arc;

pub async fn client_connection(ws: WebSocket, clients: Clients, chat_log: crate::lib::ChatLog) {
    println!("establishing client connection... {:?}", ws);

    let (client_ws_sender, mut client_ws_rcv) = ws.split();
    let (client_sender, client_rcv) = mpsc::unbounded_channel();

    let client_rcv = UnboundedReceiverStream::new(client_rcv);

    tokio::task::spawn(client_rcv.forward(client_ws_sender).map(|result| {
        if let Err(e) = result {
            println!("[ERROR] In: Sending WebSocket Message '{}'", e);
        }
    }));

    let uuid = Uuid::new_v4().to_simple().to_string();

    let new_client = Client {
        client_id: uuid.clone(),
        sender: Some(client_sender),
    };

    clients.lock().await.insert(uuid.clone(), new_client);

    while let Some(result) = client_ws_rcv.next().await {
        let msg = match result {
            Ok(msg) => msg,
            Err(e) => {
                println!("[ERROR] Receiving message for id {}: {}", uuid.clone(), e);
                break;
            }
        };

        client_msg(&uuid, msg, &clients, &chat_log).await;
    }

    clients.lock().await.remove(&uuid);
    println!("{} disconnected", uuid);
}

async fn client_msg(client_id: &str, msg: Message, clients: &Clients, chat_log: &crate::lib::ChatLog) {
    println!("[INCOMING] Received message from {}: {:?}", client_id, msg);

    let message = match msg.to_str() {
        Ok(v) => v,
        Err(_) => return,
    };

    println!("{:?}", chat_log);

    // let logs = Arc::downgrade(&chat_log);
    let mut logs = chat_log.lock().await;

    logs.push(crate::lib::ChatMessage {
        content: msg.to_str().unwrap().to_string(),
        author: client_id.to_string(),
        createdAt: chrono::Utc::now()
    });

    if message == "ping" || message == "ping\n" {
        let locked = clients.lock().await;

        match locked.get(client_id) {
            Some(v) => {
                if let Some(sender) = &v.sender {
                    let _ = sender.send(Ok(Message::text("pong")));
                }
            }
            None => return,
        }
        
        return;
    }else if message == "query.all" {
        let mut writer = BufWriter::new();
        
        serde_json::to_writer(&mut writer, &logs.to_vec())?;
        writer.flush()?;

        let locked = clients.lock().await;

        match locked.get(client_id) {
            Some(v) => {
                if let Some(sender) = &v.sender {
                    let _ = sender.send(Ok(Message::text(serde_json::from(logs))));
                }
            }
            None => return,
        }
    }
}