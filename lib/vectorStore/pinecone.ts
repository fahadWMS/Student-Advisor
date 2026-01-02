import { Pinecone, Index, RecordMetadata } from "@pinecone-database/pinecone";

// Type definitions
export interface VectorMetadata extends Record<string, any> {
  userId?: string;
  documentId?: string;
  category: "academic" | "career" | "wellness" | "general";
  chunkText: string;
  source: "user_upload" | "curated" | "faq";
  fileName?: string;
  createdAt: string;
}

export interface VectorRecord {
  id: string;
  values: number[];
  metadata: VectorMetadata;
}

export interface QueryResult {
  id: string;
  score: number;
  metadata: VectorMetadata;
}

export interface QueryOptions {
  topK?: number;
  filter?: Partial<VectorMetadata>;
  includeMetadata?: boolean;
  namespace?: string;
}

// Lazy initialization for Vercel cold start optimization
let pineconeClient: Pinecone | null = null;
let pineconeIndex: Index | null = null;

/**
 * Get or initialize Pinecone client
 */
function getPineconeClient(): Pinecone {
  if (!pineconeClient) {
    const apiKey = process.env.PINECONE_API_KEY;
    
    if (!apiKey) {
      throw new Error("PINECONE_API_KEY is not set in environment variables");
    }

    pineconeClient = new Pinecone({ apiKey });
  }

  return pineconeClient;
}

/**
 * Get or initialize Pinecone index
 */
export function getPineconeIndex(): Index {
  if (!pineconeIndex) {
    const client = getPineconeClient();
    const indexName = process.env.PINECONE_INDEX || "student-consultation";
    pineconeIndex = client.index(indexName);
  }

  return pineconeIndex;
}

/**
 * Upsert vectors to Pinecone with metadata
 * @param vectors - Array of vector records to upsert
 * @param namespace - Namespace to upsert to (default: 'general')
 */
export async function upsertVectors(
  vectors: VectorRecord[],
  namespace: string = "general"
): Promise<{ success: boolean; upsertedCount: number; error?: string }> {
  try {
    const index = getPineconeIndex();
    
    if (vectors.length === 0) {
      return { success: true, upsertedCount: 0 };
    }

    // Upsert to specified namespace
    await index.namespace(namespace).upsert(vectors);

    console.log(`Upserted ${vectors.length} vectors to namespace: ${namespace}`);

    return {
      success: true,
      upsertedCount: vectors.length,
    };
  } catch (error) {
    console.error("Error upserting vectors to Pinecone:", error);
    return {
      success: false,
      upsertedCount: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Query vectors from Pinecone
 * @param queryVector - Query embedding vector
 * @param options - Query options (topK, filter, namespace)
 */
export async function queryVectors(
  queryVector: number[],
  options: QueryOptions = {}
): Promise<{ success: boolean; results: QueryResult[]; error?: string }> {
  try {
    const index = getPineconeIndex();
    const {
      topK = 5,
      filter,
      includeMetadata = true,
      namespace = "general",
    } = options;

    // Build query options
    const queryOptions: any = {
      vector: queryVector,
      topK,
      includeMetadata,
    };

    // Add filter if provided
    if (filter) {
      const pineconeFilter: any = {};
      
      // Convert our filter format to Pinecone's filter format
      if (filter.category) {
        pineconeFilter.category = { $eq: filter.category };
      }
      if (filter.source) {
        pineconeFilter.source = { $eq: filter.source };
      }
      if (filter.userId) {
        pineconeFilter.userId = { $eq: filter.userId };
      }
      if (filter.documentId) {
        pineconeFilter.documentId = { $eq: filter.documentId };
      }

      if (Object.keys(pineconeFilter).length > 0) {
        queryOptions.filter = pineconeFilter;
      }
    }

    // Query the specified namespace
    const queryResponse = await index.namespace(namespace).query(queryOptions);

    // Transform results
    const results: QueryResult[] = (queryResponse.matches || []).map((match) => ({
      id: match.id,
      score: match.score || 0,
      metadata: match.metadata as VectorMetadata,
    }));

    return {
      success: true,
      results,
    };
  } catch (error) {
    console.error("Error querying vectors from Pinecone:", error);
    return {
      success: false,
      results: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Delete vectors from Pinecone
 * @param ids - Array of vector IDs to delete
 * @param namespace - Namespace to delete from (default: 'general')
 */
export async function deleteVectors(
  ids: string[],
  namespace: string = "general"
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  try {
    const index = getPineconeIndex();

    if (ids.length === 0) {
      return { success: true, deletedCount: 0 };
    }

    // Delete from specified namespace
    await index.namespace(namespace).deleteMany(ids);

    console.log(`Deleted ${ids.length} vectors from namespace: ${namespace}`);

    return {
      success: true,
      deletedCount: ids.length,
    };
  } catch (error) {
    console.error("Error deleting vectors from Pinecone:", error);
    return {
      success: false,
      deletedCount: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Delete all vectors for a specific user
 * @param userId - User ID to delete vectors for
 * @param namespace - Namespace to delete from (default: 'general')
 */
export async function deleteUserVectors(
  userId: string,
  namespace: string = "general"
): Promise<{ success: boolean; error?: string }> {
  try {
    const index = getPineconeIndex();

    // Delete by metadata filter
    await index.namespace(namespace).deleteMany({
      userId: { $eq: userId },
    });

    console.log(`Deleted all vectors for user ${userId} from namespace: ${namespace}`);

    return { success: true };
  } catch (error) {
    console.error("Error deleting user vectors from Pinecone:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Delete all vectors for a specific document
 * @param documentId - Document ID to delete vectors for
 * @param namespace - Namespace to delete from (default: 'general')
 */
export async function deleteDocumentVectors(
  documentId: string,
  namespace: string = "general"
): Promise<{ success: boolean; error?: string }> {
  try {
    const index = getPineconeIndex();

    // Delete by metadata filter
    await index.namespace(namespace).deleteMany({
      documentId: { $eq: documentId },
    });

    console.log(`Deleted all vectors for document ${documentId} from namespace: ${namespace}`);

    return { success: true };
  } catch (error) {
    console.error("Error deleting document vectors from Pinecone:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get index statistics
 */
export async function getIndexStats(): Promise<{
  success: boolean;
  stats?: any;
  error?: string;
}> {
  try {
    const client = getPineconeClient();
    const indexName = process.env.PINECONE_INDEX || "student-consultation";
    
    const stats = await client.describeIndex(indexName);

    return {
      success: true,
      stats,
    };
  } catch (error) {
    console.error("Error getting index stats:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
