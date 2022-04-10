
export const isBrowser = typeof window !== "undefined";

import Head from 'next/head'
import { createContext, KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react'
import styles from '../styles/Home.module.css'
import config from '../public/config'
import { RTQueryHandler, Query, subscriptions } from '../public/query';
import { Message, QueryResponse } from '../public/@types';
import { useStateRef } from '../public/query/custom_state';
import {  HangClient, HangClientParent, useHangClient} from '../public/query/hangwith';
import Camera from '../public/components/camera';

export const HangClientContext = createContext<HangClient>(null);

export default function Home() {
    const [ message, setMessage ] = useState("");
    const [ messages, setMessages, messagesRef ] = useStateRef([]);
    const [ feed, setFeed ] = useState("1");
    const [ws] = useState(() => isBrowser ? new RTQueryHandler() : null);

    const { client, createRoom, joinRoom } = useHangClient(ws);

    const [ subd, setSubd ] = useState(false);
    const input_ref = useRef<HTMLInputElement>();

    useEffect(() => {
        ws.init().then(e => {
            new Query(ws).in(feed).subscribe("all", (payload: { message: string; nonce: string; type: string; }) => {
                console.log("Received response, setting sub vector addition!");
                setSubd(true);
                // If not yet created, will return 404 as chat is created and decomposed dynamically.
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
            });
    }

    const insertMessage = (e: { content: any; }) => {
        console.log(messagesRef);
        setMessages([ ...messagesRef.current, e.content])
    }

    const fetchNew = (_feed?: string) => {
        new Query(ws).in(_feed ? _feed : feed).get("all")
            .then((e: QueryResponse) => {
                console.log("Fetch Received.");

                console.log(e);
                if(e.response.message == "406" || e.response.message == "200" ) {
                    console.log("Error in fetching, possibly null feed ", e);
                }else if (e.response.content){
                    setMessages(e.response.content.Chat.messages as Message[]);
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

    console.log(message);

    return (
		<HangClientContext.Provider value={client}>
			<div>
				<div>
					{
						messages?.map((e: Message) => {
							return (
								<div key={`${e.created_at} ${e.content}`}>
									{ e.content }
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
				<button onClick={() => createRoom("155123na91")}>Create Room</button>
				<button onClick={() => joinRoom("155123na91")}>Join Room</button>

				<div>
					Current Feed: { feed }
				</div>

				<div>
					ms: {ws?.latency}
				</div>

				<Camera _stream={client.localStream} height={500} width={500} muted={true} depth={0} show_audio_bar={true} show_resolution={true} />
				<Camera _stream={client.remoteStream} height={500} width={500} muted={false} depth={0} show_audio_bar={true} show_resolution={true} />
			</div>
		</HangClientContext.Provider>
    )
}