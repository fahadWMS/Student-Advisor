/**
 * Document Chunking Service
 * Implements recursive text splitting with overlap for optimal embedding
 */

export interface ChunkMetadata {
  documentId: string;
  userId: string;
  fileName: string;
  fileType: string;
  category?: string;
  chunkIndex: number;
  totalChunks: number;
  startPos: number;
  endPos: number;
}

export interface TextChunk {
  id: string;
  text: string;
  metadata: ChunkMetadata;
}

// Chunking configuration
const CHARS_PER_TOKEN = 4; // Approximate: 1 token ≈ 4 characters
const TARGET_TOKENS = 512;
const OVERLAP_TOKENS = 50;
const TARGET_CHARS = TARGET_TOKENS * CHARS_PER_TOKEN; // ~2048 chars
const OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN; // ~200 chars

// Sentence and paragraph boundaries
const SEPARATORS = [
  "\n\n\n", // Multiple newlines (section breaks)
  "\n\n",   // Paragraph breaks
  "\n",     // Line breaks
  ". ",     // Sentence endings
  "! ",     // Exclamation sentences
  "? ",     // Question sentences
  "; ",     // Semi-colons
  ", ",     // Commas
  " ",      // Words
];

/**
 * Estimate token count from text (approximate)
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Split text at the best separator boundary
 */
function splitAtBoundary(
  text: string,
  targetSize: number,
  separators: string[]
): string[] {
  // If text is small enough, return as-is
  if (text.length <= targetSize) {
    return [text];
  }

  // Try each separator in order of preference
  for (const separator of separators) {
    if (!text.includes(separator)) {
      continue;
    }

    // Split by separator
    const parts = text.split(separator);
    const chunks: string[] = [];
    let currentChunk = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const testChunk =
        currentChunk === ""
          ? part
          : currentChunk + separator + part;

      if (testChunk.length <= targetSize) {
        currentChunk = testChunk;
      } else {
        // Current chunk is full, save it
        if (currentChunk) {
          chunks.push(currentChunk);
        }

        // Start new chunk with current part
        currentChunk = part;
      }
    }

    // Add remaining chunk
    if (currentChunk) {
      chunks.push(currentChunk);
    }

    // If we got meaningful splits, return them
    if (chunks.length > 1) {
      return chunks;
    }
  }

  // Fallback: hard split at target size
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += targetSize) {
    chunks.push(text.slice(i, i + targetSize));
  }

  return chunks;
}

/**
 * Add overlap between chunks for context preservation
 */
function addOverlap(chunks: string[], overlapSize: number): string[] {
  if (chunks.length <= 1) {
    return chunks;
  }

  const overlappedChunks: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    let chunk = chunks[i];

    // Add overlap from previous chunk (suffix)
    if (i > 0 && overlapSize > 0) {
      const prevChunk = chunks[i - 1];
      const overlap = prevChunk.slice(-overlapSize);
      chunk = overlap + chunk;
    }

    overlappedChunks.push(chunk);
  }

  return overlappedChunks;
}

/**
 * Chunk text with recursive splitting and overlap
 */
export function chunkText(
  text: string,
  targetChars: number = TARGET_CHARS,
  overlapChars: number = OVERLAP_CHARS
): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Clean up text
  const cleanedText = text.trim();

  // If text is smaller than target, return as single chunk
  if (cleanedText.length <= targetChars) {
    return [cleanedText];
  }

  // Recursively split at boundaries
  const chunks = splitAtBoundary(cleanedText, targetChars, SEPARATORS);

  // Add overlap between chunks
  const overlappedChunks = addOverlap(chunks, overlapChars);

  // Filter out empty chunks
  return overlappedChunks.filter((chunk) => chunk.trim().length > 0);
}

/**
 * Create chunks with full metadata
 */
export function createDocumentChunks(
  text: string,
  documentId: string,
  userId: string,
  fileName: string,
  fileType: string,
  category?: string
): TextChunk[] {
  const textChunks = chunkText(text);
  const totalChunks = textChunks.length;

  const chunks: TextChunk[] = [];
  let currentPos = 0;

  for (let i = 0; i < textChunks.length; i++) {
    const chunkText = textChunks[i];
    const chunkId = `${documentId}-chunk-${i}`;

    chunks.push({
      id: chunkId,
      text: chunkText,
      metadata: {
        documentId,
        userId,
        fileName,
        fileType,
        category,
        chunkIndex: i,
        totalChunks,
        startPos: currentPos,
        endPos: currentPos + chunkText.length,
      },
    });

    // Update position (without overlap for position tracking)
    currentPos += chunkText.length - OVERLAP_CHARS;
  }

  return chunks;
}

/**
 * Chunk text with custom parameters
 */
export function chunkTextCustom(
  text: string,
  options: {
    targetTokens?: number;
    overlapTokens?: number;
    maxChunks?: number;
  } = {}
): string[] {
  const {
    targetTokens = TARGET_TOKENS,
    overlapTokens = OVERLAP_TOKENS,
    maxChunks,
  } = options;

  const targetChars = targetTokens * CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * CHARS_PER_TOKEN;

  let chunks = chunkText(text, targetChars, overlapChars);

  // Limit number of chunks if specified
  if (maxChunks && chunks.length > maxChunks) {
    console.warn(
      `Document has ${chunks.length} chunks, limiting to ${maxChunks}`
    );
    chunks = chunks.slice(0, maxChunks);
  }

  return chunks;
}

/**
 * Get chunking statistics
 */
export function getChunkingStats(chunks: TextChunk[]): {
  totalChunks: number;
  avgChunkLength: number;
  totalLength: number;
  estimatedTokens: number;
} {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.text.length, 0);
  const avgChunkLength = chunks.length > 0 ? totalLength / chunks.length : 0;
  const estimatedTokens = estimateTokenCount(
    chunks.map((c) => c.text).join("")
  );

  return {
    totalChunks: chunks.length,
    avgChunkLength: Math.round(avgChunkLength),
    totalLength,
    estimatedTokens,
  };
}

/**
 * Validate chunk quality
 */
export function validateChunks(chunks: TextChunk[]): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Check for empty chunks
  const emptyChunks = chunks.filter((c) => c.text.trim().length === 0);
  if (emptyChunks.length > 0) {
    warnings.push(`Found ${emptyChunks.length} empty chunks`);
  }

  // Check for very small chunks
  const smallChunks = chunks.filter((c) => c.text.length < 100);
  if (smallChunks.length > 0) {
    warnings.push(
      `Found ${smallChunks.length} very small chunks (< 100 chars)`
    );
  }

  // Check for very large chunks
  const largeChunks = chunks.filter(
    (c) => estimateTokenCount(c.text) > TARGET_TOKENS * 1.5
  );
  if (largeChunks.length > 0) {
    warnings.push(
      `Found ${largeChunks.length} oversized chunks (> 768 tokens)`
    );
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}
