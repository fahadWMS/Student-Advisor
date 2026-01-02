/**
 * Academic Specialist Agent
 * 
 * Expertise: Study strategies, course planning, time management,
 * exam prep, research guidance, academic resources
 */

import {
  BaseAgent,
  StreamEvent,
  UserContext,
  GenerationConfig,
} from './baseAgent';
import { composePrompt, ResponseMode } from '../../ai/promptTemplates';

export class AcademicAgent extends BaseAgent {
  constructor() {
    super('academic', 'Academic Advisor');
  }

  /**
   * Generate academic advice with reasoning stream
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
      yield* this.emitReasoning('🎓 Analyzing academic query...');

      // Check if RAG context is available
      if (ragContext) {
        yield* this.emitReasoning('📚 Retrieved relevant course materials and resources');
      }

      // Check for specific academic patterns
      const patterns = this.detectAcademicPatterns(sanitizedMessage);
      if (patterns.length > 0) {
        yield* this.emitReasoning(
          `📝 Identified focus areas: ${patterns.join(', ')}`,
          { patterns }
        );
      }

      // Build context-aware prompt
      yield* this.emitReasoning('✍️ Composing personalized response...');
      const systemPrompt = this.buildSystemPrompt(config.mode, userContext, ragContext);

      // Stream response tokens
      yield* this.emitReasoning('💬 Generating academic guidance...');
      yield* this.streamResponse(systemPrompt, sanitizedMessage, config);
    } catch (error: any) {
      yield {
        type: 'error',
        content: `Academic agent error: ${error.message}`,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Build system prompt with academic context
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
    return composePrompt('academic', mode, userContextStr, ragContextStr);
  }

  /**
   * Detect specific academic patterns in query
   */
  private detectAcademicPatterns(message: string): string[] {
    const patterns: string[] = [];
    const lower = message.toLowerCase();

    // Study strategies
    if (/(study|learn|memorize|retain|understand)/i.test(lower)) {
      patterns.push('study strategies');
    }

    // Time management
    if (/(time|schedule|manage|balance|deadline)/i.test(lower)) {
      patterns.push('time management');
    }

    // Exam preparation
    if (/(exam|test|quiz|midterm|final)/i.test(lower)) {
      patterns.push('exam preparation');
    }

    // Course planning
    if (/(course|class|major|minor|credits|requirements)/i.test(lower)) {
      patterns.push('course planning');
    }

    // Research guidance
    if (/(research|paper|thesis|dissertation|sources)/i.test(lower)) {
      patterns.push('research guidance');
    }

    // Note-taking
    if (/(notes|note-taking|cornell|summarize)/i.test(lower)) {
      patterns.push('note-taking');
    }

    // GPA/grades
    if (/(gpa|grade|score|performance)/i.test(lower)) {
      patterns.push('academic performance');
    }

    return patterns;
  }
}
