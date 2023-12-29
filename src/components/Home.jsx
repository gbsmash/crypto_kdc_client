import React, { useReducer } from 'react'
import { useState, useEffect } from 'react'
import TextField from '@mui/material/TextField';
import axios from 'axios';
import JSEncrypt from 'jsencrypt';
import CryptoJS from 'crypto-js';
import io from "socket.io-client";
import {userContext} from './UserContext';
import { useContext, useRef } from 'react';



function Home() {

    const {data, setData} = useContext(userContext);
    const [step, setStep] = useState(0)
    const decryptedSessionKeyRef = useRef("null");
    const receiverIDRef = useRef(0)
    const [socket, setSocket] = useState(null);
    const [encryptedMsg, setEncryptedMsg] = useState("")
    const [decryptedMsg, setDecryptedMsg] = useState("")


    const decryptSessionKey = (data) => {

        const decryptor = new JSEncrypt();
        decryptor.setPrivateKey(data['privateKey']);
        const encryptedSessionKey = atob(data['encrypted_session_key']);
    
        try {
            const decryptedKey = decryptor.decrypt(encryptedSessionKey);
            return decryptedKey;
        } catch (error) {
            console.error('Decryption failed:', error);
        }  
        return decryptedKey;    
    }



    useEffect(() => {

        if(data['user_id'] !== "") {

            const socket = io('http://localhost:8000', { query: { user_id: data["user_id"] } });

            socket.on("connect", () => {
                console.log("connected");
            });

            socket.on("sessionKey", (eventData) => {
                console.log("receving session key")
                setData(prevData => {
                    decryptedSessionKeyRef.current = eventData['encrypted_session_key'];
                    receiverIDRef.current = eventData['receiver_id']
                    setStep(2);
                    return {
                        ...prevData,
                        "sender_id": prevData["user_id"],
                        "receiver_id": eventData["sender_id"] == prevData["user_id"] ? eventData["receiver_id"] : eventData["sender_id"],
                        "encrypted_session_key": eventData['encrypted_session_key'],
                        "decrypted_session_key": eventData['encrypted_session_key']
                    };
                });
            });
    
            socket.on("messageFromServerToUser", (eventData) => {
                console.log("else")
                console.log(eventData)
                const dataObject = JSON.parse(eventData);
                setEncryptedMsg(dataObject["msg_content"])
                console.log(dataObject, dataObject["msg_content"], data)
                const key = CryptoJS.enc.Hex.parse(decryptedSessionKeyRef.current);
                const bytes = CryptoJS.AES.decrypt(dataObject["msg_content"], key, { mode: CryptoJS.mode.ECB });
                const plaintext = bytes.toString(CryptoJS.enc.Utf8);
                setDecryptedMsg(plaintext)
                console.log(plaintext)
            });

            setSocket(socket)
        }
    }, [data["user_id"]]);


  return (
    <div className='home-page'>
        <div className="inside-wrapper">
        {
           step === 0 ? <Register step={step} setStep={setStep} data={data} setData={setData}/> : step === 1 ? <Session step={step} setStep={setStep} data={data} setData={setData}/> : <Chat data={data} socket={socket}/> 
        }
        {
            step === 0 ? <></> :  <div className="sessions-data">
            <h3>User ID</h3>
            <p>{data["user_id"]}</p>
            <h3>Receiver ID</h3>
            <p>{data["receiver_id"]}</p>
            <h3>Session Key</h3>
            <p>{data['encrypted_session_key']}</p>
        </div>
        }
        </div>
        {  step === 2 ?
            <div className="messages-wrapper">
                <h2>Messages</h2>
                <div className="message">
                    <h3>From User : </h3><p>{data["receiver_id"]}</p>
                    <h3>Encrypted message :</h3> <p>{encryptedMsg}</p>
                    <h3>Decrypted message : </h3><p>{decryptedMsg}</p>
                </div>
            </div> : <></>
        }
    </div>
  )
}


const Chat = ({data, socket}) => {
    
        const [message, setMessage] = useState("")
        const [visible, setVisible] = useState(false)
    
        const sendMessage = (message) => {
            const messageToSend = {}
            
            const key = CryptoJS.enc.Hex.parse(data["encrypted_session_key"]);
            const ciphertext = CryptoJS.AES.encrypt(message, key, { mode: CryptoJS.mode.ECB }).toString();
            console.log("from send message", data)
            messageToSend["msg_content"] = ciphertext;
            messageToSend["sender_id"] = data["user_id"];
            messageToSend["receiver_id"] = data["receiver_id"];
            console.log("sentmessage",messageToSend)
            socket.emit("messageFromUserToServer", JSON.stringify(messageToSend))
        }
    
        return (
            <div className="chat-wrapper">
                <h2>Send a Message</h2>
                <TextField id="outlined-basic" label="Enter Message" variant="outlined" onChange={(e) => {setMessage(e.target.value)}}/>
                <button onClick={() =>{ sendMessage(message); setVisible(true) }}>Send Message</button>
            </div>
        )
}



const Register = ({step, setStep, data, setData }) => {

    const [userID, setUserID] = useState("")
    const [response, setResponse] = useState({})

    const register = (userID) => {

        axios.post("http://localhost:8000/register", {
            "user_id": userID
        }).then((response) => {
            setData({...data, "user_id": userID, "publicKey":response.data['publicKey'], "privateKey":response.data['privateKey']})
        })
    
    }

    return (
        <div className="register-wrapper">
            <h2>User Registration</h2>
            <TextField id="outlined-basic" label="Enter User ID" variant="outlined" onChange={(e) => {setUserID(e.target.value)}}/>
            <button onClick={() =>{ register(userID); setStep(step+1)}}>Register</button>
        </div>
    )
}


const Session = ({step, setStep, data, setData}) => {

    const [receiverID, setReceiverID] = useState("")
    const [decryptedSessionKey, setDecryptedSessionKey] = useState(null);

    const createSession = (userID, receiverID) => {

        axios.post("http://localhost:8000/generate-session-key", {
            "sender_id": userID,
            "receiver_id": receiverID
        }).then((response) => {
            console.log(response)
        })       
    }    

    return (
        <div className="session-wrapper">
            <h2>Create a Session</h2>
            <TextField id="outlined-basic" label="Enter ID of the user you want to communicate" variant="outlined" onChange={(e) => {setReceiverID(e.target.value)}}/>
            <button onClick={() =>{ createSession(data['user_id'], receiverID); setStep(step+1);}}>Create Session</button>
        </div>
    )
}

export default Home