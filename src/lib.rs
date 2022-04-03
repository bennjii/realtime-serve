use std::{sync::Arc, collections::HashMap};
use tokio::sync::{Mutex};
use serde::{Deserialize, Serialize, Serializer, ser::SerializeStruct, Deserializer, de};
use chrono::prelude::*;
use std::str::FromStr;
use std::fmt::Display;

pub type ChatLog = Arc<Mutex<HashMap<String, TypeVec>>>;

#[derive(Clone, Serialize, Debug, Deserialize)]
pub enum TypeVec {
    Chat(Chat),
    Room(RoomAllocation)
}

#[derive(Debug, Clone, Deserialize)]
pub struct RoomAllocation {
    // Below are all JSON formatted strings stored as STRING types.
    pub callee_candidates: String,
    pub caller_candidates: String,
    pub offer: String,
    pub id: uuid::Uuid,
    pub pt: String,
}

pub type ChatVector = Vec<ChatMessage>;

#[derive(Clone, Debug, Deserialize)]
pub struct Chat {
    pub messages: ChatVector,
    pub name: String,
    pub pt: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ChatMessage {
    pub content: String,
    pub author: String,
    pub session_author: String,
    #[serde(deserialize_with = "deserialize_from_str")]
    pub created_at: DateTime<Utc>,
    pub id: uuid::Uuid
}

fn deserialize_from_str<'de, S, D>(deserializer: D) -> Result<S, D::Error>
where
    S: FromStr,      // Required for S::from_str...
    S::Err: Display, // Required for .map_err(de::Error::custom)
    D: Deserializer<'de>,
{
    let s: String = Deserialize::deserialize(deserializer)?;
    S::from_str(&s).map_err(de::Error::custom)
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

impl Serialize for Chat {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut state = serializer.serialize_struct("Message", 3)?;
        state.serialize_field("messages", &self.messages)?;
        state.serialize_field("name", &self.name)?;
        state.end()
    }
}

impl Serialize for RoomAllocation {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut state = serializer.serialize_struct("Message", 3)?;
        state.serialize_field("callee_candidates", &self.callee_candidates)?;
        state.serialize_field("caller_candidates", &self.caller_candidates)?;
        state.serialize_field("offer", &self.offer.to_string())?;
        state.end()
    }
}

pub type Subscribe = Arc<Mutex<HashMap<String, Vec<String>>>>;

#[derive(Debug, Deserialize)]
pub struct SetReceive {
    pub query: Query,
    pub bearer: Auth,
    pub nonce: String
}

#[derive(Debug, Deserialize)]
pub struct Auth {
    pub auth_token: String,
    pub auth_id: String
}

#[derive(Debug, Deserialize)]
pub struct Limiter {
    pub ltype: String,
    pub amount: u16
}

#[derive(Debug, Deserialize)]
pub struct Query  {
    pub qtype: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub location: String,
    pub limiter: Limiter,
    pub message: String
}