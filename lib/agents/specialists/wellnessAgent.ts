/**
 * Wellness Specialist Agent
 * 
 * Expertise: Stress management, breathing exercises,
 * work-life balance, self-care, mental health resources
 */

import {
  BaseAgent,
  StreamEvent,
  UserContext,
  GenerationConfig,
} from './baseAgent';
import { composePrompt, ResponseMode } from '../../ai/promptTemplates';

export class WellnessAgent extends BaseAgent {
  constructor() {
    super('wellness', 'Wellness Coach');
  }

  /**
   * Generate wellness guidance with reasoning stream
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
      yield* this.emitReasoning('🌿 Analyzing wellness query...');

      // Check severity level
      const severityLevel = this.assessSeverityLevel(sanitizedMessage);
      if (severityLevel === 'high') {
        yield* this.emitReasoning(
          '⚠️ High concern detected - will emphasize professional resources',
          { severity: 'high' }
        );
      }

      // Check if RAG context is available
      if (ragContext) {
        yield* this.emitReasoning('📖 Retrieved wellness resources and techniques');
      }

      // Detect wellness focus areas
      const focusAreas = this.detectWellnessFocusAreas(sanitizedMessage);
      if (focusAreas.length > 0) {
        yield* this.emitReasoning(
          `🎯 Wellness areas: ${focusAreas.join(', ')}`,
          { focusAreas }
        );
      }

      // Build context-aware prompt
      yield* this.emitReasoning('✍️ Preparing supportive response...');
      const systemPrompt = this.buildSystemPrompt(config.mode, userContext, ragContext);

      // Stream response tokens
      yield* this.emitReasoning('💬 Sharing wellness guidance...');
      yield* this.streamResponse(systemPrompt, sanitizedMessage, config);
    } catch (error: any) {
      yield {
        type: 'error',
        content: `Wellness agent error: ${error.message}`,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Build system prompt with wellness context
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
    return composePrompt('wellness', mode, userContextStr, ragContextStr);
  }

  /**
   * Detect specific wellness focus areas in query
   */
  private detectWellnessFocusAreas(message: string): string[] {
    const focusAreas: string[] = [];
    const lower = message.toLowerCase();

    // Stress management
    if (/(stress|stressed|overwhelm|anxious|anxiety)/i.test(lower)) {
      focusAreas.push('stress management');
    }

    // Breathing/relaxation
    if (/(breath|breathing|relax|calm|meditation)/i.test(lower)) {
      focusAreas.push('relaxation techniques');
    }

    // Work-life balance
    if (/(balance|work-life|burnout)/i.test(lower)) {
      focusAreas.push('work-life balance');
    }

    // Sleep
    if (/(sleep|insomnia|tired|fatigue)/i.test(lower)) {
      focusAreas.push('sleep hygiene');
    }

    // Self-care
    if (/(self-care|self care|wellbeing|wellness)/i.test(lower)) {
      focusAreas.push('self-care');
    }

    // Social connections
    if (/(lonely|isolation|friends|social)/i.test(lower)) {
      focusAreas.push('social connections');
    }

    // Mental health
    if (/(depression|depressed|mental health|counseling|therapy)/i.test(lower)) {
      focusAreas.push('mental health support');
    }

    return focusAreas;
  }

  /**
   * Assess severity level of wellness concern
   */
  private assessSeverityLevel(message: string): 'low' | 'medium' | 'high' {
    const lower = message.toLowerCase();

    // High severity keywords
    const highSeverityKeywords = [
      'suicid',
      'harm',
      'hurt myself',
      'end it',
      'can\'t go on',
      'hopeless',
      'severe',
      'crisis',
    ];

    // Medium severity keywords
    const mediumSeverityKeywords = [
      'depression',
      'depressed',
      'anxious',
      'panic',
      'can\'t cope',
      'overwhelmed',
      'breakdown',
    ];

    // Check for high severity
    for (const keyword of highSeverityKeywords) {
      if (lower.includes(keyword)) {
        return 'high';
      }
    }

    // Check for medium severity
    for (const keyword of mediumSeverityKeywords) {
      if (lower.includes(keyword)) {
        return 'medium';
      }
    }

    return 'low';
  }
}
