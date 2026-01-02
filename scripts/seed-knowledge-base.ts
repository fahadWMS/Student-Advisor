import * as fs from "fs";
import * as path from "path";
import { Pinecone } from "@pinecone-database/pinecone";
import { HfInference } from "@huggingface/inference";
import * as dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

// Knowledge entry interface
interface KnowledgeEntry {
  id: string;
  category: "academic" | "career" | "wellness" | "general";
  title: string;
  content: string;
  tags: string[];
  source: "curated";
}

// Chunked entry for embedding
interface ChunkedEntry {
  id: string;
  chunkIndex: number;
  category: string;
  title: string;
  content: string;
  tags: string[];
  source: string;
}

// HuggingFace API configuration
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

if (!HUGGINGFACE_API_KEY) {
  throw new Error("HUGGINGFACE_API_KEY is not set in environment variables");
}

const hf = new HfInference(HUGGINGFACE_API_KEY);

// Token limit for chunking (approx 500 tokens = 2000 characters)
const MAX_CHUNK_CHARS = 2000;

/**
 * Chunk long content into smaller pieces
 */
function chunkContent(entry: KnowledgeEntry): ChunkedEntry[] {
  const chunks: ChunkedEntry[] = [];

  if (entry.content.length <= MAX_CHUNK_CHARS) {
    // No chunking needed
    chunks.push({
      id: entry.id,
      chunkIndex: 0,
      category: entry.category,
      title: entry.title,
      content: entry.content,
      tags: entry.tags,
      source: entry.source,
    });
  } else {
    // Chunk by sentences to avoid breaking mid-sentence
    const sentences = entry.content.match(/[^.!?]+[.!?]+/g) || [entry.content];
    let currentChunk = "";
    let chunkIndex = 0;

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > MAX_CHUNK_CHARS && currentChunk.length > 0) {
        // Save current chunk
        chunks.push({
          id: `${entry.id}-chunk${chunkIndex}`,
          chunkIndex,
          category: entry.category,
          title: entry.title,
          content: currentChunk.trim(),
          tags: entry.tags,
          source: entry.source,
        });
        currentChunk = sentence;
        chunkIndex++;
      } else {
        currentChunk += sentence;
      }
    }

    // Save final chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        id: `${entry.id}-chunk${chunkIndex}`,
        chunkIndex,
        category: entry.category,
        title: entry.title,
        content: currentChunk.trim(),
        tags: entry.tags,
        source: entry.source,
      });
    }
  }

  return chunks;
}

/**
 * Generate embeddings using HuggingFace API
 */
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const result = await hf.featureExtraction({
      model: "sentence-transformers/all-MiniLM-L6-v2",
      inputs: text,
    });

    // The result is already a number array
    return Array.from(result as Float32Array | number[]);
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}

/**
 * Delay function for rate limiting
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Read and parse JSON knowledge files
 */
function loadKnowledgeFiles(): KnowledgeEntry[] {
  const dataDir = path.join(__dirname, "data");
  const files = [
    "academic-knowledge.json",
    "career-knowledge.json",
    "wellness-knowledge.json",
    "general-faq.json",
  ];

  const allEntries: KnowledgeEntry[] = [];

  for (const file of files) {
    const filePath = path.join(dataDir, file);
    console.log(`Loading ${file}...`);

    if (!fs.existsSync(filePath)) {
      console.warn(`Warning: ${file} not found, skipping...`);
      continue;
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");
    const entries: KnowledgeEntry[] = JSON.parse(fileContent);
    allEntries.push(...entries);
    console.log(`  Loaded ${entries.length} entries from ${file}`);
  }

  return allEntries;
}

/**
 * Main seeding function
 */
async function seedKnowledgeBase() {
  console.log("=== Knowledge Base Seeding Started ===\n");

  // 1. Load all knowledge entries
  console.log("Step 1: Loading knowledge files...");
  const entries = loadKnowledgeFiles();
  console.log(`Total entries loaded: ${entries.length}\n`);

  // 2. Chunk entries if needed
  console.log("Step 2: Chunking long entries...");
  const chunks: ChunkedEntry[] = [];
  for (const entry of entries) {
    const entryChunks = chunkContent(entry);
    chunks.push(...entryChunks);
  }
  console.log(`Total chunks created: ${chunks.length}\n`);

  // 3. Initialize Pinecone
  console.log("Step 3: Initializing Pinecone...");
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
  });

  const indexName = process.env.PINECONE_INDEX || "student-consultation";
  const index = pinecone.index(indexName);
  console.log(`Connected to Pinecone index: ${indexName}\n`);

  // 4. Generate embeddings and upsert to Pinecone
  console.log("Step 4: Generating embeddings and upserting to Pinecone...");
  console.log("This may take several minutes...\n");

  const batchSize = 10; // Process in small batches to avoid rate limits
  const delayBetweenBatches = 2000; // 2 seconds between batches

  let successCount = 0;
  let errorCount = 0;

  // Track processed IDs to ensure idempotency
  const processedIds = new Set<string>();

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    console.log(
      `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)} (entries ${i + 1}-${Math.min(i + batchSize, chunks.length)})`
    );

    const vectors: Array<{
      id: string;
      values: number[];
      metadata: Record<string, any>;
    }> = [];

    for (const chunk of batch) {
      try {
        // Skip if already processed (idempotency)
        if (processedIds.has(chunk.id)) {
          console.log(`  Skipping duplicate: ${chunk.id}`);
          continue;
        }

        // Combine title and content for embedding
        const textToEmbed = `${chunk.title}\n\n${chunk.content}`;

        // Generate embedding
        const embedding = await generateEmbedding(textToEmbed);

        // Prepare vector for upsert
        vectors.push({
          id: chunk.id,
          values: embedding,
          metadata: {
            category: chunk.category,
            title: chunk.title,
            content: chunk.content,
            tags: chunk.tags,
            source: chunk.source,
            chunkIndex: chunk.chunkIndex,
          },
        });

        processedIds.add(chunk.id);
        successCount++;

        // Small delay between individual embeddings
        await delay(200);
      } catch (error) {
        console.error(`  Error processing ${chunk.id}:`, error);
        errorCount++;
      }
    }

    // Upsert batch to Pinecone
    if (vectors.length > 0) {
      try {
        // Upsert to general namespace
        await index.namespace("general").upsert(vectors);

        // Also upsert to category-specific namespaces
        const categoryGroups = vectors.reduce((acc, vector) => {
          const category = vector.metadata.category as string;
          if (!acc[category]) acc[category] = [];
          acc[category].push(vector);
          return acc;
        }, {} as Record<string, typeof vectors>);

        for (const [category, categoryVectors] of Object.entries(categoryGroups)) {
          await index.namespace(category).upsert(categoryVectors);
        }

        console.log(`  ✓ Upserted ${vectors.length} vectors to Pinecone\n`);
      } catch (error) {
        console.error(`  Error upserting to Pinecone:`, error);
        errorCount += vectors.length;
      }
    }

    // Delay between batches
    if (i + batchSize < chunks.length) {
      await delay(delayBetweenBatches);
    }
  }

  // 5. Summary
  console.log("\n=== Seeding Complete ===");
  console.log(`Total entries processed: ${chunks.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`\nKnowledge base seeded successfully!`);
  console.log(`\nNamespaces populated:`);
  console.log(`  - general (all entries)`);
  console.log(`  - academic (${entries.filter((e) => e.category === "academic").length} entries)`);
  console.log(`  - career (${entries.filter((e) => e.category === "career").length} entries)`);
  console.log(`  - wellness (${entries.filter((e) => e.category === "wellness").length} entries)`);
  console.log(`  - general (${entries.filter((e) => e.category === "general").length} entries)`);
}

// Run the seeding script
seedKnowledgeBase()
  .then(() => {
    console.log("\n✓ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Script failed:", error);
    process.exit(1);
  });
