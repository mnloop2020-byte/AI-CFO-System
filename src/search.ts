// this file is responsible for searching the database for relevant chunks based on the user's query. It uses the OpenAI API to create an embedding of the user's query and then performs a semantic search in the database to find the most relevant chunks.
import OpenAI from 'openai';
import prisma from './prisma/prisma.js';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

export async function search(query: string) {
  // 1. تحويل سؤال العميل إلى فيكتور (Vector)
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  });
  const queryEmbedding = response.data[0].embedding;

  // 2. البحث في Supabase عن أقرب الفقرات (Semantic Search)
  // نحن نستخدم pgvector لحساب التشابه (Cosine Similarity)
  const results: any[] = await prisma.$queryRaw`
    SELECT content, 1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) AS similarity
    FROM "DocumentChunk"
    WHERE 1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) > 0.4
    ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
    LIMIT 3;
  `;

  return results;
}