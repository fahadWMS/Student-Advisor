/**
 * Base Agent Class with Streaming Support
 * 
 * Foundation for all specialist agents with:
 * - Reasoning stream emission
 * - Token streaming from GROQ
 * - Model rotation integration
 * - Context formatting
 * - Error handling with graceful fallback
 */

import { callWithRotationStreaming, GROQ_MODELS_PRIORITY } from '../modelRotation';
import { PersonaType, ResponseMode } from '../../ai/promptTemplates';

// ============================================
// Types
// ============================================

/**
 * Stream event types
 * - reasoning: Pre-generation thinking steps
 * - token: Individual response tokens
 * - done: Stream completion
 * - error: Error during generation
 */
export interface StreamEvent {
  type: 'reasoning' | 'token' | 'done' | 'error';
  content: string;
  metadata?: Record<string, any>;
  timestamp?: number;
}

/**
 * User context for personalization
 */
export interface UserContext {
  userId?: string;
  profile?: {
    name?: string;
    major?: string;
    year?: string;
    gpa?: number;
    interests?: string[];
  };
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  preferences?: {
    voiceMode?: boolean;
    detailLevel?: 'brief' | 'detailed' | 'comprehensive';
  };
}

/**
 * Generation configuration
 */
export interface GenerationConfig {
  persona: PersonaType;
  mode: ResponseMode;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  model?: string; // Override default model
}

// ============================================
// Base Agent Abstract Class
// ============================================

export abstract class BaseAgent {
  protected persona: PersonaType;
  protected displayName: string;

  constructor(persona: PersonaType, displayName: string) {
    this.persona = persona;
    this.displayName = displayName;
  }

  /**
   * Main generation method - must be implemented by specialists
   * Streams reasoning steps and response tokens
   */
  abstract generate(
    userMessage: string,
    config: GenerationConfig,
    userContext?: UserContext,
    ragContext?: string | null
  ): AsyncGenerator<StreamEvent>;

  /**
   * Build system prompt - can be overridden by specialists
   */
  protected abstract buildSystemPrompt(
    mode: ResponseMode,
    userContext?: UserContext,
    ragContext?: string | null
  ): string;

  /**
   * Format user context into readable string
   */
  protected formatUserContext(userContext?: UserContext): string {
    if (!userContext) return '';

    const parts: string[] = [];

    // Profile information
    if (userContext.profile) {
      const { name, major, year, gpa, interests } = userContext.profile;
      if (name) parts.push(`Name: ${name}`);
      if (major) parts.push(`Major: ${major}`);
      if (year) parts.push(`Year: ${year}`);
      if (gpa !== undefined) parts.push(`GPA: ${gpa.toFixed(2)}`);
      if (interests && interests.length > 0) {
        parts.push(`Interests: ${interests.join(', ')}`);
      }
    }

    // Recent conversation context (last 3 messages)
    if (userContext.conversationHistory && userContext.conversationHistory.length > 0) {
      const recent = userContext.conversationHistory.slice(-3);
      parts.push('\nRecent conversation:');
      recent.forEach((msg) => {
        parts.push(`${msg.role === 'user' ? 'Student' : 'AI'}: ${msg.content}`);
      });
    }

    return parts.join('\n');
  }

  /**
   * Emit reasoning event
   */
  protected async *emitReasoning(content: string, metadata?: Record<string, any>): AsyncGenerator<StreamEvent> {
    yield {
      type: 'reasoning',
      content,
      metadata,
      timestamp: Date.now(),
    };
  }

  /**
   * Stream response tokens from GROQ with model rotation
   */
  protected async *streamResponse(
    systemPrompt: string,
    userMessage: string,
    config: GenerationConfig
  ): AsyncGenerator<StreamEvent> {
    try {
      // Choose model (default to primary model)
      const model = config.model || GROQ_MODELS_PRIORITY[0];

      // Build messages array
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: userMessage },
      ];

      // Stream tokens with model rotation fallback
      let tokenCount = 0;
      const startTime = Date.now();
      let usedModel = model;

      for await (const chunk of callWithRotationStreaming(messages, {
        temperature: config.temperature ?? 0.7,
        maxTokens: config.maxTokens ?? (config.mode === 'voice' ? 150 : 2000),
        topP: config.topP ?? 0.9,
      })) {
        tokenCount++;
        usedModel = chunk.model;
        yield {
          type: 'token',
          content: chunk.content,
          metadata: { tokenCount },
          timestamp: Date.now(),
        };
      }

      // Emit completion metadata
      const duration = Date.now() - startTime;
      yield {
        type: 'done',
        content: '',
        metadata: {
          tokenCount,
          duration,
          model: usedModel,
          persona: this.persona,
        },
        timestamp: Date.now(),
      };
    } catch (error: any) {
      console.error(`[${this.displayName}] Generation error:`, error);
      yield {
        type: 'error',
        content: error.message || 'Generation failed',
        metadata: {
          error: error.name,
          persona: this.persona,
        },
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Validate and sanitize user message
   */
  protected sanitizeMessage(message: string): string {
    if (!message || typeof message !== 'string') {
      throw new Error('Invalid message: must be a non-empty string');
    }

    // Trim whitespace
    let sanitized = message.trim();

    // Limit length
    const MAX_LENGTH = 5000;
    if (sanitized.length > MAX_LENGTH) {
      sanitized = sanitized.substring(0, MAX_LENGTH);
    }

    return sanitized;
  }

  /**
   * Get persona type
   */
  getPersona(): PersonaType {
    return this.persona;
  }

  /**
   * Get display name
   */
  getDisplayName(): string {
    return this.displayName;
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Collect all tokens from stream into a single string
 * Useful for testing or non-streaming use cases
 */
export async function collectTokens(stream: AsyncGenerator<StreamEvent>): Promise<{
  fullResponse: string;
  reasoningSteps: string[];
  metadata: Record<string, any>;
}> {
  let fullResponse = '';
  const reasoningSteps: string[] = [];
  let metadata: Record<string, any> = {};

  for await (const event of stream) {
    switch (event.type) {
      case 'reasoning':
        reasoningSteps.push(event.content);
        break;
      case 'token':
        fullResponse += event.content;
        break;
      case 'done':
        if (event.metadata) {
          metadata = { ...metadata, ...event.metadata };
        }
        break;
      case 'error':
        throw new Error(event.content);
    }
  }

  return { fullResponse, reasoningSteps, metadata };
}

/**
 * Format reasoning steps for display
 */
export function formatReasoningSteps(steps: string[]): string {
  if (steps.length === 0) return '';

  return '\n' + steps.map((step, i) => `  ${i + 1}. ${step}`).join('\n') + '\n';
}
