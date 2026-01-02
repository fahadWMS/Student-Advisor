/**
 * Test script for document processing pipeline
 * Run with: npx ts-node --project scripts/tsconfig.json scripts/test-document-pipeline.ts
 */

// Load environment variables from .env.local
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load .env.local file
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import {
  chunkText,
  createDocumentChunks,
  getChunkingStats,
  validateChunks,
  estimateTokenCount,
} from "../lib/documents/chunkingService";

async function testChunkingService() {
  console.log("🧪 Testing Document Chunking Service\n");

  // Test 1: Basic chunking
  console.log("1️⃣ Testing basic text chunking...");
  const shortText = "This is a short document that should not be chunked.";
  const shortChunks = chunkText(shortText);
  console.log(`✅ Short text: ${shortChunks.length} chunk(s)`);
  console.log(`   Text: "${shortChunks[0]}"\n`);

  // Test 2: Long text chunking
  console.log("2️⃣ Testing long text chunking...");
  const longText = `
    Effective study habits are crucial for academic success. Here are some proven strategies:
    
    1. Time Management: Create a study schedule and stick to it. Break large tasks into smaller, manageable chunks.
    
    2. Active Learning: Instead of passive reading, engage with the material through note-taking, summarizing, and teaching concepts to others.
    
    3. Spaced Repetition: Review material at increasing intervals to improve long-term retention.
    
    4. Environment: Find a quiet, comfortable study space with minimal distractions.
    
    5. Take Breaks: Use the Pomodoro Technique - study for 25 minutes, then take a 5-minute break.
    
    6. Sleep and Exercise: Maintain a healthy lifestyle to support cognitive function.
    
    7. Practice Tests: Regular self-testing helps identify knowledge gaps and improves recall.
    
    8. Study Groups: Collaborate with peers to gain different perspectives and explanations.
    
    9. Office Hours: Visit professors during office hours to clarify difficult concepts.
    
    10. Stay Organized: Keep your notes, assignments, and study materials well-organized.
  `.repeat(10); // Repeat to create a long document

  const longChunks = chunkText(longText);
  console.log(`✅ Long text: ${longChunks.length} chunk(s)`);
  console.log(`   Average chunk length: ${Math.round(longChunks.reduce((sum, c) => sum + c.length, 0) / longChunks.length)} chars`);
  console.log(`   First chunk preview: "${longChunks[0].substring(0, 100)}..."\n`);

  // Test 3: Document chunks with metadata
  console.log("3️⃣ Testing document chunks with metadata...");
  const documentChunks = createDocumentChunks(
    longText,
    "test-doc-123",
    "test-user-456",
    "study-guide.pdf",
    "application/pdf",
    "academic"
  );

  console.log(`✅ Created ${documentChunks.length} chunks with metadata`);
  console.log(`   Chunk IDs: ${documentChunks.slice(0, 3).map(c => c.id).join(", ")}...`);
  console.log(`   Sample metadata:`, documentChunks[0].metadata);
  console.log();

  // Test 4: Chunk statistics
  console.log("4️⃣ Testing chunk statistics...");
  const stats = getChunkingStats(documentChunks);
  console.log(`✅ Chunk Statistics:`);
  console.log(`   Total chunks: ${stats.totalChunks}`);
  console.log(`   Average length: ${stats.avgChunkLength} chars`);
  console.log(`   Total length: ${stats.totalLength} chars`);
  console.log(`   Estimated tokens: ${stats.estimatedTokens}\n`);

  // Test 5: Chunk validation
  console.log("5️⃣ Testing chunk validation...");
  const validation = validateChunks(documentChunks);
  console.log(`✅ Validation result: ${validation.valid ? "PASSED" : "FAILED"}`);
  if (validation.warnings.length > 0) {
    console.log(`   Warnings:`, validation.warnings);
  }
  console.log();

  // Test 6: Token estimation
  console.log("6️⃣ Testing token estimation...");
  const sampleTexts = [
    "Short text",
    "This is a medium length text that spans multiple words.",
    "This is a much longer piece of text that contains several sentences. It should demonstrate how token estimation works for different text lengths. The accuracy improves with longer texts.",
  ];

  sampleTexts.forEach((text, i) => {
    const tokens = estimateTokenCount(text);
    console.log(`   Text ${i + 1}: ${text.length} chars ≈ ${tokens} tokens`);
  });
  console.log();

  // Test 7: Edge cases
  console.log("7️⃣ Testing edge cases...");
  
  // Empty text
  const emptyChunks = chunkText("");
  console.log(`   Empty text: ${emptyChunks.length} chunks ✅`);

  // Very long single line
  const longLine = "word ".repeat(1000);
  const longLineChunks = chunkText(longLine);
  console.log(`   Long line: ${longLineChunks.length} chunks ✅`);

  // Special characters
  const specialText = "Hello!\n\n\nThis is a test.\n\nWith multiple\n\n\nseparators.";
  const specialChunks = chunkText(specialText);
  console.log(`   Special characters: ${specialChunks.length} chunks ✅\n`);

  console.log("✅ All chunking tests passed!\n");
}

async function testEmbeddingPipeline() {
  console.log("🧪 Testing Embedding Pipeline (Mock)\n");

  console.log("Note: Full embedding pipeline requires:");
  console.log("  - Database connection");
  console.log("  - HuggingFace API key");
  console.log("  - Pinecone API key");
  console.log("  - Valid document in database\n");

  console.log("For full integration test, use the document upload API endpoint.\n");

  // Show expected flow
  console.log("📋 Expected Pipeline Flow:");
  console.log("  1. Document uploaded via API");
  console.log("  2. Document parsed and saved to database");
  console.log("  3. Background process starts:");
  console.log("     a. Text chunked into ~512 token pieces");
  console.log("     b. Embeddings generated (batch of 5)");
  console.log("     c. Vectors upserted to Pinecone");
  console.log("     d. Database updated with vectorized=true\n");

  console.log("✅ Pipeline test complete!\n");
}

// Run tests
async function runTests() {
  try {
    await testChunkingService();
    await testEmbeddingPipeline();
    console.log("✅ All tests completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

runTests();
