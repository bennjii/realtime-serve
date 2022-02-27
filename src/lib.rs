pub type ChatLog = Vec<ChatMessage>;

#[derive(Debug, Clone)]
pub struct ChatMessage {
    content: String,
    author: String
}