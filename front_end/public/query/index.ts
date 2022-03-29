import Request, { Subscription } from '../@types';
import config from '../config'
import { randomBytes } from "crypto";

const nonces = new Set();
function getNonce(): string {
	let nonce = '';
	while (nonce === '' || nonces.has(nonce)) {
		nonce = randomBytes(4).toString('hex');
	}
	nonces.add(nonce);
	return nonce;
}

const subscriptions: Subscription[] = new Array();

class RTQueryHandler {
    ws: WebSocket;
    // subscriptions: Subscription[] = [];

    constructor() {
        this.ws = new WebSocket(config.webSocketUrl);
    }

    public init(onstart?: Function) {
        console.log(subscriptions);

        this.ws.onmessage = this.handleMessage;

        this.ws.onopen = () => {
            this.sendQuery(new Query().init()).then(e => {
                console.log("RECIEVED INIT");
            });

            if(onstart) onstart();
        }

        this.ws.onclose = () => {
            // Restart Lost Connection
            this.ws = new WebSocket(config.webSocketUrl);
        }
    }

    private handleMessage(ev: MessageEvent<any>) {
        const data_ = JSON.parse(ev.data);
        console.log("Incoming", data_);

        console.log(subscriptions);
        if(data_.type == "update" && subscriptions) subscriptions.find((e) => e.location = data_.location).call(data_)
    }

    private wrapQuery(query: Request) {
        console.log("Outgoing", query);
        this.ws.send(JSON.stringify(query));
    }

    public sendQuery(query: Query) {
        return new Promise(r => {
            const nonce = getNonce();

            this.wrapQuery({ 
                ...query.request,
                nonce
            });

            const listener = (_res: MessageEvent<any>) => {
                try {
                    let res = JSON.parse(_res.data);
                    if(res?.nonce == nonce) {
                        r(res);
                    }
                } catch(e) {}
            }

            this.ws.addEventListener("message", listener);
        });
    }
}

class Query {
    request: Request
    constructor() { 
        this.request = {
            query: {
                qtype: "get", 
                message: "",
                location: "",
                limiter: {
                    ltype: "newest",
                    amount: 15
                },
            },  
            bearer: {
                auth_token: "",
            }
        };
    }
    
    type(type: Request["query"]["qtype"]) {
        this.request.query.qtype = type;
        return this;
    }

    in(guild_id: string) {
        this.request.query.location = guild_id;
        return this;
    }
    
    init() {
        this.request.query.qtype = "init";
        return this;
    }

    get(message: string) {
        this.request.query.qtype = "get";
        this.request.query.message = message;
        return this;
    }

    set(message: string) {
        this.request.query.qtype = "set";
        this.request.query.message = message;
        return this;
    }

    subscribe(message?: string) {
        this.request.query.qtype = "subscribe";
        this.request.query.message = message ? message : "";
        return this;
    }
}

export { RTQueryHandler, Query, subscriptions };