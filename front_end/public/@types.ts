type Request = {
    query: {
        qtype: "get" | "set" | "init" | "subscribe" | "unsubscribe", 
        message: string,
        location: string,
        limiter?: {
            ltype: "newest" | "oldest" | "all",
            amount: number
        },
    },
    bearer: {
        auth_token: string,
    },
    nonce?: string
}

export type Message = { 
    author: string,
    content: string,
    created_at: string
}

export type Subscription = { 
    message: string,
    nonce: string,
    type: string,
    location: string,
    call: Function
}

export default Request;