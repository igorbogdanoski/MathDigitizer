/**
 * Embeddings domain — text embeddings for RAG / semantic search.
 * Moved verbatim from the former gemini.ts god-object.
 */
import { ai } from './client';
import { EMBEDDING_MODEL } from './models';

export async function generateTaskEmbedding(text: string): Promise<number[]> {
  try {
    const response = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text
    });
    
    if (response.embeddings && response.embeddings.length > 0 && response.embeddings[0].values) {
      return response.embeddings[0].values;
    }
    
    // In @google/genai, embedding output format depends on the wrapper version. Try alternate path:
    if (response.embedding && response.embedding.values) {
       return response.embedding.values;
    }

    throw new Error("Неуспешно генерирање на embedding.");
  } catch (error) {
    console.error("Embedding Error:", error);
    throw error;
  }
}
