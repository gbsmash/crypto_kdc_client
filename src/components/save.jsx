import React from 'react'
import { useState, useEffect } from 'react'
import TextField from '@mui/material/TextField';
import axios from 'axios';
import { useContext } from 'react';
import { userContext } from './UserContext';
import JSEncrypt from 'jsencrypt';
import CryptoJS from 'crypto-js';


function Home() {

    const {data, setData} = useContext(userContext);
    const [step, setStep] = useState(0)
    const [decryptedSessionKey, setDecryptedSessionKey] = useState(null);
    const [socket, setSocket] = useState(null);



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
            const lSocket = new WebSocket(`ws://localhost:8000/ws/${data['user_id']}`);
    
            lSocket.addEventListener('open', () => {
                console.log('Connected to WebSocket');
            });
              
            lSocket.addEventListener('message', (event) => {

                const eventData = JSON.parse(event.data)
                console.log('Received message:', eventData);

                if(eventData['encrypted_session_key'] !== undefined)
                {
                    console.log("if")
                    setData(prevData => {
                        const updatedData = {
                            ...prevData,
                            "sender_id": eventData["sender_id"],
                            "receiver_id": eventData["receiver_id"],
                            "encrypted_session_key": eventData['encrypted_session_key']
                        };
                        const decryptedSessionKey = decryptSessionKey(updatedData);
                        setStep(2);
                        const newData = {
                            ...updatedData,
                            "decrypted_session_key": eventData['encrypted_session_key']
                        };
                        console.log(newData);
                        return newData;
                    });
                }
                else{
                    console.log("else")
                    const message = JSON.parse(event.data);
                    const dataString = String.fromCharCode.apply(null, message.data);
                    const dataObject = JSON.parse(dataString);
                    console.log(dataObject, dataObject["msg_content"], data)
                    const key = CryptoJS.enc.Hex.parse(data["decrypted_session_key"]);
                    const bytes = CryptoJS.AES.decrypt(dataObject["msg_content"], key, { mode: CryptoJS.mode.ECB });
                    // const plaintext = bytes.toString(CryptoJS.enc.Utf8);
                    console.log(plaintext)
                }
            });
              
            lSocket.addEventListener('close', () => {
                console.log('WebSocket connection closed');
            });

            setSocket(lSocket)
        }
    }, [data['user_id']]);



  return (
    <div className='home-page'>
        {
           step === 0 ? <Register step={step} setStep={setStep} data={data} setData={setData}/> : step === 1 ? <Session step={step} setStep={setStep} data={data} setData={setData}/> : <Chat data={data} socket={socket}/> 
        }
        {
            step === 0 ? <></> :  <div className="sessions-data">
            <h3>User ID</h3>
            <p>{data["user_id"]}</p>
            <h3>Sender ID</h3>
            <p>{data['sender_id']}</p>
            <h3>Receiver ID</h3>
            <p>{data['receiver_id']}</p>
            <h3>Session Key</h3>
            <p>{data['encrypted_session_key']}</p>
        </div>
        }

    </div>
  )
}


const Chat = ({data, socket}) => {
    
        const [message, setMessage] = useState("")
    
        const sendMessage = (message) => {
            const messageToSend = {}
            
            const key = CryptoJS.enc.Hex.parse(data["decrypted_session_key"]);
            const ciphertext = CryptoJS.AES.encrypt(message, key, { mode: CryptoJS.mode.ECB }).toString();
            messageToSend["msg_content"] = ciphertext;
            messageToSend["sender_id"] = data["user_id"];
            messageToSend["receiver_id"] = data["receiver_id"];
            socket.send(JSON.stringify(messageToSend))
        }
    
        return (
            <div className="chat-wrapper">
                <h2>Send a Message</h2>
                <TextField id="outlined-basic" label="Enter Message" variant="outlined" onChange={(e) => {setMessage(e.target.value)}}/>
                <button onClick={() =>{ sendMessage(message); }}>Send Message</button>
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