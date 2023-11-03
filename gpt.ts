//_SWIZZLE_FILE_PATH_backend/user-dependencies/post.gpt.chat.ts
import express from 'express';
const router = express.Router();
import { optionalAuthentication, requiredAuthentication, db } from 'swizzle-js';
import { OpenAI } from 'openai';
const ObjectId = require('mongodb').ObjectId; 


const openai = new OpenAI({
 // Make sure you add the OPENAI_API_KEY Secret with your api key!
});

router.post('/send', optionalAuthentication, async (request, response) => {
    if(!request.body || !request.body.message){
        return response.status(400).json({error: 'Missing message'});
    }

    const message = request.body.message
    const userId = request.user?.userId ?? 'guest';
    
    let conversationId = request.body.conversationId;
    let conversation;
    if(conversationId){
        conversation = await db.collection('conversations').findOne({ _id: new ObjectId(conversationId), userId});
    }
    if(!conversation){
        // create a new conversation
        conversation = {userId, messages:[]};
        inserted = await db.collection('conversations').insertOne(conversation);
        conversationId = inserted.insertedId
    }
    conversation.messages.push({ role: 'user', content: message});
    
    
    const stream = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: conversation.messages,
        stream: true,
    });
    response.setHeader("Transfer-Encoding", "chunked");
    response.setHeader("Content-Type", "text/plain");
    // Allow frontend to read Conversation-Id headers:
    response.setHeader("Access-Control-Expose-Headers","Conversation-Id")
    response.setHeader("Conversation-Id", conversationId);
    let answer = ''
    for await (const part of stream) {
        response.write(part.choices[0]?.delta?.content || '')
        answer += part.choices[0]?.delta?.content || ''
    }
    conversation.messages.push({ role: 'assistant', content: answer});
    db.collection('conversations').updateOne({_id: conversationId}, {$set: conversation});
    response.end();
});

module.exports = router;