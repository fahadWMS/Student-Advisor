/**
 * RAG (Retrieval-Augmented Generation) Tool
 * Semantic search across knowledge base and user documents
 */

import {
  Tool,
  ToolContext,
  ToolResult,
  RagSearchParams,
  RagSearchResult,
  PersonaType,
} from "./types";
import { generateTextEmbedding } from "../../embeddings";
import { queryVectors } from "../../vectorStore/pinecone";

/**
 * Execute RAG search
 */
async function executeRagSearch(
  params: Record<string, any>,
  context: ToolContext
): Promise<ToolResult> {
  const startTime = Date.now();

  try {
    const {
      query,
      userId,
      category,
      topK = 5,
      minScore = 0.7,
      namespace,
      includeUserDocs = false,
    } = params;

    // Validate query
    if (!query || query.trim().length === 0) {
      return {
        success: false,
        error: "Query cannot be empty",
      };
    }

    console.log(`🔍 RAG Search: "${query}"`);

    // Step 1: Generate query embedding
    const embedding = await generateTextEmbedding(query);

    if (!embedding) {
      return {
        success: false,
        error: "Failed to generate query embedding",
      };
    }

    console.log(`  Generated ${embedding.dimensions}D embedding`);

    // Step 2: Determine namespace
    let searchNamespace = namespace || category || "general";

    // Step 3: Build filter
    const filter: any = {};
    if (category) {
      filter.category = category;
    }
    if (userId && includeUserDocs) {
      filter.userId = userId;
    }

    // Step 4: Query Pinecone
    const queryResult = await queryVectors(embedding.vector, {
      topK,
      namespace: searchNamespace,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
      includeMetadata: true,
    });

    if (!queryResult.success) {
      return {
        success: false,
        error: `Vector search failed: ${queryResult.error}`,
      };
    }

    // Step 5: Filter by minimum score and format results
    const chunks = queryResult.results
      .filter((result) => result.score >= minScore)
      .map((result) => ({
        id: result.id,
        text: result.metadata.chunkText || result.metadata.content || "",
        score: result.score,
        metadata: {
          category: result.metadata.category,
          source: result.metadata.source,
          fileName: result.metadata.fileName,
          documentId: result.metadata.documentId,
          userId: result.metadata.userId,
          createdAt: result.metadata.createdAt,
        },
      }));

    console.log(`  Found ${chunks.length} relevant chunks (min score: ${minScore})`);

    const searchTime = Date.now() - startTime;

    const ragResult: RagSearchResult = {
      chunks,
      query,
      resultCount: chunks.length,
      searchTime,
    };

    return {
      success: true,
      data: ragResult,
      metadata: {
        latency: searchTime,
        source: "pinecone",
        namespace: searchNamespace,
        embeddingDimensions: embedding.dimensions,
        topK,
        minScore,
      },
    };
  } catch (error) {
    console.error("RAG search error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      metadata: {
        latency: Date.now() - startTime,
      },
    };
  }
}

/**
 * Multi-namespace RAG search
 * Searches across multiple namespaces and combines results
 */
async function executeMultiNamespaceSearch(
  params: Record<string, any>,
  context: ToolContext
): Promise<ToolResult> {
  const { namespaces, ...searchParams } = params;

  try {
    console.log(`🔍 Multi-namespace RAG Search across: ${namespaces.join(", ")}`);

    // Search each namespace
    const searchPromises = namespaces.map((ns: string) =>
      executeRagSearch({ ...searchParams, namespace: ns }, context)
    );

    const results = await Promise.all(searchPromises);

    // Combine and sort all chunks by score
    const allChunks: RagSearchResult["chunks"] = [];
    let totalTime = 0;

    results.forEach((result) => {
      if (result.success && result.data) {
        allChunks.push(...result.data.chunks);
        totalTime += result.metadata?.latency || 0;
      }
    });

    // Sort by score descending and limit to topK
    allChunks.sort((a, b) => b.score - a.score);
    const topChunks = allChunks.slice(0, searchParams.topK || 5);

    const ragResult: RagSearchResult = {
      chunks: topChunks,
      query: searchParams.query,
      resultCount: topChunks.length,
      searchTime: totalTime,
    };

    return {
      success: true,
      data: ragResult,
      metadata: {
        latency: totalTime,
        source: "pinecone-multi",
        namespaces: namespaces.join(","),
        totalResults: allChunks.length,
      },
    };
  } catch (error) {
    console.error("Multi-namespace RAG search error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * RAG Tool Definition
 */
export const ragTool: Tool = {
  name: "rag_search",
  description:
    "Semantic search across knowledge base and user documents. Retrieves relevant information based on natural language queries using vector similarity search.",
  capabilities: ["rag", "document-search"],
  personas: ["academic", "career", "wellness", "general"],
  parameters: {
    query: {
      type: "string",
      description: "The search query in natural language",
      required: true,
    },
    userId: {
      type: "string",
      description: "User ID for personalized search (includes user documents)",
      required: false,
    },
    category: {
      type: "string",
      description: "Filter by category (academic, career, wellness, general)",
      required: false,
      enum: ["academic", "career", "wellness", "general"],
    },
    topK: {
      type: "number",
      description: "Number of results to return (default: 5)",
      required: false,
      default: 5,
    },
    minScore: {
      type: "number",
      description: "Minimum similarity score (0-1, default: 0.7)",
      required: false,
      default: 0.7,
    },
    namespace: {
      type: "string",
      description: "Specific namespace to search (overrides category)",
      required: false,
    },
    includeUserDocs: {
      type: "boolean",
      description: "Include user's personal documents in search (default: false)",
      required: false,
      default: false,
    },
  },
  execute: executeRagSearch,
  validate: (params: Record<string, any>) => {
    const errors: string[] = [];

    if (!params.query || typeof params.query !== "string") {
      errors.push("query must be a non-empty string");
    }

    if (params.topK && (params.topK < 1 || params.topK > 20)) {
      errors.push("topK must be between 1 and 20");
    }

    if (params.minScore && (params.minScore < 0 || params.minScore > 1)) {
      errors.push("minScore must be between 0 and 1");
    }

    if (
      params.category &&
      !["academic", "career", "wellness", "general"].includes(params.category)
    ) {
      errors.push("category must be one of: academic, career, wellness, general");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },
  examples: [
    {
      description: "Search for study techniques",
      params: {
        query: "What are effective study techniques for exams?",
        category: "academic",
        topK: 5,
      },
    },
    {
      description: "Search user's documents",
      params: {
        query: "My previous assignments about machine learning",
        userId: "user-123",
        includeUserDocs: true,
        topK: 3,
      },
    },
    {
      description: "Search career advice",
      params: {
        query: "How to prepare for technical interviews?",
        category: "career",
        minScore: 0.75,
      },
    },
  ],
};

/**
 * Multi-namespace RAG Tool
 * Searches across multiple namespaces simultaneously
 */
export const multiNamespaceRagTool: Tool = {
  name: "rag_search_multi",
  description:
    "Search across multiple knowledge base namespaces simultaneously and combine results by relevance.",
  capabilities: ["rag", "document-search"],
  personas: ["general"],
  parameters: {
    query: {
      type: "string",
      description: "The search query in natural language",
      required: true,
    },
    namespaces: {
      type: "array",
      description: "List of namespaces to search",
      required: true,
      items: {
        type: "string",
      },
    },
    topK: {
      type: "number",
      description: "Total number of results to return (default: 5)",
      required: false,
      default: 5,
    },
    minScore: {
      type: "number",
      description: "Minimum similarity score (0-1, default: 0.7)",
      required: false,
      default: 0.7,
    },
  },
  execute: executeMultiNamespaceSearch,
  examples: [
    {
      description: "Search across all knowledge domains",
      params: {
        query: "How to manage stress while studying?",
        namespaces: ["academic", "wellness", "general"],
        topK: 10,
      },
    },
  ],
};

// Export both tools
export default ragTool;
