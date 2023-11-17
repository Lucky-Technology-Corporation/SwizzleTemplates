//_SWIZZLE_FILE_PATH_backend/user-dependencies/post.gpt.chat.ts
import express, { Response } from "express";
import { ObjectId } from 'mongodb';
import { OpenAI } from 'openai';
import { AuthenticatedRequest, db, optionalAuthentication } from 'swizzle-js';
const router = express.Router();
const openai = new OpenAI({apiKey: process.env.OPENAI_API_KEY});

router.post('/send', optionalAuthentication, async (request: AuthenticatedRequest, response: Response) => {
    if(!request.body || !request.body.message){
        return response.status(400).json({error: 'Missing message'});
    }

    const message = request.body.message
    const userId = request.user?.userId ?? undefined;
    var conversationId = request.body.conversationId;

    let conversation;

    if(conversationId){ //Get existing conversation, if it exists
        conversation = await db.collection('conversations').findOne({ _id: new ObjectId(conversationId), userId});
    }

    if(!conversation){ //Create new conversation, if it doesn't exist
        conversation = {userId, messages:[]};
        const inserted = await db.collection('conversations').insertOne(conversation);
        conversationId = inserted.insertedId
    }

    conversation.messages.push({ role: 'user', content: message}); //Add user message to conversation
    
    const stream = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: conversation.messages,
        stream: true,
    });

    response.setHeader("Transfer-Encoding", "chunked");
    response.setHeader("Content-Type", "text/plain");
    response.setHeader("Access-Control-Expose-Headers","Conversation-Id")
    response.setHeader("Conversation-Id", conversationId);

    //Send the response to the user as it comes in
    let answer = ''
    for await (const part of stream) {
        response.write(part.choices[0]?.delta?.content || '')
        answer += part.choices[0]?.delta?.content || ''
    }

    //Add the assistant's response to the conversation
    conversation.messages.push({ role: 'assistant', content: answer});
    //Update the conversation in the database
    await db.collection('conversations').updateOne({_id: conversationId}, {$set: conversation});
    //End the response
    return response.end();
});

export default router;
//_SWIZZLE_FILE_PATH_frontend/src/components/Chat.tsx
import { useEffect, useRef, useState } from 'react';
import './App.css';

function Chat() {
    const [messages, setMessages] = useState([]);
    const [isAnswering, setIsAnswering] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [conversationId, setConversationId] = useState(undefined);
    const afterLastMessageRef = useRef(undefined);
  
    useEffect(()=>{
      if(afterLastMessageRef.current){
          afterLastMessageRef.current.scrollIntoView({ behavior: "smooth", block: "end"});
      }
    },[messages])
  
    const sendMessage = async ()=>{
      setIsAnswering(true);
      setPrompt('');
      setMessages(messages => messages.concat(
          {
              role: 'User',
              content: prompt,
          }, 
          {
              role: 'Assistant',
              content: '',
          }
      ));
      const response = await fetch('https://api.' + window.location.hostname + '/send', {
          method: "post",
          body: JSON.stringify({ message: prompt, conversationId }),
          headers: {
          Accept: "application/json, text/plain, */*",
          "Content-Type": "application/json",
          }
      });
      if (!response.ok || !response.body) {
          setIsAnswering(false);
          throw response.statusText;
      }
      console.log(response.headers)
      setConversationId(response.headers.get("Conversation-Id"));
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const loopRunner = true;
      while (loopRunner) {
          // Loop over the response stream to get the data as fast as possible and with the typewriter effect like chatgpt
          const { value, done } = await reader.read();
          if (done) {
              console.log(response.headers)
          break;
          }
          const decodedChunk = decoder.decode(value, { stream: true });
          // Change the content of the last message to itself + new text
          setMessages(messages => [...messages.slice(0,-1), {...messages.slice(-1)[0], content: messages.slice(-1)[0].content + decodedChunk}]); 
      }
      setIsAnswering(false);
    }
  
    return (
    <>
        <div className='chat-container w-full px-2'>
            {messages.map((message, i) => (
                <div key={i} className='chat-message-container mb-1'>
                    <span className='chat-message-role text-xs text-gray-600'>{message.role}:</span>
                    <p className='chat-message'>{message.content}</p>
                </div>
            ))}
            <div className="h-12" ref={afterLastMessageRef}>&nbsp;</div>
        </div>

        <div className='send-message-container w-full flex px-2 mt-auto mb-2 fixed bottom-0'>
            <input className='chat-input flex-grow border rounded' 
                onKeyDown={e => {
                    if(e.key === "Enter"){
                        e.preventDefault();
                        sendMessage();
                    }
                }}
                value={prompt}
                onChange={e=>setPrompt(e.target.value)} type="text" 
            />
            
            <button disabled={isAnswering} className='send-button ml-2 border rounded p-2 bg-gray-200' onClick={sendMessage}>Send</button>
        </div>
    </>
    );
}
  
export default Chat;