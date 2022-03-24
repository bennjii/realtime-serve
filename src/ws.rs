use crate::{Client, Clients};
use futures::{FutureExt, StreamExt};
use tokio::sync::mpsc;
use tokio_stream::wrappers::UnboundedReceiverStream;
use uuid::Uuid;
use warp::ws::{Message, WebSocket};

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

    // Parse message as a JSON input parameter from stringified input.
    let json: crate::lib::SetReceive = match serde_json::from_str(&message) {
        Ok(v) => v,
        Err(e) => {
            let locked = clients.lock().await;

            match locked.get(client_id) {
                Some(v) => {
                    if let Some(sender) = &v.sender {
                        let _ = sender.send(Ok(Message::text(format!("{{ \"message\": \"{}\", \"type\": \"error\" }}", e))));
                    }

                    return;
                }
                None => return,
            }
        }
    };
    
    println!("{:?}", json.query);
    let mut logs = chat_log.lock().await;

    if json.query.qtype.starts_with("get") {
        // Only serves messages.
        let locked = clients.lock().await;

        let clone_logs = logs.clone();

        match locked.get(client_id) {
            Some(v) => {
                if let Some(sender) = &v.sender {
                    let _ = sender.send(Ok(Message::text(serde_json::to_string(&clone_logs).unwrap())));
                }
            }
            None => return,
        }
    }else if json.query.qtype.starts_with("set") {
        // Store Message in Logs
        logs.push(crate::lib::ChatMessage {
            content: json.query.message.to_string(),
            author: client_id.to_string(),
            created_at: chrono::Utc::now(),
            id: uuid::Uuid::new_v4()
        });
    }else {
        let locked = clients.lock().await;

        match locked.get(client_id) {
            Some(v) => {
                if let Some(sender) = &v.sender {
                    let _ = sender.send(Ok(Message::text(format!("{{ \"type\": \"reply\", \"message\": \"{}\" }}", client_id.to_string()))));
                }
            }
            None => return,
        }
        
        todo!("Write Implementation that allows for event hooking - such that a user can wait and listen for message events, and all other types + better query schema.");
        return;
    }
}

