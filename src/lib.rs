use std::sync::{Arc};
use tokio::sync::{Mutex};
use serde::{Serialize, Serializer, ser::SerializeStruct};
use chrono::prelude::*;

pub type ChatLog = Arc<Mutex<ChatVector>>;

type ChatVector = Vec<ChatMessage>;

#[derive(Debug, Clone)]
pub struct ChatMessage {
    pub content: String,
    pub author: String,
    pub created_at: DateTime<Utc>,
    pub id: uuid::Uuid
}

impl Serialize for ChatMessage {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut state = serializer.serialize_struct("Message", 3)?;
        state.serialize_field("content", &self.content)?;
        state.serialize_field("author", &self.author)?;
        state.serialize_field("created_at", &self.created_at.to_string())?;
        state.end()
    }
}