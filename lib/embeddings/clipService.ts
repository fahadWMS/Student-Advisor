import Replicate from "replicate";
import { EmbeddingResult } from "./textEmbedding";

// CLIP model configuration
const CLIP_MODEL = "daanelson/clip-vit-large-patch14:latest";
const CLIP_DIMENSIONS = 768;

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

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
 * Get or initialize Replicate client
 */
function getReplicateClient(): Replicate {
  const apiToken = process.env.REPLICATE_API_TOKEN;

  if (!apiToken) {
    throw new Error("REPLICATE_API_TOKEN is not set in environment variables");
  }

  return new Replicate({ auth: apiToken });
}

/**
 * Generate CLIP embedding for an image
 * @param imageUrl - URL or base64 data URI of the image
 * @param attempt - Current retry attempt (internal use)
 */
export async function generateImageEmbedding(
  imageUrl: string,
  attempt: number = 0
): Promise<EmbeddingResult | null> {
  try {
    // Validate input
    if (!imageUrl || imageUrl.trim().length === 0) {
      throw new Error("Image URL cannot be empty");
    }

    const replicate = getReplicateClient();

    // Run CLIP model
    const output = await replicate.run(CLIP_MODEL, {
      input: {
        image: imageUrl,
      },
    }) as any;

    // Extract embedding from output
    let vector: number[];
    
    if (Array.isArray(output)) {
      vector = output;
    } else if (output.embedding && Array.isArray(output.embedding)) {
      vector = output.embedding;
    } else if (typeof output === "object" && output.data) {
      vector = output.data;
    } else {
      throw new Error("Unexpected output format from CLIP model");
    }

    // Validate dimensions
    if (vector.length !== CLIP_DIMENSIONS) {
      console.warn(
        `Unexpected CLIP dimensions: ${vector.length}, expected ${CLIP_DIMENSIONS}`
      );
    }

    return {
      vector,
      dimensions: vector.length,
      model: CLIP_MODEL,
    };
  } catch (error) {
    console.error(
      `Error generating image embedding (attempt ${attempt + 1}/${MAX_RETRIES}):`,
      error
    );

    // Retry with exponential backoff
    if (attempt < MAX_RETRIES - 1) {
      const delay = getBackoffDelay(attempt, INITIAL_RETRY_DELAY);
      console.log(`Retrying in ${delay}ms...`);
      await sleep(delay);
      return generateImageEmbedding(imageUrl, attempt + 1);
    }

    // Graceful degradation: return null if all retries fail
    console.error("All retries failed for image embedding, returning null");
    return null;
  }
}

/**
 * Generate CLIP embedding for an image with text fallback
 * If CLIP fails, falls back to generating text embedding from image description
 * @param imageUrl - URL or base64 data URI of the image
 * @param textDescription - Optional text description of the image for fallback
 */
export async function generateImageEmbeddingWithFallback(
  imageUrl: string,
  textDescription?: string
): Promise<EmbeddingResult | null> {
  try {
    // Try CLIP embedding first
    const clipResult = await generateImageEmbedding(imageUrl);

    if (clipResult) {
      return clipResult;
    }

    // Fallback to text embedding if CLIP fails and description provided
    if (textDescription) {
      console.log("CLIP failed, falling back to text embedding");
      
      // Dynamically import to avoid circular dependency
      const { generateTextEmbedding } = await import("./textEmbedding");
      const textResult = await generateTextEmbedding(textDescription);

      if (textResult) {
        return {
          ...textResult,
          model: `${textResult.model} (fallback from CLIP)`,
        };
      }
    }

    return null;
  } catch (error) {
    console.error("Error in generateImageEmbeddingWithFallback:", error);
    return null;
  }
}

/**
 * Generate embeddings for multiple images in batch
 * @param imageUrls - Array of image URLs
 */
export async function generateBatchImageEmbeddings(
  imageUrls: string[]
): Promise<(EmbeddingResult | null)[]> {
  const results: (EmbeddingResult | null)[] = [];

  // Process images sequentially to avoid rate limiting
  for (const imageUrl of imageUrls) {
    const result = await generateImageEmbedding(imageUrl);
    results.push(result);

    // Delay between requests to avoid rate limiting
    if (imageUrls.indexOf(imageUrl) < imageUrls.length - 1) {
      await sleep(500); // Slightly longer delay for image processing
    }
  }

  return results;
}

/**
 * Get CLIP embedding dimensions
 */
export function getClipDimensions(): number {
  return CLIP_DIMENSIONS;
}

/**
 * Check if Replicate API is configured
 */
export function isReplicateConfigured(): boolean {
  return !!process.env.REPLICATE_API_TOKEN;
}

/**
 * Extract image from file buffer and convert to base64 data URI
 * @param buffer - Image file buffer
 * @param mimeType - MIME type of the image (e.g., 'image/jpeg')
 */
export function bufferToDataUri(buffer: Buffer, mimeType: string): string {
  const base64 = buffer.toString("base64");
  return `data:${mimeType};base64,${base64}`;
}
