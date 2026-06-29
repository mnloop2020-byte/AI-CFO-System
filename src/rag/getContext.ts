import { createEmbedding } from "../ai/embedding.js";
import prisma from "../lib/prisma.js";
// We import prisma because we need it to use findMany() and createMany().
//  Without Prisma, we cannot query the database.




export async function getContext(query: string): Promise<string> {
    //query is the input from the user that we want to use to get context for the LLM because we can't seacrh in  database if dont have the what the user want
    const queryEmbedding = await createEmbedding(query);
    // here we gonna convert the query to embedding because we need to compare the query with the embedding in the database to find the most relevant chunks for the LLM prompt
const vectorQuery = `[${queryEmbedding.join(',')}]`;
// we need to convert the query embedding to a string because the database only accept string not array so we need to convert the array to string
const savedChunks = await prisma.$queryRaw`
    SELECT content 
    FROM "DocumentChunk"
    ORDER BY embedding <=> ${vectorQuery}::vector
    LIMIT 3;
`as { content: string }[]; 

    const context = savedChunks.map((chunk) => chunk.content);
    const contextText = context.join("\n\n");
    
    return contextText;
} // <-- هذا هو القوس الذي كان يسبب المشكلة (Unexpected end of file)
//
// getContext()
// Reads chunks from the database and returns context for the LLM.



/**
 * How Vector Search Works Under the Hood in PostgreSQL (pgvector):
 * * 1. Comprehensive Scoring (Global Evaluation):
 * The database evaluates ALL records in the table simultaneously. 
 * Using the `<=>` operator, it calculates the mathematical distance (Cosine Distance) 
 * between the user's query embedding and the stored embedding of every text chunk.
 * Every single row instantly receives a similarity score.
 * * 2. Ordering (Sorting):
 * The database does NOT scan in batches or separate loops. Instead, it sorts the 
 * entire dataset in a single operation, placing the most relevant chunks (the shortest 
 * mathematical distance to the question) at the very top of the list.
 * * 3. Slicing (LIMIT 3):
 * Once the dataset is completely sorted, the `LIMIT 3` clause acts as a precise cutter. 
 * It extracts only the top 3 highest-scoring records from the head of the list 
 * and completely discards the rest.
 * * Core Benefits of this Workflow:
 * - Accuracy: Fetches the absolute best context for the user's question.
 * - Memory Safety: Prevents LLM context window overflow errors.
 * - Cost Control: Lowers OpenAI API spending by reducing input tokens.
 * - Performance: Maximizes the speed of the AI's response time.
 */