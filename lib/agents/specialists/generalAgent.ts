/**
 * General Specialist Agent
 * 
 * Expertise: General questions, concept explanations,
 * university info, tech help, catch-all queries
 * 
 * Also serves as fallback when other agents fail
 */

import {
  BaseAgent,
  StreamEvent,
  UserContext,
  GenerationConfig,
} from './baseAgent';
import { composePrompt, ResponseMode } from '../../ai/promptTemplates';

export class GeneralAgent extends BaseAgent {
  constructor() {
    super('general', 'General Assistant');
  }

  /**
   * Generate general assistance with reasoning stream
   */
  async *generate(
    userMessage: string,
    config: GenerationConfig,
    userContext?: UserContext,
    ragContext?: string | null
  ): AsyncGenerator<StreamEvent> {
    try {
      // Sanitize input
      const sanitizedMessage = this.sanitizeMessage(userMessage);

      // Emit initial reasoning
      yield* this.emitReasoning('🤔 Analyzing query...');

      // Check if RAG context is available
      if (ragContext) {
        yield* this.emitReasoning('📚 Retrieved relevant information');
      }

      // Detect query category
      const category = this.categorizeQuery(sanitizedMessage);
      yield* this.emitReasoning(`📋 Query type: ${category}`, { category });

      // Build context-aware prompt
      yield* this.emitReasoning('✍️ Preparing response...');
      const systemPrompt = this.buildSystemPrompt(config.mode, userContext, ragContext);

      // Stream response tokens
      yield* this.emitReasoning('💬 Generating answer...');
      yield* this.streamResponse(systemPrompt, sanitizedMessage, config);
    } catch (error: any) {
      yield {
        type: 'error',
        content: `General agent error: ${error.message}`,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Build system prompt with general context
   */
  protected buildSystemPrompt(
    mode: ResponseMode,
    userContext?: UserContext,
    ragContext?: string | null
  ): string {
    // Format contexts
    const userContextStr = this.formatUserContext(userContext);
    const ragContextStr = ragContext || '';

    // Use persona prompts with context injection
    return composePrompt('general', mode, userContextStr, ragContextStr);
  }

  /**
   * Categorize general query
   */
  private categorizeQuery(message: string): string {
    const lower = message.toLowerCase();

    // Greeting
    if (/(hello|hi|hey|good morning|good afternoon)/i.test(lower)) {
      return 'greeting';
    }

    // Question
    if (/(what|who|where|when|why|how|can you|could you|would you)/i.test(lower)) {
      return 'question';
    }

    // Information request
    if (/(tell me|explain|describe|info|information)/i.test(lower)) {
      return 'information request';
    }

    // University-specific
    if (/(university|campus|library|dining|parking|registration)/i.test(lower)) {
      return 'university information';
    }

    // Technology help
    if (/(computer|software|app|website|login|password|tech)/i.test(lower)) {
      return 'technical support';
    }

    // Concept explanation
    if (/(concept|theory|principle|understand|clarify)/i.test(lower)) {
      return 'concept explanation';
    }

    return 'general inquiry';
  }

  /**
   * Generate fallback response when other agents fail
   */
  async *generateFallback(
    userMessage: string,
    config: GenerationConfig,
    userContext?: UserContext,
    originalError?: string
  ): AsyncGenerator<StreamEvent> {
    try {
      yield* this.emitReasoning('⚠️ Using fallback response generator');

      if (originalError) {
        yield* this.emitReasoning(`Original error: ${originalError}`);
      }

      // Use general agent with simplified prompt
      yield* this.generate(userMessage, config, userContext, null);
    } catch (error: any) {
      yield {
        type: 'error',
        content: `Fallback generation failed: ${error.message}`,
        timestamp: Date.now(),
      };

      // Last resort: yield a basic apology message
      yield {
        type: 'token',
        content: "I apologize, but I'm having trouble generating a response right now. Please try again in a moment.",
        timestamp: Date.now(),
      };

      yield {
        type: 'done',
        content: '',
        metadata: { fallback: true, error: error.message },
        timestamp: Date.now(),
      };
    }
  }
}
