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
    const [ws] = useState(() => isBrowser ? new RTQueryHandler() : null);

    const [ subd, setSubd ] = useState(false);

    useEffect(() => {
        ws.init(() => {
            ws.sendQuery(new Query().subscribe("all").in("1"))
                .then((sub: { message: string; nonce: string; type: string; }) => {
                    setSubd(true);

                    subscriptions.push({ ...sub, location: "1", call: (e) => {
                        console.log('Recieved message', e, 'n', messagesRef);
                        insertMessage(e);
                    } });
                });
        });

        window.onclose = unsubscribe;
    }, []);

    const sendMessage = () => {
        ws.sendQuery(new Query().set(message).in("1"))
            .then((e: { content: Message }) => {
                // setMessages([ ...messages, e.content])
            });
    }

    const insertMessage = (e) => {
        console.log(messagesRef);
        setMessages([ ...messagesRef.current, e.content])
    }

    const fetchNew = () => {
        ws.sendQuery(new Query().get("all").in("1"))
            .then((e: { content: Message[]} ) => {
                setMessages(e.content);
            })
    }

    const unsubscribe = () => {
        ws.sendQuery(new Query().unsubscribe("all").in("1"))
            .then((e: any) => {
                setSubd(false);
            })
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
			<input type="text" onChange={(e) => setMessage(e.currentTarget.value)} /> 
            <button onClick={sendMessage}>Send</button> 
            <button onClick={fetchNew}>Query New</button>
            <button onClick={unsubscribe}>Unsubscribe, Currently {subd ? "Subscribed" : "Unsubscribed"}</button>

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
		</div>
    )
}