/**
 * Unified Embedding Service
 * 
 * This module provides a unified interface for all embedding services:
 * - Text embeddings via HuggingFace (384 dimensions)
 * - Image embeddings via Replicate CLIP (768 dimensions)
 * 
 * Usage:
 * ```typescript
 * import { generateTextEmbedding, generateImageEmbedding } from '@/lib/embeddings';
 * 
 * const textEmb = await generateTextEmbedding('Hello world');
 * const imageEmb = await generateImageEmbedding('https://example.com/image.jpg');
 * ```
 */

// Re-export all from text embedding service
export {
  generateTextEmbedding,
  generateBatchTextEmbeddings,
  getEmbeddingDimensions,
  isHuggingFaceConfigured,
  type EmbeddingResult,
} from "./textEmbedding";

// Re-export all from CLIP image embedding service
export {
  generateImageEmbedding,
  generateImageEmbeddingWithFallback,
  generateBatchImageEmbeddings,
  getClipDimensions,
  isReplicateConfigured,
  bufferToDataUri,
} from "./clipService";
