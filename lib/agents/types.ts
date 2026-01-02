/**
 * Agent System Type Definitions
 * Defines types for coordinator, reasoning, and agent orchestration
 */

import { PersonaType } from "./tools/types";

/**
 * Reasoning event types for streaming to UI
 */
export type ReasoningEventType = "thinking" | "action" | "observation" | "decision";

/**
 * Reasoning event streamed during coordination
 */
export interface ReasoningEvent {
  type: ReasoningEventType;
  step: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * Intent classification types
 */
export type IntentType = 
  | "academic"
  | "career"
  | "wellness"
  | "general"
  | "multi"
  | "greeting"
  | "clarification";

/**
 * Coordinator decision for routing
 */
export interface CoordinatorDecision {
  /** Main intent classification */
  intent: IntentType;
  
  /** Persona to route to */
  persona: PersonaType;
  
  /** Confidence score (0-1) */
  confidence: number;
  
  /** Whether RAG retrieval is needed */
  ragNeeded: boolean;
  
  /** Specific queries for RAG search */
  ragQueries: string[];
  
  /** Brief reasoning explanation */
  reasoning: string;
  
  /** Internal thinking process */
  thinking?: string;
  
  /** Detected entities/topics */
  entities?: string[];
  
  /** Suggested follow-up questions */
  followUp?: string[];
  
  /** Whether to use multiple personas */
  multiPersona?: boolean;
}

/**
 * Result from coordinator with reasoning trace
 */
export interface CoordinatorResult {
  decision: CoordinatorDecision;
  reasoning: ReasoningEvent[];
  latency: number;
  model?: string;
}

/**
 * Context for coordination
 */
export interface CoordinationContext {
  userId?: string;
  conversationId?: string;
  conversationHistory?: Array<{
    role: "user" | "assistant";
    content: string;
    timestamp?: string;
  }>;
  userProfile?: {
    major?: string;
    year?: string;
    interests?: string[];
    gpa?: number;
  };
  previousDecisions?: CoordinatorDecision[];
  metadata?: Record<string, any>;
}

/**
 * Agent execution context
 */
export interface AgentContext {
  userId?: string;
  conversationId?: string;
  persona: PersonaType;
  decision: CoordinatorDecision;
  ragContext?: {
    chunks: Array<{
      text: string;
      score: number;
      source: string;
      metadata?: Record<string, any>;
    }>;
    searchTime?: number;
  };
  conversationHistory?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * Agent response with metadata
 */
export interface AgentResponse {
  content: string;
  persona: PersonaType;
  citations?: Array<{
    text: string;
    source: string;
  }>;
  suggestions?: string[];
  metadata?: {
    tokensUsed?: number;
    latency?: number;
    model?: string;
    confidence?: number;
  };
}

/**
 * Stream event types
 */
export type StreamEventType = 
  | "reasoning"
  | "token"
  | "decision"
  | "rag_search"
  | "tool_call"
  | "complete"
  | "error";

/**
 * Server-sent event for streaming
 */
export interface StreamEvent {
  type: StreamEventType;
  data: any;
  timestamp: number;
}

/**
 * Model configuration
 */
export interface ModelConfig {
  provider: "groq" | "openai" | "anthropic";
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
}

/**
 * LLM call options
 */
export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  stopSequences?: string[];
  responseFormat?: {
    type: "json_object" | "text";
  };
}

/**
 * Rate limit error type
 */
export interface RateLimitError extends Error {
  name: "RateLimitError";
  retryAfter?: number;
  model?: string;
}

/**
 * Classification result
 */
export interface ClassificationResult {
  intent: IntentType;
  persona: PersonaType;
  confidence: number;
  ragNeeded: boolean;
  ragQueries: string[];
  reasoning: string;
  thinking?: string;
  entities?: string[];
  multiPersona?: boolean;
}

/**
 * RAG search options
 */
export interface RagSearchOptions {
  query: string;
  userId?: string;
  namespace?: string;
  topK?: number;
  minScore?: number;
  includeUserDocs?: boolean;
}

/**
 * Tool execution request
 */
export interface ToolExecutionRequest {
  toolName: string;
  parameters: Record<string, any>;
  context: {
    userId?: string;
    conversationId?: string;
    persona?: PersonaType;
    timestamp: string;
  };
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  success: boolean;
  toolName: string;
  data?: any;
  error?: string;
  latency: number;
  metadata?: Record<string, any>;
}
