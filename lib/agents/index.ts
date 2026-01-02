/**
 * Agent System - Central Export
 * Provides unified access to coordinator, tools, and agent utilities
 */

// Export types
export * from "./types";

// Export coordinator
export * from "./coordinator";

// Export tools
export * from "./tools";

// Export utilities
export * from "./contextAssembler";

// Export prompts
export * from "./prompts/coordinatorPrompt";

// Export output generator and specialists
export {
  generateWithReasoning,
  generateWithSpecialist,
  getAvailableAgents,
  getAgentDisplayName,
  formatUserContext,
  formatRagContext,
  AcademicAgent,
  CareerAgent,
  WellnessAgent,
  GeneralAgent,
} from "./outputGenerator";
export type { UserContext, GenerationConfig } from "./outputGenerator";
export { BaseAgent, collectTokens, formatReasoningSteps } from "./specialists/baseAgent";

// Export agent executor
export {
  executeAgentPipeline,
  executeAgentPipelineSync,
  formatReasoningLog,
  hasImages,
  extractImages,
  REASONING_ICONS,
} from "./agentExecutor";
export type {
  AgentEvent,
  AgentExecutionMetadata,
  AgentExecutionInput,
} from "./agentExecutor";

// Re-export specific model rotation functions for convenience
export {
  callWithRotation,
  callWithRotationStreaming,
  GROQ_MODELS_PRIORITY,
  isRateLimitError,
  isRetryableError,
  recommendModel,
  getModelsForTask,
  type GroqModel,
} from "./modelRotation";
