import { HfInference } from "@huggingface/inference";

export interface EmbeddingResult {
  vector: number[];
  dimensions: number;
  model: string;
}

// Embedding model fallback list
const EMBEDDING_MODELS = [
  "sentence-transformers/all-MiniLM-L6-v2", // 384 dims - primary
  "sentence-transformers/all-mpnet-base-v2", // 768 dims - fallback
];

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

// Lazy initialization of HuggingFace client
let hfClient: HfInference | null = null;

/**
 * Get or initialize HuggingFace client
 */
function getHfClient(): HfInference {
  if (!hfClient) {
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    
    if (!apiKey) {
      throw new Error("HUGGINGFACE_API_KEY is not set in environment variables");
    }

    hfClient = new HfInference(apiKey);
  }

  return hfClient;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function getBackoffDelay(attempt: number, initialDelay: number): number {
  return initialDelay * Math.pow(2, attempt);
}

/**
 * Generate text embedding using HuggingFace Inference API
 * @param text - Text to embed
 * @param modelIndex - Index of model to use from EMBEDDING_MODELS array
 */
async function generateEmbeddingWithModel(
  text: string,
  modelIndex: number = 0
): Promise<EmbeddingResult> {
  if (modelIndex >= EMBEDDING_MODELS.length) {
    throw new Error("All embedding models failed");
  }

  const model = EMBEDDING_MODELS[modelIndex];
  const hf = getHfClient();

  try {
    // Use the official HuggingFace Inference library
    const result = await hf.featureExtraction({
      model,
      inputs: text,
    });

    // Handle different response formats
    let vector: number[];
    if (Array.isArray(result) && Array.isArray(result[0])) {
      vector = result[0] as number[]; // Batch response
    } else if (Array.isArray(result)) {
      vector = result as number[];
    } else {
      throw new Error("Unexpected embedding format from HuggingFace");
    }

    // Determine dimensions based on model
    const dimensions = model.includes("all-MiniLM-L6-v2") ? 384 : 768;

    return {
      vector,
      dimensions,
      model,
    };
  } catch (error: any) {
    console.error(`Error with model ${model}:`, error);

    // If model is loading (503), wait and retry same model
    if (error.message && error.message.includes("loading")) {
      console.log(`Model ${model} is loading, retrying in 5s...`);
      await sleep(5000);
      return generateEmbeddingWithModel(text, modelIndex);
    }

    // Try next model in fallback list
    if (modelIndex < EMBEDDING_MODELS.length - 1) {
      console.log(
        `Falling back to model: ${EMBEDDING_MODELS[modelIndex + 1]}`
      );
      return generateEmbeddingWithModel(text, modelIndex + 1);
    }

    throw error;
  }
}

/**
 * Generate text embedding with retry logic and exponential backoff
 * @param text - Text to embed
 * @param attempt - Current retry attempt (internal use)
 */
export async function generateTextEmbedding(
  text: string,
  attempt: number = 0
): Promise<EmbeddingResult | null> {
  try {
    // Validate input
    if (!text || text.trim().length === 0) {
      throw new Error("Text cannot be empty");
    }

    // Truncate text if too long (most models have ~512 token limit)
    const maxLength = 8000; // chars (approx 2000 tokens)
    const truncatedText =
      text.length > maxLength ? text.substring(0, maxLength) : text;

    // Generate embedding
    const result = await generateEmbeddingWithModel(truncatedText);

    return result;
  } catch (error) {
    console.error(
      `Error generating text embedding (attempt ${attempt + 1}/${MAX_RETRIES}):`,
      error
    );

    // Retry with exponential backoff
    if (attempt < MAX_RETRIES - 1) {
      const delay = getBackoffDelay(attempt, INITIAL_RETRY_DELAY);
      console.log(`Retrying in ${delay}ms...`);
      await sleep(delay);
      return generateTextEmbedding(text, attempt + 1);
    }

    // Graceful degradation: return null if all retries fail
    console.error("All retries failed for text embedding, returning null");
    return null;
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * @param texts - Array of texts to embed
 */
export async function generateBatchTextEmbeddings(
  texts: string[]
): Promise<(EmbeddingResult | null)[]> {
  const results: (EmbeddingResult | null)[] = [];

  // Process texts sequentially to avoid rate limiting
  for (const text of texts) {
    const result = await generateTextEmbedding(text);
    results.push(result);

    // Small delay between requests to avoid rate limiting
    if (texts.indexOf(text) < texts.length - 1) {
      await sleep(200);
    }
  }

  return results;
}

/**
 * Get embedding dimensions for the primary model
 */
export function getEmbeddingDimensions(): number {
  return 384; // all-MiniLM-L6-v2 dimensions
}

/**
 * Check if HuggingFace API is configured
 */
export function isHuggingFaceConfigured(): boolean {
  return !!process.env.HUGGINGFACE_API_KEY;
}
