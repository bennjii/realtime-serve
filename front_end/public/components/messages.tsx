import Head from 'next/head'
import { KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react'
import styles from '../styles/Home.module.css'
import config from '../config'
import { RTQueryHandler, Query, subscriptions } from '../query';
import { Message, QueryResponse } from '../@types';
import { useStateRef } from '../query/custom_state';
import useHangClient from '../query/hangwith';


export default function Messages() {

}