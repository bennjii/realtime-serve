import Head from 'next/head'
import { KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react'
import styles from '../styles/Home.module.css'
import config from '../config'
import { RTQueryHandler, Query, subscriptions } from '../query';
import { Message } from '../@types';
import { useStateRef } from '../query/custom_state';

export const isBrowser = typeof window !== "undefined";

export default function Messages() {
    const [ message, setMessage ] = useState("");
    const [ messages, setMessages, messagesRef ] = useStateRef([]);
    const [ feed, setFeed ] = useState("1");
    const [ws] = useState(() => isBrowser ? new RTQueryHandler() : null);

    const [ subd, setSubd ] = useState(false);
    const input_ref = useRef<HTMLInputElement>();

    useEffect(() => {
        ws.init(() => {
            ws.sendQuery(new Query().subscribe("all").in(feed))
                .then((sub: { message: string; nonce: string; type: string; }) => {
                    setSubd(true);
                    fetchNew();

                    subscriptions.push({ ...sub, location: feed, call: (e) => {
                        console.log('Recieved message', e, 'n', messagesRef);
                        insertMessage(e);
                    } });
                });
        });

        window.onclose = () => unsubscribe();
    }, []);

    const sendMessage = () => {
        input_ref.current.value = "";

        ws.sendQuery(new Query().set(message).in(feed))
            .then((e: { content: Message }) => {
                // setMessages([ ...messages, e.content])
            });
    }

    const insertMessage = (e) => {
        console.log(messagesRef);
        setMessages([ ...messagesRef.current, e.content])
    }

    const fetchNew = () => {
        ws.sendQuery(new Query().get("all").in(feed))
            .then((e: { content: Message[] | string} ) => {
                if(typeof e == "string" && e == "406" || typeof e == "string" && e == "200") {
                    console.log("Error in fetching, possibly null feed ", e);
                }else if (typeof e !== "string" && e.content){
                    setMessages(e.content as Message[]);
                }
            })
    }

    const unsubscribe = (_feed?: string) => {
        const sending_feed = _feed;
        ws.sendQuery(new Query().unsubscribe("all").in(_feed ? sending_feed : feed))
            .then((sub: { message: string; nonce: string; type: string; }) => {
                setSubd(false);

                subscriptions.map((s, i) => {
                    if(s.location !== _feed ? sending_feed : feed) subscriptions.splice(i, 1)
                });
            })
    }

    const subscribe = async (_feed?: string) => {
        ws.sendQuery(new Query().subscribe("all").in(_feed ? _feed : feed))
            .then((sub: { message: string; nonce: string; type: string; }) => {
                setSubd(true);
                fetchNew();

                subscriptions.push({ ...sub, location: _feed ? _feed : feed, call: (e) => {
                    console.log('Received message', e, 'n', messagesRef);
                    insertMessage(e);
                } });
            });
    }

    const setFeedType = async () => {
        console.time("a");
        setMessages([]);

        console.timeStamp("a");
        input_ref.current.value = "";

        console.timeStamp("a");
        setFeed(message);

        console.timeStamp("a");
        await unsubscribe(feed);

        console.timeStamp("a");
        subscribe(message);

        console.timeEnd("a");
    }

    return (
		<div>
            <div>
                {
                    messages.map((e: Message) => {
                        return (
                            <div key={`${e.created_at} ${e.content}`}>
                                { JSON.stringify(e) }
                            </div>
                        )
                    })
                }
            </div>
			<input ref={input_ref} type="text" onChange={(e) => setMessage(e.currentTarget.value)} /> 
            <button onClick={sendMessage}>Send</button> 
            <button onClick={fetchNew}>Query New</button>
            <button onClick={subd ? () => unsubscribe() : () => subscribe()}>{!subd ? "Subscribe" : "Unsubscribe"}, Currently {subd ? "Subscribed" : "Unsubscribed"}</button>
            <button onClick={setFeedType}>Set Feed</button>

            <div>
                {
                    subscriptions.map(e => {
                        <div>
                            {
                                e.nonce
                            } 
                        </div>
                    })
                }
            </div>

            <div>
                Current Feed: { feed }
            </div>

            <div>
                ms: {ws?.latency}
            </div>
		</div>
    )
}