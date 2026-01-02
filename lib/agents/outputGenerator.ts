/**
 * Output Generator - Main Orchestrator
 * 
 * Coordinates specialist agents to generate responses with reasoning streams.
 * Handles multi-domain queries, RAG integration, and graceful fallbacks.
 * 
 * Features:
 * - Streams reasoning steps before response tokens
 * - Routes to appropriate specialist based on coordinator decision
 * - Synthesizes multi-domain responses when needed
 * - Integrates RAG context seamlessly
 * - Falls back to general agent on errors
 */

import { CoordinatorDecision } from './types';
import {
  StreamEvent,
  UserContext,
  GenerationConfig,
} from './specialists/baseAgent';
import { AcademicAgent } from './specialists/academicAgent';
import { CareerAgent } from './specialists/careerAgent';
import { WellnessAgent } from './specialists/wellnessAgent';
import { GeneralAgent } from './specialists/generalAgent';
import { PersonaType, ResponseMode } from '../ai/promptTemplates';

// ============================================
// Specialist Agent Registry
// ============================================

const AGENTS = {
  academic: new AcademicAgent(),
  career: new CareerAgent(),
  wellness: new WellnessAgent(),
  general: new GeneralAgent(),
};

// ============================================
// Main Output Generation Function
// ============================================

/**
 * Generate output with reasoning stream
 * 
 * This is the main entry point for generating responses.
 * It streams reasoning steps AND response tokens.
 * 
 * @param decision - Coordinator decision with routing info
 * @param userMessage - Original user message
 * @param ragContext - Retrieved context from RAG (if needed)
 * @param userContext - User profile and conversation history
 * @param voiceMode - Whether to use voice-optimized prompts
 * @returns AsyncGenerator yielding reasoning events and response tokens
 */
export async function* generateWithReasoning(
  decision: CoordinatorDecision,
  userMessage: string,
  ragContext: string | null,
  userContext?: UserContext,
  voiceMode: boolean = false
): AsyncGenerator<StreamEvent> {
  try {
    // Emit pre-generation reasoning
    yield {
      type: 'reasoning',
      content: '🎯 Routing query...',
      metadata: { persona: decision.persona },
      timestamp: Date.now(),
    };

    // Check for multi-persona query (multi intent)
    if (decision.multiPersona) {
      yield {
        type: 'reasoning',
        content: `🔀 Multi-domain query detected: routing to ${decision.persona} specialist`,
        metadata: {
          multiPersona: true,
          persona: decision.persona,
        },
        timestamp: Date.now(),
      };
    }

    // Single-domain query
    yield {
      type: 'reasoning',
      content: `✅ Routing to ${decision.persona} specialist`,
      timestamp: Date.now(),
    };

    // Check RAG context
    if (ragContext) {
      yield {
        type: 'reasoning',
        content: '📄 Incorporating your documents...',
        metadata: { ragContextLength: ragContext.length },
        timestamp: Date.now(),
      };
    }

    // Generate with appropriate specialist
    yield* generateWithSpecialist(
      decision.persona,
      userMessage,
      ragContext,
      userContext,
      voiceMode
    );
  } catch (error: any) {
    console.error('[OutputGenerator] Error:', error);

    // Emit error reasoning
    yield {
      type: 'reasoning',
      content: '⚠️ Error occurred, using fallback generator',
      metadata: { error: error.message },
      timestamp: Date.now(),
    };

    // Fallback to general agent
    const generalAgent = AGENTS.general;
    const config: GenerationConfig = {
      persona: 'general',
      mode: voiceMode ? 'voice' : 'text',
    };

    yield* generalAgent.generateFallback(
      userMessage,
      config,
      userContext,
      error.message
    );
  }
}

/**
 * Generate response using a specific specialist agent
 */
export async function* generateWithSpecialist(
  persona: PersonaType,
  userMessage: string,
  ragContext: string | null,
  userContext?: UserContext,
  voiceMode: boolean = false
): AsyncGenerator<StreamEvent> {
  try {
    // Get specialist agent
    const agent = AGENTS[persona] || AGENTS.general;

    // Build generation config
    const config: GenerationConfig = {
      persona,
      mode: voiceMode ? 'voice' : 'text',
      temperature: voiceMode ? 0.8 : 0.7, // Slightly higher temp for voice
      maxTokens: voiceMode ? 150 : 2000,
    };

    // Generate with specialist
    yield* agent.generate(userMessage, config, userContext, ragContext);
  } catch (error: any) {
    console.error(`[OutputGenerator] Specialist error (${persona}):`, error);

    // Fallback to general agent
    yield {
      type: 'reasoning',
      content: `⚠️ ${persona} specialist failed, using general assistant`,
      timestamp: Date.now(),
    };

    const generalAgent = AGENTS.general;
    const fallbackConfig: GenerationConfig = {
      persona: 'general',
      mode: voiceMode ? 'voice' : 'text',
    };

    yield* generalAgent.generateFallback(
      userMessage,
      fallbackConfig,
      userContext,
      error.message
    );
  }
}



// ============================================
// Utility Functions
// ============================================

/**
 * Get available specialist agents
 */
export function getAvailableAgents(): PersonaType[] {
  return Object.keys(AGENTS) as PersonaType[];
}

/**
 * Get agent display name
 */
export function getAgentDisplayName(persona: PersonaType): string {
  return AGENTS[persona]?.getDisplayName() || 'Unknown Agent';
}

/**
 * Format user context for injection into prompts
 */
export function formatUserContext(userContext?: UserContext): string {
  if (!userContext) return '';

  const parts: string[] = [];

  // Profile
  if (userContext.profile) {
    const { name, major, year, gpa, interests } = userContext.profile;
    if (name) parts.push(`**Name:** ${name}`);
    if (major) parts.push(`**Major:** ${major}`);
    if (year) parts.push(`**Year:** ${year}`);
    if (gpa !== undefined) parts.push(`**GPA:** ${gpa.toFixed(2)}`);
    if (interests && interests.length > 0) {
      parts.push(`**Interests:** ${interests.join(', ')}`);
    }
  }

  // Conversation history (last 3 messages)
  if (userContext.conversationHistory && userContext.conversationHistory.length > 0) {
    parts.push('\n**Recent Conversation:**');
    const recent = userContext.conversationHistory.slice(-3);
    recent.forEach((msg) => {
      const speaker = msg.role === 'user' ? 'Student' : 'AI';
      parts.push(`- ${speaker}: ${msg.content}`);
    });
  }

  return parts.join('\n');
}

/**
 * Format RAG context for injection into prompts
 */
export function formatRagContext(ragContext: string | null): string {
  if (!ragContext) return '';

  return `**Retrieved Information:**

${ragContext}`;
}

// ============================================
// Export Everything
// ============================================

export type {
  StreamEvent,
  UserContext,
  GenerationConfig,
} from './specialists/baseAgent';

export {
  AcademicAgent,
  CareerAgent,
  WellnessAgent,
  GeneralAgent,
};
