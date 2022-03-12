use std::sync::{Arc};
use tokio::sync::{Mutex};
use serde::{Serialize, Serializer, ser::SerializeStruct};
use chrono::prelude::*;

pub type ChatLog = Arc<Mutex<Vec<ChatMessage>>>;

#[derive(Debug, Clone)]
pub struct ChatMessage {
    pub content: String,
    pub author: String,
    createdAt: DateTime<Utc>
}

impl Serialize for ChatMessage {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut state = serializer.serialize_struct("Message", 3)?;
        state.serialize_field("content", &self.content)?;
        state.serialize_field("author", &self.author)?;
        state.serialize_field("created_at", &self.createdAt)?;
        state.end()
    }
}