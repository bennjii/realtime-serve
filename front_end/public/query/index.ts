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
const request_cache: Query[] = new Array();
class RTQueryHandler {
    ws: WebSocket;
    latency: number;

    constructor() { 
        this.latency = 0;
    };

    public init(onstart?: Function) {
        this.ws = new WebSocket(config.webSocketUrl);

        this.ws.onmessage = this.handleMessage;

        this.ws.onopen = () => {
            this.sendQuery(new Query().init());

            if(onstart) onstart();
        }

        this.ws.onclose = () => {
            // Restart Lost Connection
            this.init();

            subscriptions.map(e => {
                this.sendQuery(new Query().subscribe(e.message).in(e.location));
            })
        }
    }

    private handleMessage(ev: MessageEvent<any>) {
        const data_ = JSON.parse(ev.data);
        console.log("Incoming", data_);

        if(data_.type == "update" && subscriptions) subscriptions.find((e) => e.location = data_.location).call(data_)
    }

    private wrapQuery(query: Request) {
        console.log("Outgoing", query);

        if(this.ws.readyState !== this.ws.OPEN) return false;
        else {
            this.ws.send(JSON.stringify(query));
            return true;
        }
    }

    public sendQuery(query: Query) {
        const d = new Date();

        return new Promise(r => {
            const nonce = getNonce();

            const send = this.wrapQuery({ 
                ...query.request,
                nonce
            });

            if(send) {
                const listener = (_res: MessageEvent<any>) => {
                    try {
                        let res = JSON.parse(_res.data);
                        if(res?.nonce == nonce) {
                            const dt = new Date();
                            this.latency = dt.getTime() - d.getTime(); 

                            r(res);
                        }
                    } catch(e) {}
                }
    
                this.ws.addEventListener("message", listener);
            }else {
                console.log("Request - Failed. Trying again when connection is restored.");
                request_cache.push(query);
                // setTimeout(() => {
                //     this.sendQuery(query)
                // }, 50);
            }
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

    unsubscribe(message?: string) {
        this.request.query.qtype = "unsubscribe";
        this.request.query.message = message ? message : "";
        return this;
    }
}

export { RTQueryHandler, Query, subscriptions };