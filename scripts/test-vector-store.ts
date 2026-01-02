/**
 * Test script for vector store operations
 * Run with: npx ts-node --project scripts/tsconfig.json scripts/test-vector-store.ts
 */

// Load environment variables from .env.local
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local file
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import {
  upsertVectors,
  queryVectors,
  deleteVectors,
  getIndexStats,
  VectorRecord,
} from "../lib/vectorStore/pinecone";
import {
  generateTextEmbedding,
  generateBatchTextEmbeddings,
} from "../lib/embeddings";

async function testVectorOperations() {
  console.log("🧪 Testing Vector Store Operations\n");

  try {
    // Test 1: Generate embeddings for sample text
    console.log("1️⃣ Testing text embedding generation...");
    const sampleText = "How do I improve my study habits and time management?";
    const embedding = await generateTextEmbedding(sampleText);

    if (!embedding) {
      throw new Error("Failed to generate embedding");
    }

    console.log(`✅ Generated embedding with ${embedding.dimensions} dimensions`);
    console.log(`   Model: ${embedding.model}\n`);

    // Test 2: Upsert sample vectors
    console.log("2️⃣ Testing vector upsert...");
    const testVectors: VectorRecord[] = [
      {
        id: "test-vector-1",
        values: embedding.vector,
        metadata: {
          category: "academic",
          chunkText: sampleText,
          source: "curated",
          createdAt: new Date().toISOString(),
          userId: "test-user-123",
          documentId: "test-doc-456",
          fileName: "test-document.pdf",
        },
      },
    ];

    const upsertResult = await upsertVectors(testVectors, "general");
    
    if (upsertResult.success) {
      console.log(`✅ Upserted ${upsertResult.upsertedCount} vector(s)\n`);
    } else {
      throw new Error(`Upsert failed: ${upsertResult.error}`);
    }

    // Test 3: Query similar vectors
    console.log("3️⃣ Testing vector query...");
    const queryText = "What are good study techniques?";
    const queryEmbedding = await generateTextEmbedding(queryText);

    if (!queryEmbedding) {
      throw new Error("Failed to generate query embedding");
    }

    const queryResult = await queryVectors(queryEmbedding.vector, {
      topK: 5,
      namespace: "general",
      filter: { category: "academic" },
    });

    if (queryResult.success) {
      console.log(`✅ Found ${queryResult.results.length} similar vectors:`);
      queryResult.results.forEach((result, index) => {
        console.log(`   ${index + 1}. Score: ${result.score.toFixed(4)}`);
        const chunkText = result.metadata?.chunkText || result.metadata?.text || 'N/A';
        const preview = typeof chunkText === 'string' && chunkText.length > 80 
          ? chunkText.substring(0, 80) + '...'
          : chunkText;
        console.log(`      Text: ${preview}`);
        console.log(`      Category: ${result.metadata.category}`);
      });
      console.log();
    } else {
      throw new Error(`Query failed: ${queryResult.error}`);
    }

    // Test 4: Query with different filters
    console.log("4️⃣ Testing query with user filter...");
    const userQueryResult = await queryVectors(queryEmbedding.vector, {
      topK: 3,
      namespace: "general",
      filter: { userId: "test-user-123" },
    });

    if (userQueryResult.success) {
      console.log(`✅ Found ${userQueryResult.results.length} vectors for test user\n`);
    }

    // Test 5: Get index statistics
    console.log("5️⃣ Testing index stats...");
    const statsResult = await getIndexStats();
    
    if (statsResult.success && statsResult.stats) {
      console.log("✅ Index Statistics:");
      console.log(`   Name: ${statsResult.stats.name}`);
      console.log(`   Dimension: ${statsResult.stats.dimension}`);
      console.log(`   Metric: ${statsResult.stats.metric}`);
      console.log(`   Status: ${statsResult.stats.status.state}\n`);
    }

    // Test 6: Batch embedding generation
    console.log("6️⃣ Testing batch embedding generation...");
    const batchTexts = [
      "How to prepare for exams?",
      "Tips for better concentration",
      "Managing academic stress",
    ];

    const batchEmbeddings = await generateBatchTextEmbeddings(batchTexts);
    const successfulEmbeddings = batchEmbeddings.filter((e) => e !== null);
    
    console.log(`✅ Generated ${successfulEmbeddings.length}/${batchTexts.length} batch embeddings\n`);

    // Test 7: Delete test vectors
    console.log("7️⃣ Testing vector deletion...");
    const deleteResult = await deleteVectors(["test-vector-1"], "general");
    
    if (deleteResult.success) {
      console.log(`✅ Deleted ${deleteResult.deletedCount} vector(s)\n`);
    } else {
      throw new Error(`Delete failed: ${deleteResult.error}`);
    }

    console.log("✅ All tests passed successfully!");
    
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

// Run tests
testVectorOperations();
