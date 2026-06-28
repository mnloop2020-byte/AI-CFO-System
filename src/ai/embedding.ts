import llm from "./llm.js";

// Reuse the existing OpenRouter client from llm.ts.


export async function createEmbedding(text: string) {
// createEmbedding()
// Takes text and returns its embedding vector.



// llm.embeddings.create()
// Converts text into an embedding vector.

const response = await llm.embeddings.create({
  model: process.env.EMBEDDING_MODEL!,
  // Used for generating embedding vectors.
    input: text,
// Text sent to the embedding model.
//What text do you want to convert into an embedding?
    
  });



const embedding = response.data[0].embedding 
// here in this line we gonna get only the vectors 
console.log(embedding);
return embedding;
// خذ هذه القيمة وأرجعها للشخص الذي استدعى الدالة
  

}
// response = كل الصندوق.
// embedding = الشيء الذي نريده من داخل الصندوق.



