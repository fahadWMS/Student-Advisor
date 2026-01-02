/**
 * Model Rotation Logic
 * Handles GROQ model fallback on rate limits
 */

import Groq from "groq-sdk";

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
  responseFormat?: { type: "json_object" } | { type: "text" };
}

/**
 * GROQ models in priority order
 * Ordered by quality and capability
 */
export const GROQ_MODELS_PRIORITY = [
  "llama-3.3-70b-versatile", // Primary - best quality, latest model
  "llama-3.1-70b-versatile", // Fallback 1 - still excellent
  "llama-3.1-8b-instant", // Fallback 2 - fastest, most available
  "mixtral-8x7b-32768", // Fallback 3 - good for long context
  "gemma2-9b-it", // Last resort - lightweight
] as const;

export type GroqModel = (typeof GROQ_MODELS_PRIORITY)[number];

/**
 * Model capabilities and characteristics
 */
export const MODEL_CHARACTERISTICS: Record<
  GroqModel,
  {
    maxTokens: number;
    speed: "fast" | "medium" | "slow";
    quality: "excellent" | "good" | "fair";
    bestFor: string[];
  }
> = {
  "llama-3.3-70b-versatile": {
    maxTokens: 8192,
    speed: "medium",
    quality: "excellent",
    bestFor: ["reasoning", "analysis", "complex queries"],
  },
  "llama-3.1-70b-versatile": {
    maxTokens: 8192,
    speed: "medium",
    quality: "excellent",
    bestFor: ["reasoning", "classification", "general"],
  },
  "llama-3.1-8b-instant": {
    maxTokens: 8192,
    speed: "fast",
    quality: "good",
    bestFor: ["classification", "simple queries", "speed"],
  },
  "mixtral-8x7b-32768": {
    maxTokens: 32768,
    speed: "medium",
    quality: "good",
    bestFor: ["long context", "document analysis"],
  },
  "gemma2-9b-it": {
    maxTokens: 8192,
    speed: "fast",
    quality: "fair",
    bestFor: ["fallback", "simple tasks"],
  },
};

/**
 * Initialize GROQ client
 */
let groqClient: Groq | null = null;

function getGroqClient(): Groq {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY environment variable not set");
    }
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

/**
 * Check if error is a rate limit error
 */
export function isRateLimitError(error: any): boolean {
  if (!error) return false;

  // Check for common rate limit indicators
  const message = error.message?.toLowerCase() || "";
  const status = error.status || error.statusCode;

  return (
    status === 429 ||
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    message.includes("quota exceeded") ||
    error.code === "rate_limit_exceeded"
  );
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: any): boolean {
  if (!error) return false;

  const status = error.status || error.statusCode;
  const message = error.message?.toLowerCase() || "";

  return (
    isRateLimitError(error) ||
    status === 503 ||
    status === 500 ||
    message.includes("timeout") ||
    message.includes("network")
  );
}

/**
 * Parse retry-after header
 */
function parseRetryAfter(error: any): number | undefined {
  try {
    const retryAfter = error.headers?.["retry-after"];
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      return isNaN(seconds) ? undefined : seconds;
    }
  } catch (e) {
    // Ignore parsing errors
  }
  return undefined;
}

/**
 * Call GROQ with a specific model
 */
export async function callGroq(
  model: GroqModel,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  options: LLMOptions = {}
): Promise<string> {
  const client = getGroqClient();

  const {
    temperature = 0.7,
    maxTokens = 2048,
    topP = 1.0,
    stopSequences = [],
    responseFormat,
  } = options;

  try {
    console.log(`🤖 Calling GROQ: ${model}`);

    const completion = await client.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      top_p: topP,
      stop: stopSequences.length > 0 ? stopSequences : undefined,
      response_format: responseFormat,
      stream: false,
    });

    const content = completion.choices[0]?.message?.content || "";

    console.log(`✅ GROQ response: ${content.length} chars`);

    return content;
  } catch (error: any) {
    console.error(`❌ GROQ error on ${model}:`, error.message);

    // Add model info to error
    if (error) {
      error.model = model;
      error.retryAfter = parseRetryAfter(error);
    }

    throw error;
  }
}

/**
 * Call GROQ with streaming
 */
export async function* callGroqStreaming(
  model: GroqModel,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  options: LLMOptions = {}
): AsyncGenerator<string> {
  const client = getGroqClient();

  const {
    temperature = 0.7,
    maxTokens = 2048,
    topP = 1.0,
    stopSequences = [],
  } = options;

  try {
    console.log(`🤖 Streaming GROQ: ${model}`);

    const stream = await client.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      top_p: topP,
      stop: stopSequences.length > 0 ? stopSequences : undefined,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }

    console.log(`✅ GROQ streaming complete`);
  } catch (error: any) {
    console.error(`❌ GROQ streaming error on ${model}:`, error.message);

    if (error) {
      error.model = model;
      error.retryAfter = parseRetryAfter(error);
    }

    throw error;
  }
}

/**
 * Call GROQ with automatic model rotation on rate limits
 */
export async function callWithRotation(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  options: LLMOptions = {},
  modelsToTry: readonly GroqModel[] = GROQ_MODELS_PRIORITY
): Promise<{ content: string; model: GroqModel }> {
  let lastError: any;

  for (let i = 0; i < modelsToTry.length; i++) {
    const model = modelsToTry[i];

    try {
      const content = await callGroq(model, messages, options);
      return { content, model };
    } catch (error: any) {
      lastError = error;

      if (isRateLimitError(error)) {
        console.log(`⚠️  Rate limited on ${model}, trying next model...`);

        // Wait a bit before trying next model
        if (error.retryAfter) {
          console.log(`   Retry after: ${error.retryAfter}s`);
        }

        // If this is not the last model, continue to next
        if (i < modelsToTry.length - 1) {
          // Small delay before trying next model
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }
      } else {
        // Non-rate-limit error, throw immediately
        console.error(`❌ Non-retryable error on ${model}:`, error.message);
        throw error;
      }
    }
  }

  // All models failed with rate limits
  throw new Error(
    `All GROQ models rate limited. Tried: ${modelsToTry.join(", ")}. Last error: ${lastError?.message || "Unknown"}`
  );
}

/**
 * Call GROQ with streaming and automatic rotation
 */
export async function* callWithRotationStreaming(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  options: LLMOptions = {},
  modelsToTry: readonly GroqModel[] = GROQ_MODELS_PRIORITY
): AsyncGenerator<{ content: string; model: GroqModel }> {
  let lastError: any;

  for (let i = 0; i < modelsToTry.length; i++) {
    const model = modelsToTry[i];

    try {
      let isFirstChunk = true;

      for await (const content of callGroqStreaming(model, messages, options)) {
        if (isFirstChunk) {
          console.log(`✅ Streaming from ${model}`);
          isFirstChunk = false;
        }
        yield { content, model };
      }

      return; // Successfully completed
    } catch (error: any) {
      lastError = error;

      if (isRateLimitError(error)) {
        console.log(`⚠️  Rate limited on ${model} (streaming), trying next model...`);

        if (i < modelsToTry.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }
      } else {
        console.error(`❌ Non-retryable streaming error on ${model}:`, error.message);
        throw error;
      }
    }
  }

  throw new Error(
    `All GROQ models rate limited (streaming). Tried: ${modelsToTry.join(", ")}`
  );
}

/**
 * Recommend best model for a specific task
 */
export function recommendModel(task: "classification" | "reasoning" | "long-context" | "speed"): GroqModel {
  switch (task) {
    case "classification":
      return "llama-3.1-8b-instant"; // Fast and good enough
    case "reasoning":
      return "llama-3.3-70b-versatile"; // Best quality
    case "long-context":
      return "mixtral-8x7b-32768"; // Largest context
    case "speed":
      return "llama-3.1-8b-instant"; // Fastest
    default:
      return "llama-3.3-70b-versatile"; // Default to best quality
  }
}

/**
 * Get subset of models for specific use case
 */
export function getModelsForTask(task: "classification" | "reasoning" | "fallback"): readonly GroqModel[] {
  switch (task) {
    case "classification":
      return ["llama-3.1-8b-instant", "llama-3.3-70b-versatile", "gemma2-9b-it"];
    case "reasoning":
      return ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile", "mixtral-8x7b-32768"];
    case "fallback":
      return ["llama-3.1-8b-instant", "gemma2-9b-it"];
    default:
      return GROQ_MODELS_PRIORITY;
  }
}
