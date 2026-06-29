// // Import express library
// // استدعاء مكتبة Express لإنشاء السيرفر
// import express from 'express'
// import { getContext } from './rag/getContext.js'
// import { randomUUID } from 'crypto';
// import prisma from './lib/prisma.js'
// // this is the prisma client that we use to communicate with the database
// // it allows us to create, read, update and delete data from the database such as findMany, findUnique, create, update, delete,createMany, deleteMany, updateMany, etc.
// import cors from 'cors';
// // this is the cors library that we use to allow cross-origin requests from the frontend to the backend
// import multer from 'multer' 
// // this is the multer library that we use to handle file uploads
// import { splitTextIntoChunks } from './chunks/chunk.js'

// // ===================================================
// // 🚀 السلاح السري لحل مشكلة pdf is not a function
// // هذه الأداة تجبر Node.js على قراءة المكتبات القديمة بشكل سليم
// // ===================================================
// import { createRequire } from 'module';
// const require = createRequire(import.meta.url);
// const pdf = require('pdf-parse');
// // ===================================================

// const app = express(); // 1. إنشاء الـ app أولاً
// app.use(cors());       // 2. تفعيل الـ cors ثانياً
// app.use(express.json())

// import llm from './ai/llm.js'
// // // This brings the OpenAI/OpenRouter client from llm.ts
// // Meaning:
// // “Give me the object that can talk to the AI model.”

// import {SYSTEM_PROMPT} from './ai/prompt.js'
// import { createEmbedding } from './ai/embedding.js';
// // This brings the system instructions from prompt.ts.
// // Meaning:
// // “Give me the rules/personality of the AI CFO System.”


// // ======================
// // HEALTH ROUTE
// // ======================
// app.get('/health', (req, res) => {
//   res.json({ status: 'ok' })
// })

// // GET = request data / طلب بيانات
// // req = request / يمثل الطلب القادم
// // res = response / يمثل الرد المرسل


// // ======================
// // ABOUT ROUTE
// // ======================
// app.get('/about', (req, res) => {
//   res.json({
//     project: 'AI CFO System',
//     version: '1.0'
//   })
// })


// // ======================
// // CHAT ROUTE
// // ======================
// app.post('/chat', async (req, res) => {
// // when somone send the message a post requset to chat run this function
//   // POST: Frontend sends data / الفرونت يرسل بيانات
//   // Backend receives data / الباك يستقبل البيانات
  
//   const {conversationId,message} = req.body
//   // these a disturcting
//   // conversationId is the id of the conversation that recive the infromation from the cilent 
//   // message is the message that the user sent to the ai
//   //like that =>  {
//   //    "conversationId": "abc123",
//   //    "message": "Hello"
//   // }

// let activeConversationId = conversationId ;
// // The primary and only purpose of this line is to protect our server from crashing by modifying the value of the good number later.

// if(!conversationId){
//   const newconversation = await prisma.conversation.create({
//     // here we create a new conversation in the database if the conversationId is not provided by the client
//     data: {}
//     // we make it empty because we gonna recive the conversationId from the client and we dont need to send any data to the database
//   });
//   activeConversationId = newconversation.id;
// }
// // so this for if the cilent open a new conversation the server will create a new conversation in the database and return the id of the new conversation to the client so the client can use it in the next request 
// //  and if the cilent have already a converastionID the server will pass it to the database to get the old messages and send it to the AI model to get the answer and return it to the client

//   const newMessage = await prisma.message.create({
//   data: {
//     role: 'user',
//     content: message,
//     conversationId: activeConversationId,
//   },
// })
// // here we create a new message in the database with the role of user and the content of the message that the user sent and the conversationId that we get from the client or we create it if it is not provided by the client

// const oldMessages= await prisma.message.findMany({
//   // oldMessages returns an array of messages
//   where: {
//     conversationId: activeConversationId,
//     // means that tell the database to give us the conversation is related to the conversationId
//   },
//   orderBy: {
//     createdAt: 'asc',
//   },
//   //Sort the results by creation time from the oldest to the newest
// })
// // we use the findMany to get all the messages that we have in the database 

// const aiMessages = oldMessages.map((msg) => ({
//   role: msg.role as 'user' | 'assistant',
//   content: msg.content,
// }))
// // map works like a loop to iterate over the array of messages and return a new array of messages
// // also we use the as 'user' | 'assistant' becuse we want to get the role and content of the message we dont want to get the id of the message

// const contextText = await getContext(message)
// // this function related to RAG and it is responsible for getting the relevant chunks from the database based on the user's query and return it as a text that we can send to the AI model as context for the prompt

//   const response = await llm.chat.completions.create({
//     // llm which has the OpenAI/OpenRouter client and we use it to send a request to the AI model to get a response based on the user's message and the context that we get from the database
//     // chat : we tell the  company that we want to use the chat API of the OpenAI/OpenRouter client
//     // completions : we tell the company that we want to create a completion which means we want to get a response from the AI model
// //     Send a request to the AI.
// //  await Wait until the AI finishes.
// // Store the result in response.

//     model: process.env.LLM_MODEL!,
//     // Use the model stored in .env
//     max_tokens: 1000,
  
//     messages: [
//         // the context only read from inside this array message 
//     // The information the AI can see right now
//       {
//        role: 'system',
//         content: `${SYSTEM_PROMPT}\n\nاستخدم المعلومات التالية للإجابة على المستخدم:\n${contextText}`,
//       },
      
//       ...aiMessages,
//       // ... is the spread operator that means all the messages that we have in the conversation
//       // ...aiMessages means all the messages that we have in the conversation
//     ],
//   })

//   const aiReply = response.choices[0].message.content

//   await prisma.message.create({
//     data: {
//       role: 'assistant',
//       content: aiReply!,
//       conversationId: activeConversationId,
//     },
//   })
  
//   res.json({
//     reply: aiReply,
//     conversationId: activeConversationId,
//     // Also this is temporary memory:
//     // reply is the key name 
// //     Take the AI answer
// // and send it back to the client.
//   })
// })


// // ======================
// // CREATE USER
// // ======================
// app.post('/user', async (req, res) => {
//   const userData = req.body
// // userData this place we recived the data from the user 
  
//   const newUser = await prisma.user.create({
// // newUser stores the result returned from the database.
// //   await prisma.user.create() => Insert a new row into database.

// data:{
//   // here the data that we want to send to the database.
// // data :> Object containing values to insert.
//          email: userData.email,
//         password: userData.password,
// }
// }) 

// res.json({
//   message: 'user created',
//   data: newUser
// })
// })
// // Frontend ➔ POST /user ➔ Express Route ➔ req.body ➔ userData ➔ Prisma create() ➔ data:{ email, password } ➔ PostgreSQL ➔ newUser ➔ Response
// // الملاحظات (Notes)
// // userData : المدخلات القادمة من المستخدم (input from user).
// // data:{} : الحزمة أو البيانات التي يتم إرسالها إلى قاعدة البيانات (package sent to database).
// // newUser : النتيجة التي تعود من قاعدة البيانات بعد إنشاء المستخدم (result returned from database).


// // ======================
// // GET USERS
// // ======================
// app.get('/users', async (req, res) => {
//   const users = await prisma.user.findMany()
// // findMany: Retrieve multiple records from database.
// res.json({
//   data:users
// })
// })

// app.get('/users/:id', async (req, res) => {
// const id = req.params.id
// // params => Values taken from the URL path
// const user = await prisma.user.findUnique({
//   where:{
//       id:id
//   }
// })
// // findUnique=> Retrieve one record using a unique field.

// res.json({
//   data:user
// })
// })


// const upload = multer({ storage: multer.memoryStorage() }); 
// // we tell multer to store the uploaded files in memory instead of saving them to disk. This is useful for small files that we want to process immediately without saving them to disk.


// // =======================================================
// // 🎯 DYNAMIC UPLOAD & RAG ROUTE
// // مسار استقبال ملفات الشركة وتفكيكها وتقطيعها تلقائياً
// // =======================================================
// app.post('/upload', upload.single('file'),async(req,res)=>{
//   // why we use file 
//   // why we use upload.single('file')?
//   // Because we want to receive a single file from the frontend and the name of the file input field is 'file'.
//   // file 
//   try {
//     // 1. Safety Check: Verify if the file successfully reached the server
//     // صمام الأمان: التحقق من أن المستخدم أرفق ملفاً فعلياً ولم يرسل طلباً فارغاً
//     if (!req.file) {
//       return res.status(400).json({ error: 'لم يتم إرسال أي ملف، تأكد من إرفاق الملف بشكل صحيح' });
//     }
//     // so here if user send a request without a file the server will return a 400 error with a message that says "No file uploaded, please attach a file correctly"

 
    
// await prisma.$executeRaw`DELETE FROM "DocumentChunk"`;
//     console.log("تم تنظيف جدول DocumentChunk تلقائياً وبنجاح!");
// // 2. Automatic DB Clean: Clear old data from DocumentChunk table
//     // تنظيف قاعدة البيانات: مسح السجلات القديمة تلقائياً لمنع اختلاط معلومات الشركات
// // the purpose of this line is to delete all the old chunks from the database before we insert the new chunks from the new file that the user uploaded


//     // ===================================================
//     // 🎯 3. Text Extraction: Convert raw Buffer from RAM into pure Arabic text
//     // الكود الآن نظيف وبسيط ويستخدم الـ pdf المأخوذ من createRequire في الأعلى
//     // ===================================================
//     const pdfData = await pdf(req.file.buffer);
    
//     // (req.file.buffer) matches the file exists in memory and we can access it using req.file.buffer
//     // pdf :> Its software function is to access these numbers, decompress the PDF pages, and read the words and lines from within.
//     const extractedText = pdfData.text;
//     console.log("تم استخراج النص من الـ PDF بنجاح! طول النص الكامل:", extractedText.length);

//     // 4. Text Chunking: Use your predefined function to split the long text
//     // تقطيع النص: استخدام دالتك الجاهزة والمستوردة لتقسيم النص الضخم إلى مصفوفة قطع صغيرة
//     const chunkedText = splitTextIntoChunks(extractedText);
//     // chunkedText returns an array of strings [chunk1, chunk2, chunk3...]
//     console.log(`تم تقسيم الملف بنجاح إلى ${chunkedText.length} قطعة (Chunk)!`);

//     // ===================================================
//     // 🎯 5. توليد الـ Embeddings وحفظها في قاعدة البيانات (المكان الصحيح والآمن الحين)
//     // ===================================================
//     // حلقة تكرارية تمر على كل قطعة نصية قمنا بقصها سابقاً بالداخل
//    for (const chunk of chunkedText) {
//   const embeddingVector = await createEmbedding(chunk);

//   await prisma.$executeRaw`
//     INSERT INTO "DocumentChunk" ("id", "content", "embedding", "createdAt")
//     VALUES (
//       ${randomUUID()},
//       ${chunk},
//       ${JSON.stringify(embeddingVector)}::vector,
//       NOW()
//     )
//   `;
// }
//     console.log("تم توليد الـ Embeddings وحفظ جميع القطع بنجاح في Supabase!");

//     // الرد الرسمي عند نهاية كافة العمليات بنجاح
//     return res.json({ 
//       message: 'تم استقبال الملف، تفكيكه، وتقطيعه وتوليد الـ Embeddings وحفظها بنجاح!', 
//       chunksCount: chunkedText.length 
//     });

//   } catch (error) {
//     // Catch block to protect our server from crashing if something went wrong
//     // حماية السيرفر من الانهيار في حال حدوث أي خطأ غير متوقع أثناء المعالجة
//     console.error('حدث خطأ في معالجة الـ PDF:', error);
//     return res.status(500).json({ error: 'حدث خطأ داخلي في السيرفر أثناء معالجة الملف' });
//   }
// })


// // ======================
// // START SERVER
// // ======================
// const PORT = Number(process.env.PORT) || 3001

// app.listen(PORT, () => {
//   console.log(`server running on port ${PORT}`)
// })

// // app.listen() — Starts server / تشغيل السيرفر
// // Port — منفذ يستقبل الطلبات
// // Server becomes active after listen()



import 'dotenv/config'
import app from './app.js'

const PORT = Number(process.env.PORT) || 3001

app.listen(PORT, () => {
  console.log(`server running on port ${PORT}`)
})

