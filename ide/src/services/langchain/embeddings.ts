// Embeddings using a placeholder - LangChain requires OpenAI key which we don't have
// This is a fallback that returns empty embeddings
const embeddings = {
  embedQuery: async (_query: string): Promise<number[]> => {
    // Return a placeholder 1536-dimensional vector of zeros
    return new Array(1536).fill(0);
  },
  embedDocuments: async (_documents: string[]): Promise<number[][]> => {
    return _documents.map(() => new Array(1536).fill(0));
  },
};

export { embeddings };

// Note: For production with embeddings:
// 1. Get an OpenAI API key from https://platform.openai.com/account/api-keys
// 2. Install: npm install @langchain/openai
// 3. Replace the placeholder below with:
/*
import { OpenAIEmbeddings } from '@langchain/openai';
const embeddings = new OpenAIEmbeddings({
  model: 'text-embedding-3-small',
  apiKey: process.env.OPENAI_API_KEY,
});
*/
