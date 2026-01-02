/**
 * Career Specialist Agent
 * 
 * Expertise: Resume help, interview prep, job search,
 * networking, career planning, internships
 */

import {
  BaseAgent,
  StreamEvent,
  UserContext,
  GenerationConfig,
} from './baseAgent';
import { composePrompt, ResponseMode } from '../../ai/promptTemplates';

export class CareerAgent extends BaseAgent {
  constructor() {
    super('career', 'Career Advisor');
  }

  /**
   * Generate career advice with reasoning stream
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
      yield* this.emitReasoning('💼 Analyzing career query...');

      // Check if RAG context is available
      if (ragContext) {
        yield* this.emitReasoning('📋 Retrieved relevant career resources and opportunities');
      }

      // Detect career focus areas
      const focusAreas = this.detectCareerFocusAreas(sanitizedMessage);
      if (focusAreas.length > 0) {
        yield* this.emitReasoning(
          `🎯 Focus areas: ${focusAreas.join(', ')}`,
          { focusAreas }
        );
      }

      // Check user's career stage
      if (userContext?.profile) {
        const stage = this.inferCareerStage(userContext.profile);
        yield* this.emitReasoning(`👤 Career stage: ${stage}`, { stage });
      }

      // Build context-aware prompt
      yield* this.emitReasoning('✍️ Crafting personalized career guidance...');
      const systemPrompt = this.buildSystemPrompt(config.mode, userContext, ragContext);

      // Stream response tokens
      yield* this.emitReasoning('💬 Generating career advice...');
      yield* this.streamResponse(systemPrompt, sanitizedMessage, config);
    } catch (error: any) {
      yield {
        type: 'error',
        content: `Career agent error: ${error.message}`,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Build system prompt with career context
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
    return composePrompt('career', mode, userContextStr, ragContextStr);
  }

  /**
   * Detect specific career focus areas in query
   */
  private detectCareerFocusAreas(message: string): string[] {
    const focusAreas: string[] = [];
    const lower = message.toLowerCase();

    // Resume
    if (/(resume|cv|curriculum vitae)/i.test(lower)) {
      focusAreas.push('resume/CV');
    }

    // Interview
    if (/(interview|interviewing)/i.test(lower)) {
      focusAreas.push('interview prep');
    }

    // Job search
    if (/(job|position|opening|application|apply)/i.test(lower)) {
      focusAreas.push('job search');
    }

    // Networking
    if (/(network|networking|linkedin|connections)/i.test(lower)) {
      focusAreas.push('networking');
    }

    // Internship
    if (/(intern|internship)/i.test(lower)) {
      focusAreas.push('internship');
    }

    // Career path
    if (/(career path|career planning|future|goal)/i.test(lower)) {
      focusAreas.push('career planning');
    }

    // Skills
    if (/(skill|competenc|qualifications)/i.test(lower)) {
      focusAreas.push('skill development');
    }

    // Salary/compensation
    if (/(salary|compensation|pay|benefits)/i.test(lower)) {
      focusAreas.push('compensation');
    }

    return focusAreas;
  }

  /**
   * Infer career stage from user profile
   */
  private inferCareerStage(profile: UserContext['profile']): string {
    if (!profile) return 'early career';

    const year = profile.year?.toLowerCase() || '';

    if (year.includes('freshman') || year.includes('1')) {
      return 'exploration phase';
    } else if (year.includes('sophomore') || year.includes('2')) {
      return 'skill building phase';
    } else if (year.includes('junior') || year.includes('3')) {
      return 'internship/experience phase';
    } else if (year.includes('senior') || year.includes('4')) {
      return 'job search/transition phase';
    } else if (year.includes('grad')) {
      return 'advanced career planning';
    }

    return 'early career';
  }
}
