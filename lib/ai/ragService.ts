/**
 * RAG (Retrieval-Augmented Generation) Service
 * Integrates vector store with chat for context-aware responses
 */

import { queryVectors, upsertVectors, VectorRecord } from "../vectorStore/pinecone";
import { generateTextEmbedding } from "../embeddings";

export interface RAGContext {
  text: string;
  score: number;
  source: string;
  category: string;
}

export interface RAGOptions {
  topK?: number;
  namespace?: string;
  category?: "academic" | "career" | "wellness" | "general";
  minScore?: number;
  userId?: string;
  source?: "user_upload" | "curated" | "faq";
}

/**
 * Retrieve relevant context for a user query
 */
export async function retrieveContext(
  query: string,
  options: RAGOptions = {}
): Promise<RAGContext[]> {
  try {
    const {
      topK = 5,
      namespace = "general",
      category,
      minScore = 0.7,
      userId,
      source,
    } = options;
    
    console.log(`[RAG Service] Querying namespace: ${namespace}, query: "${query.substring(0, 50)}...", minScore: ${minScore}, userId: ${userId || 'none'}, source: ${source || 'all'}`);

    // Generate embedding for query
    const queryEmbedding = await generateTextEmbedding(query);
    
    if (!queryEmbedding) {
      console.error("Failed to generate query embedding");
      return [];
    }

    // Build filter
    const filter: any = {};
    if (category) {
      filter.category = category;
    }
    if (userId) {
      filter.userId = userId;
    }
    if (source) {
      filter.source = source;
    }

    // Query vector store
    const queryResult = await queryVectors(queryEmbedding.vector, {
      topK,
      namespace,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
    });

    if (!queryResult.success) {
      console.error("Vector query failed:", queryResult.error);
      return [];
    }

    console.log(`[RAG Service] Raw results from ${namespace}: ${queryResult.results.length} total, scores: ${queryResult.results.map(r => r.score.toFixed(3)).join(', ')}`);

    // Filter by minimum score and format results
    const contexts: RAGContext[] = queryResult.results
      .filter((result) => result.score >= minScore)
      .map((result) => {
        const source = result.metadata.fileName || result.metadata.source || 'Unknown';
        console.log(`[RAG Service] Result: score=${result.score.toFixed(3)}, source=${source}, fileName=${result.metadata.fileName}, metadataSource=${result.metadata.source}`);
        return {
          text: result.metadata.chunkText,
          score: result.score,
          source,
          category: result.metadata.category,
        };
      });

    console.log(`[RAG Service] Returning ${contexts.length} contexts from namespace ${namespace}`);
    return contexts;
  } catch (error) {
    console.error("Error retrieving context:", error);
    return [];
  }
}

/**
 * Format RAG context for prompt injection
 */
export function formatContextForPrompt(contexts: RAGContext[]): string {
  if (contexts.length === 0) {
    return "";
  }

  const contextText = contexts
    .map((ctx, index) => {
      return `[Context ${index + 1}] (Relevance: ${(ctx.score * 100).toFixed(1)}%)
${ctx.text}`;
    })
    .join("\n\n");

  return `Here is relevant information from the knowledge base:

${contextText}

Please use this context to provide an informed response.`;
}

/**
 * Generate RAG-enhanced prompt
 */
export async function enhancePromptWithRAG(
  userQuery: string,
  options: RAGOptions = {}
): Promise<{ prompt: string; contexts: RAGContext[] }> {
  const contexts = await retrieveContext(userQuery, options);
  
  if (contexts.length === 0) {
    return {
      prompt: userQuery,
      contexts: [],
    };
  }

  const contextPrompt = formatContextForPrompt(contexts);
  const enhancedPrompt = `${contextPrompt}

User Question: ${userQuery}`;

  return {
    prompt: enhancedPrompt,
    contexts,
  };
}

/**
 * Store user conversation in vector store for personalization
 */
export async function storeConversationContext(
  userId: string,
  conversationId: string,
  message: string,
  category: "academic" | "career" | "wellness" | "general" = "general"
): Promise<boolean> {
  try {
    // Generate embedding
    const embedding = await generateTextEmbedding(message);
    
    if (!embedding) {
      console.error("Failed to generate embedding for conversation");
      return false;
    }

    // Create vector record
    const vectorRecord: VectorRecord = {
      id: `conv-${conversationId}-${Date.now()}`,
      values: embedding.vector,
      metadata: {
        userId,
        documentId: conversationId,
        category,
        chunkText: message,
        source: "user_upload",
        createdAt: new Date().toISOString(),
        fileName: undefined,
      },
    };

    // Upsert to user-specific namespace
    const result = await upsertVectors([vectorRecord], `user-${userId}`);

    return result.success;
  } catch (error) {
    console.error("Error storing conversation context:", error);
    return false;
  }
}

/**
 * Retrieve user-specific conversation history
 */
export async function retrieveUserHistory(
  userId: string,
  query: string,
  topK: number = 3
): Promise<RAGContext[]> {
  return retrieveContext(query, {
    topK,
    namespace: `user-${userId}`,
    minScore: 0.6,
  });
}
