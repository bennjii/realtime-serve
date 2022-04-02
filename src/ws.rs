use crate::{Client, Clients, lib::Subscribe, lib::ChatLog, lib::SetReceive, lib::ChatMessage};
use futures::{FutureExt, StreamExt};
use tokio::sync::mpsc;
use tokio_stream::wrappers::UnboundedReceiverStream;
use uuid::Uuid;
use warp::ws::{Message, WebSocket};

pub async fn client_connection(ws: WebSocket, clients: Clients, chat_log: ChatLog, subscriptions: Subscribe) {
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

        client_msg(&uuid, msg, &clients, &chat_log, &subscriptions).await;
    }

    clients.lock().await.remove(&uuid);
    println!("{} disconnected", uuid);

    let mut subscriptions_locked = subscriptions.lock().await;
    let new_subscriptions = subscriptions_locked.clone();

    for (key, value) in &new_subscriptions {
        let mut new_v = value.clone();

        let index = new_v.iter().position(|x| *x == uuid.clone());
        
        match index {
            Some(t) => {
                println!("Trying Key {}", t);
                new_v.remove(t);
                subscriptions_locked.insert(key.to_string(), new_v);
                println!("Merged Existing Subscription");
            },
            None => {
                println!("Tried Key {}", key);
            },
        };
    }
        
    println!("[evt]: Client Removed Successfully");
}

async fn client_msg(client_id: &str, msg: Message, clients: &Clients, chat_log: &ChatLog, subscriptions: &Subscribe) {
    let message = match msg.to_str() {
        Ok(v) => v,
        Err(_) => return,
    };

    // Parse message as a JSON input parameter from stringified input.
    let json: SetReceive = match serde_json::from_str(&message) {
        Ok(v) => v,
        Err(e) => {
            return return_to_sender(clients, client_id, format!("{{ \"message\": \"{}\", \"type\": \"error\" }}", e)).await;
        }
    };
    
    println!("Received Query: {:?}", json.query.qtype);
    let mut logs = chat_log.lock().await;

    /*
     *   Diff between:
     *   - get
     *   - set
     *   - init
     *   - subscribe & unsubscribe
    */
    if json.query.qtype == "get" {
        // Only serves messages.
        let clone_logs = logs.clone();
        return_to_sender(clients, client_id, format!("{{ \"type\": \"{}\", \"content\": {}, \"location\": \"{}\", \"nonce\": \"{}\" }}", "reply", serde_json::to_string(&clone_logs).unwrap(), json.query.location, json.nonce)).await;
    }else if json.query.qtype == "set" {
        // SETTER FUNCTION - PUBLISHING DATA TO SERVER.
        // Store Message in Logs

        logs.push(ChatMessage {
            content: json.query.message.to_string(),
            author: client_id.to_string(),
            created_at: chrono::Utc::now(),
            id: uuid::Uuid::new_v4()
        });

        let subscriptions_locked = subscriptions.lock().await;

        match subscriptions_locked.get(&json.query.location) {
            Some(variance) => {
                println!("Updating all NEEDED users for change to {}: {:?}", json.query.location, variance);

                for client in variance {
                    return_to_sender(clients, client, format!("{{ \"type\": \"{}\", \"content\": {}, \"location\": \"{}\", \"nonce\": \"{}\" }}", 
                        "update", 
                        serde_json::to_string(&ChatMessage {
                            content: json.query.message.to_string(),
                            author: client_id.to_string(),
                            created_at: chrono::Utc::now(),
                            id: uuid::Uuid::new_v4()
                        }).unwrap(),
                        json.query.location,
                        json.nonce
                    )).await;
                }
            }
            None => return,
        }
    }else if json.query.qtype == "init" {
        return_to_sender(clients, client_id, format!("{{ \"type\": \"reply\", \"message\": \"{}\", \"nonce\": \"{}\" }}", client_id.to_string(), json.nonce)).await;
    }else if json.query.qtype == "subscribe" {
        println!("[evt]: Subscription Event");
        let mut subscriptions_locked = subscriptions.lock().await;

        if json.query.message == "all" {
            match subscriptions_locked.get(&json.query.location) {
                Some(v) => {
                    let mut new_v = v.clone();
                    new_v.push(client_id.to_string());

                    println!("Merged Existing Subscription: {:?}", new_v);

                    subscriptions_locked.insert(json.query.location, new_v);

                    return_to_sender(clients, client_id, format!("{{ \"type\": \"reply\", \"message\": \"200\", \"nonce\": \"{}\" }}", json.nonce)).await;
                },
                None => {
                    println!("Created New Subscription: {:?}", vec![client_id.to_string()]);

                    subscriptions_locked.insert(json.query.location,vec![client_id.to_string()]);
                    return_to_sender(clients, client_id, format!("{{ \"type\": \"reply\", \"message\": \"200\", \"nonce\": \"{}\" }}", json.nonce)).await;
                }
            }
        }
    }else if json.query.qtype == "unsubscribe" {
        println!("[evt]: Subscription Event Removed");
        let mut subscriptions_locked = subscriptions.lock().await;

        if json.query.message == "all" {
            match subscriptions_locked.get(&json.query.location) {
                Some(v) => {
                    let mut new_v = v.clone();

                    let index = new_v.iter().position(|x| *x == client_id).unwrap();
                    new_v.remove(index);

                    println!("Merged Existing Subscription: {:?}", new_v);

                    subscriptions_locked.insert(json.query.location, new_v);

                    return_to_sender(clients, client_id, format!("{{ \"type\": \"reply\", \"message\": \"200\", \"nonce\": \"{}\" }}", json.nonce)).await;
                },
                None => {
                    println!("Subscription Didn't Exist Falling Back");
                    return_to_sender(clients, client_id, format!("{{ \"type\": \"reply\", \"message\": \"406\", \"nonce\": \"{}\" }}", json.nonce)).await;
                }
            }
        }
    }
}

async fn return_to_sender(clients: &Clients, client_id: &str, message: String) {
    let locked = clients.lock().await;

    match locked.get(client_id) {
        Some(v) => {
            if let Some(sender) = &v.sender {
                let _ = sender.send(Ok(Message::text(message)));
            }
        }
        None => return,
    }
}