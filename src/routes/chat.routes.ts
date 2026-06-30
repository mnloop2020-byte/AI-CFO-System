import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { runOrchestrator } from '../ai/agents/orchestrator.agent.js'
const router = Router();

// ======================
// CHAT ROUTE
// ======================
// هذا الملف عبارة عن Route
// وظيفته استقبال رسالة المستخدم من /chat
router.post('/chat', async (req, res) => {
  try {
    const { conversationId, message } = req.body;

    if (!message) {
      return res.status(400).json({
        error: 'Message is required',
      });
    }

    let activeConversationId = conversationId;

    // إذا المستخدم لم يرسل conversationId
    // ننشئ conversation جديدة في قاعدة البيانات
    if (!activeConversationId) {
      const newConversation = await prisma.conversation.create({
        data: {},
      });

      activeConversationId = newConversation.id;
    }

    // نحفظ رسالة المستخدم في قاعدة البيانات
    await prisma.message.create({
      data: {
        role: 'user',
        content: message,
        conversationId: activeConversationId,
      },
    });

    // نجلب كل الرسائل القديمة الخاصة بنفس المحادثة
    const oldMessages = await prisma.message.findMany({
      where: {
        conversationId: activeConversationId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // نحول رسائل قاعدة البيانات إلى الشكل الذي يفهمه الـ Orchestrator والـ LLM
    const aiMessages = oldMessages.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    // نرسل رسالة المستخدم والرسائل القديمة إلى Orchestrator
    const aiReply = await runOrchestrator(message, aiMessages);

    // نحفظ رد المساعد في قاعدة البيانات
    await prisma.message.create({
      data: {
        role: 'assistant',
        content: aiReply!,
        conversationId: activeConversationId,
      },
    });

    return res.json({
      reply: aiReply,
      conversationId: activeConversationId,
    });
  } catch (error) {
    console.error('Chat route error:', error);

    return res.status(500).json({
      error: 'Something went wrong in chat route',
    });
  }
});

export default router;