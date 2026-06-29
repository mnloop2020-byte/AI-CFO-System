// User asks a question
// ↓
// chat.ts starts running
// ↓
// Read context from database
// ↓
// Build prompt
// ↓
// Send to LLM

import llm from "./llm.js";
import  { SYSTEM_PROMPT , buildUserPrompt } from "./prompt.js"; // استدعاء الـ SYSTEM_PROMPT والقالب
import { getContext } from "../rag/getContext.js";
import prisma from "../lib/prisma.js";
import promptSync from "prompt-sync";

// تفعيل مكتبة prompt-sync مع خاصية sigint للسماح بإنهاء البرنامج بـ Ctrl+C
const prompt = promptSync({ sigint: true });

// 1. استقبال رسالة العميل وتخزينها
const message = prompt("You: ");
console.log("Message received:", message)
// message -> Temporary user input sent to LLM

// 2. سؤال العميل إذا كان يريد إكمال محادثة قديمة أو بدء واحدة جديدة
const inputConversationId = prompt("Conversation ID (empty = new): ");
// inputConversationId -> User chooses a conversation old or new conversation 

// التحقق: إذا كتب ID يبحث عنه، وإذا تركه فارغاً ينشئ محادثة جديدة تلقائياً
const conversation = inputConversationId.trim()
  ? await prisma.conversation.findUnique({
      where: { id: inputConversationId.trim() },
    })
  : await prisma.conversation.create({
      data: {},
    });

if (!conversation) {
  throw new Error(`Conversation not found: ${inputConversationId}`);
}

const conversationId = conversation.id;
// conversationId -> Links messages to one conversation.

// 3. [المكان الصحيح] حفظ رسالة المستخدم فوراً في قاعدة البيانات قبل استدعاء الـ LLM
await prisma.message.create({
  data: {
    role: "user",
    content: message,
    conversationId,
  },
});

// 4. جلب الرسائل السابقة الخاصة بهذه المحادثة لتبني الذاكرة (Memory)
const oldMessages = await prisma.message.findMany({
  where: {
    conversationId,
  },
  orderBy: {
    createdAt: "asc",
  },
})
// oldMessages -> Previous messages from this conversation to let the LLM remember the previous message 

// عمل خريطة (Map) لتحويل الرسائل لشكل يفهمه الـ OpenAI Client
const aiMessages = oldMessages.map((msg) => ({
  role: msg.role as "user" | "assistant",
  content: msg.content,
}));

console.log(aiMessages);
// for Memory to let the LLM remember the last chatting

// 5. جلب السياق الدقيق من الـ Vector Database بناءً على سؤال العميل الحالي
const contextText = await getContext(message);
// it comes from the file getContext

// 6. صبّ المقادير داخل قالب البرومبت العربي المنسق من ملف prompt.ts
const finalUserPrompt = buildUserPrompt(contextText, message);

console.log("Before LLM");
// 7. إرسال الطلب الكامل إلى الـ LLM (Gemini) عبر OpenRouter
const response = await llm.chat.completions.create({
  // openai.responses.create() -> Send message to LLM and generate response
  model: process.env.LLM_MODEL!,
  max_tokens: 500,

  messages: [
    {
      role: "system",
      content: SYSTEM_PROMPT, // القواعد الصارمة لشركة زمام لمنع الهلوسة والتأليف
    },
    ...aiMessages, // الـ Spread Operator لجلب كل الرسائل السابقة (الذاكرة)
    {
      role: "user",
      content: finalUserPrompt, // البرومبت الاحترافي المدمج بالسياق والسؤال معاً
    },
  ],
});
console.log("After LLM");

// استخراج محتوى الرد فقط من الكائن الضخم الذي يعود من الـ API
const aiReply = response.choices[0].message.content
// we wrote this because we want to get only the content because LLM response returns full object not only content
console.log(aiReply);

if (!aiReply) {
  throw new Error("LLM returned an empty response");
}

// 8. حفظ رد المساعد (AI) في قاعدة البيانات لتستمر الذاكرة للمرة القادمة
await prisma.message.create({
  data: {
    role: 'assistant',
    content: aiReply,
    conversationId,
  },
})
// we stored the replied in database