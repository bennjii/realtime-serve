import Head from 'next/head'
import { KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react'
import styles from '../styles/Home.module.css'
import config from '../config'
import { RTQueryHandler, Query, subscriptions } from '../query';
import { Message, QueryResponse } from '../@types';
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
        ws.init().then(e => {
            const query =
                new Query(ws).in(feed).subscribe("all", (payload: { message: string; nonce: string; type: string; }) => {
                    console.log("Received response, setting sub vector addition!");
                    setSubd(true);
                    fetchNew();

                    subscriptions.push({ ...payload, location: feed, call: (e: any) => {
                        console.log('Received message', e, 'n', messagesRef);
                        insertMessage(e);
                    } });
                });

            window.onclose = () => {
                subscriptions.map(e => new Query(ws).in(e.location).unsubscribe("all", () => {}))
            }
        })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const sendMessage = () => {
        input_ref.current.value = "";

        new Query(ws).in(feed).set(message)
            .then((e: QueryResponse) => {
                // setMessages([ ...messages, e.content])
            });
    }

    const insertMessage = (e: { content: any; }) => {
        console.log(messagesRef);
        setMessages([ ...messagesRef.current, { Chat: e.content }])
    }

    const fetchNew = (_feed?: string) => {
        new Query(ws).in(_feed ? _feed : feed).get("all")
            .then((e: QueryResponse) => {
                console.log("Fetch Received.");
                if(e.response.message == "406" || e.response.message == "200" ) {
                    console.log("Error in fetching, possibly null feed ", e);
                }else if (e.response.content){
                    setMessages(e.response.content as Message[]);
                }
            });
    }

    const unsubscribe = (_feed?: string) => {
        const sending_feed = _feed;

        new Query(ws).in(_feed ? sending_feed : feed).unsubscribe("all", (sub: QueryResponse) => {
            console.log("Unsubscribing...", sub);

            if(sub.response.message == "OK") {
                setSubd(false);

                subscriptions.map((s, i) => {
                    if(s.location !== _feed ? sending_feed : feed) subscriptions.splice(i, 1)
                });
            }else {
                console.log("Something went wrong sending request ", sub.ref, ".. ->", sub.response.message);
            }
        });
    }

    const subscribe = async (_feed?: string) => {
        new Query(ws).in(_feed ? _feed : feed).subscribe("all")
            .then((sub: QueryResponse) => {

                if(sub.response.message == "OK" || sub.response.message == "200") {
                    setSubd(true);
                    fetchNew(_feed ? _feed : feed);

                    console.log(sub);
                    const { message, nonce, type } = sub.response;

                    subscriptions.push({ message, nonce, type, location: _feed ? _feed : feed, call: (e: any) => {
                        console.log('Received message', e, 'n', messagesRef);
                        insertMessage(e);
                    } });
                }else {
                    console.log("Something went wrong sending request ", sub.ref, ".. ->", sub.response.message);
                }
                
            });
    }

    const setFeedType = async () => {
        setMessages([]);
        input_ref.current.value = "";
        setFeed(message);

        // Unsubscribe from old and sub to the new.
        unsubscribe(feed);
        subscribe(message);
    }

    return (
		<div>
            <div>
                {
                        messages.map(({Chat}: { Chat: Message }) => {
                        return (
                            <div key={`${Chat.created_at} ${Chat.content}`}>
                                { Chat.content }
                            </div>
                        )
                    })
                }
            </div>
			<input ref={input_ref} type="text" onChange={(e) => setMessage(e.currentTarget.value)} /> 
            <button onClick={sendMessage}>Send</button> 
            <button onClick={() => fetchNew()}>Query New</button>
            <button onClick={subd ? () => unsubscribe() : () => subscribe()}>{!subd ? "Subscribe" : "Unsubscribe"}, Currently {subd ? "Subscribed" : "Unsubscribed"}</button>
            <button onClick={setFeedType}>Set Feed</button>

            <div>
                Current Feed: { feed }
            </div>

            <div>
                ms: {ws?.latency}
            </div>
		</div>
    )
}