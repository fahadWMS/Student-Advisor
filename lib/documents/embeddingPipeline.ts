/**
 * Document Embedding Pipeline
 * Orchestrates: Chunking → Embedding → Pinecone Storage
 */

import { createDocumentChunks, getChunkingStats, validateChunks, TextChunk } from "./chunkingService";
import { generateTextEmbedding, generateBatchTextEmbeddings } from "../embeddings";
import { upsertVectors, deleteDocumentVectors, VectorRecord } from "../vectorStore/pinecone";
import { analyzeImage } from "../ai/imageAnalysisService";
import prisma from "../prisma";

export interface EmbeddingProgress {
  documentId: string;
  totalChunks: number;
  processedChunks: number;
  vectorizedChunks: number;
  errors: number;
  status: "processing" | "completed" | "failed";
}

export interface EmbeddingResult {
  success: boolean;
  documentId: string;
  chunkCount: number;
  pineconeIds: string[];
  error?: string;
}

// Batch processing configuration
const BATCH_SIZE = 5; // Process 5 chunks at a time to respect rate limits
const DELAY_BETWEEN_BATCHES = 1000; // 1 second delay between batches

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Process text document through embedding pipeline
 */
export async function processTextDocument(
  documentId: string,
  text: string,
  userId: string,
  fileName: string,
  fileType: string,
  category?: string
): Promise<EmbeddingResult> {
  try {
    console.log(`📄 Processing document: ${fileName} (${documentId})`);

    // Step 1: Chunk the text
    console.log("  Step 1: Chunking text...");
    const chunks = createDocumentChunks(
      text,
      documentId,
      userId,
      fileName,
      fileType,
      category
    );

    if (chunks.length === 0) {
      throw new Error("No chunks created from document");
    }

    // Validate chunks
    const validation = validateChunks(chunks);
    if (!validation.valid) {
      console.warn("  Chunk validation warnings:", validation.warnings);
    }

    const stats = getChunkingStats(chunks);
    console.log(`  Created ${stats.totalChunks} chunks (avg ${stats.avgChunkLength} chars, ~${stats.estimatedTokens} tokens)`);

    // Step 2: Generate embeddings in batches
    console.log("  Step 2: Generating embeddings...");
    const vectors: VectorRecord[] = [];
    let processedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const batchTexts = batch.map((chunk) => chunk.text);

      console.log(`    Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}: Processing ${batch.length} chunks...`);

      // Generate embeddings for batch
      const embeddings = await generateBatchTextEmbeddings(batchTexts);

      // Create vector records
      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j];
        const embedding = embeddings[j];

        if (embedding && embedding.vector) {
          vectors.push({
            id: chunk.id,
            values: embedding.vector,
            metadata: {
              userId: chunk.metadata.userId,
              documentId: chunk.metadata.documentId,
              category: (chunk.metadata.category as "academic" | "career" | "wellness" | "general") || "general",
              chunkText: chunk.text,
              source: "user_upload",
              fileName: chunk.metadata.fileName,
              createdAt: new Date().toISOString(),
            },
          });
          processedCount++;
        } else {
          console.error(`    Failed to generate embedding for chunk ${chunk.id}`);
          errorCount++;
        }
      }

      // Delay between batches to respect rate limits
      if (i + BATCH_SIZE < chunks.length) {
        await sleep(DELAY_BETWEEN_BATCHES);
      }
    }

    console.log(`  Embeddings generated: ${processedCount}/${chunks.length} successful, ${errorCount} errors`);

    if (vectors.length === 0) {
      throw new Error("No embeddings generated successfully");
    }

    // Step 3: Upsert to Pinecone
    console.log("  Step 3: Upserting to Pinecone...");
    const namespace = category || "general";
    const upsertResult = await upsertVectors(vectors, namespace);

    if (!upsertResult.success) {
      throw new Error(`Pinecone upsert failed: ${upsertResult.error}`);
    }

    console.log(`  ✅ Upserted ${upsertResult.upsertedCount} vectors to namespace: ${namespace}`);

    // Step 4: Update database
    const pineconeIds = vectors.map((v) => v.id);
    await prisma.document.update({
      where: { id: documentId },
      data: {
        vectorized: true,
        chunkCount: chunks.length,
        pineconeIds: pineconeIds,
        embeddingError: null,
      },
    });

    console.log(`✅ Document processed successfully: ${fileName}`);

    return {
      success: true,
      documentId,
      chunkCount: chunks.length,
      pineconeIds,
    };
  } catch (error) {
    console.error(`❌ Error processing document ${documentId}:`, error);

    // Update database with error
    await prisma.document.update({
      where: { id: documentId },
      data: {
        vectorized: false,
        embeddingError: error instanceof Error ? error.message : "Unknown error",
      },
    });

    return {
      success: false,
      documentId,
      chunkCount: 0,
      pineconeIds: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Process image document through embedding pipeline
 * Uses Gemini to analyze image, then embeds the description
 */
export async function processImageDocument(
  documentId: string,
  imageBuffer: Buffer,
  userId: string,
  fileName: string,
  fileType: string,
  category?: string
): Promise<EmbeddingResult> {
  try {
    console.log(`🖼️ Processing image: ${fileName} (${documentId})`);

    // Step 1: Analyze image with AI to generate description
    console.log("  Step 1: Analyzing image with AI...");
    const imageBase64 = imageBuffer.toString('base64');
    const analysis = await analyzeImage(imageBase64, fileType);

    if (!analysis || !analysis.description) {
      throw new Error("Failed to analyze image or no description generated");
    }

    console.log(`  Generated description: ${analysis.description.substring(0, 100)}...`);

    // Step 2: Generate embedding for the description
    console.log("  Step 2: Generating embedding for description...");
    const embedding = await generateTextEmbedding(analysis.description);

    if (!embedding) {
      throw new Error("Failed to generate embedding for image description");
    }

    // Step 3: Create vector record
    const vectorId = `${documentId}-image-0`;
    const vector: VectorRecord = {
      id: vectorId,
      values: embedding.vector,
      metadata: {
        userId,
        documentId,
        category: (category as "academic" | "career" | "wellness" | "general") || "general",
        chunkText: analysis.description,
        source: "user_upload",
        fileName,
        createdAt: new Date().toISOString(),
      },
    };

    // Step 4: Upsert to Pinecone
    console.log("  Step 3: Upserting to Pinecone...");
    const namespace = category || "general";
    const upsertResult = await upsertVectors([vector], namespace);

    if (!upsertResult.success) {
      throw new Error(`Pinecone upsert failed: ${upsertResult.error}`);
    }

    console.log(`  ✅ Upserted 1 vector to namespace: ${namespace}`);

    // Step 5: Update database
    await prisma.document.update({
      where: { id: documentId },
      data: {
        vectorized: true,
        chunkCount: 1,
        pineconeIds: [vectorId],
        processedContent: analysis.description, // Store the description
        embeddingError: null,
      },
    });

    console.log(`✅ Image processed successfully: ${fileName}`);

    return {
      success: true,
      documentId,
      chunkCount: 1,
      pineconeIds: [vectorId],
    };
  } catch (error) {
    console.error(`❌ Error processing image ${documentId}:`, error);

    // Update database with error
    await prisma.document.update({
      where: { id: documentId },
      data: {
        vectorized: false,
        embeddingError: error instanceof Error ? error.message : "Unknown error",
      },
    });

    return {
      success: false,
      documentId,
      chunkCount: 0,
      pineconeIds: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Process document based on file type
 */
export async function processDocument(
  documentId: string,
  content: string | Buffer,
  userId: string,
  fileName: string,
  fileType: string,
  category?: string
): Promise<EmbeddingResult> {
  // Determine if content is image or text
  const isImage = fileType.startsWith("image/");

  if (isImage && Buffer.isBuffer(content)) {
    return processImageDocument(
      documentId,
      content,
      userId,
      fileName,
      fileType,
      category
    );
  } else if (typeof content === "string") {
    return processTextDocument(
      documentId,
      content,
      userId,
      fileName,
      fileType,
      category
    );
  } else {
    throw new Error("Invalid content type for document processing");
  }
}

/**
 * Delete document vectors from Pinecone
 */
export async function deleteDocumentEmbeddings(
  documentId: string,
  category?: string
): Promise<boolean> {
  try {
    console.log(`🗑️ Deleting embeddings for document: ${documentId}`);

    // Get document to find pineconeIds
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { pineconeIds: true, category: true },
    });

    if (!document || !document.pineconeIds || document.pineconeIds.length === 0) {
      console.log("  No vectors to delete");
      return true;
    }

    const namespace = category || document.category || "general";

    // Delete from Pinecone using deleteDocumentVectors
    const result = await deleteDocumentVectors(documentId, namespace);

    if (result.success) {
      console.log(`  ✅ Deleted ${document.pineconeIds.length} vectors from Pinecone`);

      // Update database
      await prisma.document.update({
        where: { id: documentId },
        data: {
          vectorized: false,
          pineconeIds: [],
        },
      });

      return true;
    } else {
      console.error(`  ❌ Failed to delete vectors: ${result.error}`);
      return false;
    }
  } catch (error) {
    console.error(`Error deleting embeddings for ${documentId}:`, error);
    return false;
  }
}

/**
 * Re-process document (delete old embeddings and create new ones)
 */
export async function reprocessDocument(
  documentId: string,
  content: string | Buffer,
  userId: string,
  fileName: string,
  fileType: string,
  category?: string
): Promise<EmbeddingResult> {
  console.log(`🔄 Re-processing document: ${documentId}`);

  // Delete old embeddings
  await deleteDocumentEmbeddings(documentId, category);

  // Process document again
  return processDocument(documentId, content, userId, fileName, fileType, category);
}

/**
 * Get embedding progress for a document
 */
export async function getEmbeddingProgress(
  documentId: string
): Promise<EmbeddingProgress | null> {
  try {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        vectorized: true,
        chunkCount: true,
        pineconeIds: true,
        embeddingError: true,
      },
    });

    if (!document) {
      return null;
    }

    const totalChunks = document.chunkCount || 0;
    const vectorizedChunks = document.pineconeIds?.length || 0;
    const hasError = !!document.embeddingError;

    let status: "processing" | "completed" | "failed";
    if (hasError) {
      status = "failed";
    } else if (document.vectorized) {
      status = "completed";
    } else {
      status = "processing";
    }

    return {
      documentId,
      totalChunks,
      processedChunks: vectorizedChunks,
      vectorizedChunks,
      errors: hasError ? 1 : 0,
      status,
    };
  } catch (error) {
    console.error("Error getting embedding progress:", error);
    return null;
  }
}

/**
 * Process multiple documents in batch
 */
export async function processBatchDocuments(
  documents: Array<{
    documentId: string;
    content: string | Buffer;
    userId: string;
    fileName: string;
    fileType: string;
    category?: string;
  }>
): Promise<EmbeddingResult[]> {
  const results: EmbeddingResult[] = [];

  for (const doc of documents) {
    const result = await processDocument(
      doc.documentId,
      doc.content,
      doc.userId,
      doc.fileName,
      doc.fileType,
      doc.category
    );
    results.push(result);

    // Delay between documents
    await sleep(2000);
  }

  return results;
}
