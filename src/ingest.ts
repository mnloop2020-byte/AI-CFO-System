import fs from 'fs';
import { randomUUID } from 'crypto';
import 'dotenv/config';
import { splitTextIntoChunks } from './chunks/chunk.js';
import OpenAI from 'openai';
import prisma from './lib/prisma.js';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

async function main() {
  console.log('⏳ جاري قراءة الملف وتقسيمه...');
console.log('📄 هل الملف موجود؟', fs.existsSync('src/data/zemam-profile.txt'));
  const text = fs.readFileSync('src/data/zemam-profile.txt', 'utf-8');
  const chunks = splitTextIntoChunks(text);

  console.log(`✅ لدينا ${chunks.length} فقرة. جاري المعالجة...`);

  for (const chunk of chunks) {
    console.log(`🧠 جاري تحويل الفقرة: "${chunk.substring(0, 20)}..."`);

    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: chunk,
    });

    const embedding = response.data[0].embedding;

    await prisma.$executeRaw`
      INSERT INTO "DocumentChunk" ("id", "content", "source", "embedding")
      VALUES (
        ${randomUUID()},
        ${chunk},
        ${'zemam-profile.txt'},
        ${JSON.stringify(embedding)}::vector
      )
    `;

    console.log('✅ تم حفظ الفقرة بنجاح!');
  }

  console.log('🎉 مبروك! تم تخزين كامل ملف شركة زمام في قاعدة البيانات.');
}

main()
  .catch((e) => {
    console.error('❌ حدث خطأ أثناء المعالجة:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
