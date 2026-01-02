/**
 * Agent Executor - Full Agentic Pipeline
 * 
 * Orchestrates the complete agent flow:
 * 1. Image analysis (if images present) → Gemini
 * 2. Coordinator with reasoning → GROQ
 * 3. RAG retrieval (if needed)
 * 4. Output generation with reasoning → GROQ
 * 
 * Yields both reasoning events and response tokens for UI
 */

import {
  coordinateWithReasoning,
  generateWithReasoning,
  type CoordinatorDecision,
  type ReasoningEvent,
  type UserContext,
  type StreamEvent,
} from './index';
import { analyzeImage } from '../ai/imageAnalysisService';
import { retrieveContext, type RAGContext } from '../ai/ragService';

// ============================================
// Types
// ============================================

/**
 * Combined event type for agent executor
 * Includes coordinator reasoning, generation reasoning, and tokens
 */
export type AgentEvent =
  | { type: 'coordinator-reasoning'; step: string; content: string; timestamp: number }
  | { type: 'coordinator-decision'; decision: CoordinatorDecision; timestamp: number }
  | { type: 'image-analysis'; content: string; timestamp: number }
  | { type: 'rag-search'; queries: string[]; timestamp: number }
  | { type: 'rag-results'; resultCount: number; sources: string[]; timestamp: number }
  | { type: 'generation-reasoning'; content: string; timestamp: number }
  | { type: 'token'; content: string; timestamp: number }
  | { type: 'done'; metadata: AgentExecutionMetadata; timestamp: number }
  | { type: 'error'; content: string; timestamp: number };

/**
 * Metadata about the execution
 */
export interface AgentExecutionMetadata {
  intent?: string;
  persona?: string;
  confidence?: number;
  ragUsed: boolean;
  ragSources: string[];
  modelUsed?: string;
  tokenCount?: number;
  duration: number;
  imageAnalysis?: string;
  reasoningSteps: Array<{ step: string; content: string }>;
}

/**
 * Input for agent execution
 */
export interface AgentExecutionInput {
  userMessage: string;
  userContext?: UserContext;
  voiceMode?: boolean;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  images?: Array<{ data: Buffer | string; mimeType: string }>;
}

// ============================================
// Main Agent Executor
// ============================================

/**
 * Execute full agentic pipeline with reasoning stream
 * 
 * This is the main entry point for the complete agent system.
 * It yields reasoning events AND response tokens.
 */
export async function* executeAgentPipeline(
  input: AgentExecutionInput
): AsyncGenerator<AgentEvent> {
  const startTime = Date.now();
  let decision: CoordinatorDecision | null = null;
  let ragContext: string | null = null;
  let ragSources: string[] = [];
  let imageAnalysisText: string | null = null;
  const reasoningSteps: Array<{ step: string; content: string }> = [];

  try {
    let augmentedMessage = input.userMessage;

    // ============================================
    // Phase 1: Image Analysis (if images present)
    // ============================================

    if (input.images && input.images.length > 0) {
      yield {
        type: 'image-analysis',
        content: `🖼️ Analyzing ${input.images.length} image(s) with Gemini...`,
        timestamp: Date.now(),
      };

      try {
        // Analyze all images with Gemini
        const analyses: string[] = [];

        for (const image of input.images) {
          // Convert Buffer to base64 string if needed
          const imageData = Buffer.isBuffer(image.data)
            ? image.data.toString('base64')
            : image.data;
          const analysis = await analyzeImage(imageData, image.mimeType);
          // Extract description from analysis result
          const description =
            typeof analysis === 'string'
              ? analysis
              : analysis.description || JSON.stringify(analysis);
          analyses.push(description);
        }

        imageAnalysisText = analyses.join('\n\n');

        yield {
          type: 'image-analysis',
          content: `✅ Image analysis complete`,
          timestamp: Date.now(),
        };

        // Augment user message with image analysis for coordinator
        augmentedMessage = `${input.userMessage}\n\n[Image Analysis:\n${imageAnalysisText}]`;
      } catch (error: any) {
        console.error('Image analysis error:', error);
        yield {
          type: 'image-analysis',
          content: `⚠️ Image analysis failed: ${error.message}`,
          timestamp: Date.now(),
        };
        // Continue without image analysis
      }
    }

    // ============================================
    // Phase 2: Coordinator with Reasoning
    // ============================================

    yield {
      type: 'coordinator-reasoning',
      step: 'analyze',
      content: '🔍 Analyzing your query...',
      timestamp: Date.now(),
    };

    for await (const event of coordinateWithReasoning(augmentedMessage, {
      userId: input.userContext?.userId,
      userProfile: input.userContext?.profile,
      conversationHistory: input.conversationHistory,
    })) {
      // Check if this is a decision or reasoning event
      if ('persona' in event) {
        // This is the decision
        decision = event as CoordinatorDecision;

        yield {
          type: 'coordinator-decision',
          decision,
          timestamp: Date.now(),
        };

        yield {
          type: 'coordinator-reasoning',
          step: 'route',
          content: `🎯 Routing to ${decision.persona} specialist (confidence: ${(decision.confidence * 100).toFixed(0)}%)`,
          timestamp: Date.now(),
        };

        reasoningSteps.push({
          step: 'classify',
          content: `Intent: ${decision.intent}, Persona: ${decision.persona}`,
        });
      } else {
        // This is a reasoning event
        const reasoningEvent = event as ReasoningEvent;

        yield {
          type: 'coordinator-reasoning',
          step: reasoningEvent.step,
          content: reasoningEvent.content,
          timestamp: Date.now(),
        };

        reasoningSteps.push({
          step: reasoningEvent.step,
          content: reasoningEvent.content,
        });
      }
    }

    if (!decision) {
      throw new Error('Coordination failed - no decision made');
    }

    // ============================================
    // Phase 3: RAG Retrieval (if needed)
    // ============================================

    // Skip RAG if images were analyzed - image context is sufficient
    const skipRAG = imageAnalysisText !== null;
    
    if (skipRAG && decision.ragNeeded) {
      console.log('[RAG] Skipping RAG search - using image analysis context instead');
      yield {
        type: 'coordinator-reasoning',
        step: 'skip-rag',
        content: '🖼️ Using image analysis context directly (no document search needed)',
        timestamp: Date.now(),
      };
    }
    
    if (decision.ragNeeded && decision.ragQueries.length > 0 && !skipRAG) {
      
      yield {
        type: 'rag-search',
        queries: decision.ragQueries,
        timestamp: Date.now(),
      };

      yield {
        type: 'coordinator-reasoning',
        step: 'search',
        content: `🔎 Searching knowledge base: "${decision.ragQueries[0]}"...`,
        timestamp: Date.now(),
      };

      try {
        // Two-phase search: Phase 1 = user docs only, Phase 2 = add curated if needed
        const namespaces = ['academic', 'career', 'wellness', 'general'];
        let allResults: RAGContext[] = [];
        
        // PHASE 1: Search ONLY user documents with lower threshold
        console.log('[RAG] === PHASE 1: Searching USER documents only ===');
        console.log('[RAG] Queries:', decision.ragQueries);
        console.log('[RAG] User ID:', input.userContext?.userId || 'none');
        
        for (const ns of namespaces) {
          const nsResults = await retrieveContext(
            decision.ragQueries.join(' '),
            {
              topK: 5,
              minScore: 0.20, // Lower threshold for user docs
              namespace: ns,
              userId: input.userContext?.userId,
              source: 'user_upload',
            }
          );
          if (nsResults.length > 0) {
            console.log(`[RAG] Phase 1 - Found ${nsResults.length} USER docs in ${ns}: scores ${nsResults.map(r => r.score.toFixed(2)).join(', ')})`);
          }
          allResults = allResults.concat(nsResults);
        }
        
        console.log(`[RAG] Phase 1 complete: ${allResults.length} user documents found`);
        
        // PHASE 2: Add curated content only if we have fewer than 3 user documents
        if (allResults.length < 3) {
          console.log(`[RAG] === PHASE 2: Adding curated content (only ${allResults.length} user docs found) ===`);
          for (const ns of namespaces) {
            const nsResults = await retrieveContext(
              decision.ragQueries.join(' '),
              {
                topK: 5,
                minScore: 0.35,
                namespace: ns,
                source: 'curated',
              }
            );
            if (nsResults.length > 0) {
              console.log(`[RAG] Phase 2 - Found ${nsResults.length} CURATED docs in ${ns}: scores ${nsResults.map(r => r.score.toFixed(2)).join(', ')}`);
            }
            allResults = allResults.concat(nsResults);
          }
        } else {
          console.log(`[RAG] Phase 2 skipped: ${allResults.length} user documents is sufficient`);
        }
        
        // Sort by score and take top 5
        // Boost user documents: if a user document exists, prioritize it over curated content
        const userDocs = allResults.filter(r => r.source !== 'curated');
        const curatedDocs = allResults.filter(r => r.source === 'curated');
        
        console.log(`[RAG] Before boosting: ${userDocs.length} user docs, ${curatedDocs.length} curated docs`);
        if (userDocs.length > 0) {
          console.log('[RAG] User doc scores:', userDocs.map(d => `${d.source}:${d.score.toFixed(3)}`).join(', '));
        }
        
        let results: RAGContext[];
        if (userDocs.length > 0) {
          // Prioritize user documents FIRST, then add curated if needed
          const sortedUserDocs = userDocs.sort((a, b) => b.score - a.score);
          const sortedCuratedDocs = curatedDocs.sort((a, b) => b.score - a.score);
          results = [...sortedUserDocs, ...sortedCuratedDocs].slice(0, 5);
          console.log('[RAG] ✅ BOOSTED user documents to TOP of results');
          console.log('[RAG] Final order:', results.map(r => `${r.source}:${r.score.toFixed(3)}`).join(' → '));
        } else {
          // No user documents, use all results
          results = allResults
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);
          console.log('[RAG] No user docs found, using curated only');
        }

        console.log('[RAG] Search results:', { 
          query: decision.ragQueries.join(' '),
          resultCount: results.length,
          sources: results.map(r => r.source)
        });

        if (results.length > 0) {
          ragContext = results
            .map((r: RAGContext) => `**${r.source}**\n${r.text}`)
            .join('\n\n---\n\n');

          ragSources = results.map(
            (r: RAGContext) => r.source || 'Unknown'
          );

          console.log('[RAG] Collected sources:', ragSources);

          yield {
            type: 'rag-results',
            resultCount: results.length,
            sources: ragSources,
            timestamp: Date.now(),
          };

          yield {
            type: 'coordinator-reasoning',
            step: 'found',
            content: `📚 Found ${results.length} relevant source(s)`,
            timestamp: Date.now(),
          };

          reasoningSteps.push({
            step: 'rag',
            content: `Retrieved ${results.length} documents`,
          });
        } else {
          yield {
            type: 'coordinator-reasoning',
            step: 'found',
            content: '📭 No relevant documents found in knowledge base',
            timestamp: Date.now(),
          };
        }
      } catch (error: any) {
        console.error('RAG retrieval error:', error);
        yield {
          type: 'coordinator-reasoning',
          step: 'error',
          content: `⚠️ RAG search failed: ${error.message}`,
          timestamp: Date.now(),
        };
        // Continue without RAG context
      }
    }

    // ============================================
    // Phase 4: Output Generation with Reasoning
    // ============================================

    yield {
      type: 'generation-reasoning',
      content: '✍️ Composing personalized response...',
      timestamp: Date.now(),
    };

    let tokenCount = 0;
    let modelUsed: string | undefined;

    // Use augmented message only when we skipped RAG (image-only context)
    // Otherwise use original message with RAG context
    const messageForGeneration = skipRAG ? augmentedMessage : input.userMessage;
    
    for await (const event of generateWithReasoning(
      decision,
      messageForGeneration,
      ragContext,
      input.userContext,
      input.voiceMode || false
    )) {
      switch (event.type) {
        case 'reasoning':
          yield {
            type: 'generation-reasoning',
            content: event.content,
            timestamp: event.timestamp || Date.now(),
          };

          reasoningSteps.push({
            step: 'generate',
            content: event.content,
          });
          break;

        case 'token':
          tokenCount++;
          yield {
            type: 'token',
            content: event.content,
            timestamp: event.timestamp || Date.now(),
          };
          break;

        case 'done':
          modelUsed = event.metadata?.model;
          break;

        case 'error':
          yield {
            type: 'error',
            content: event.content,
            timestamp: event.timestamp || Date.now(),
          };
          break;
      }
    }

    // ============================================
    // Phase 5: Completion
    // ============================================

    const duration = Date.now() - startTime;

    const finalMetadata = {
      intent: decision.intent,
      persona: decision.persona,
      confidence: decision.confidence,
      ragUsed: decision.ragNeeded && ragSources.length > 0,
      ragSources,
      modelUsed,
      tokenCount,
      duration,
      imageAnalysis: imageAnalysisText || undefined,
      reasoningSteps,
    };

    console.log('[Agent] Final metadata:', {
      ragNeeded: decision.ragNeeded,
      ragSourcesCount: ragSources.length,
      ragUsed: finalMetadata.ragUsed,
      ragSources: finalMetadata.ragSources
    });

    yield {
      type: 'done',
      metadata: finalMetadata,
      timestamp: Date.now(),
    };
  } catch (error: any) {
    console.error('[AgentExecutor] Pipeline error:', error);

    yield {
      type: 'error',
      content: error.message || 'Agent pipeline failed',
      timestamp: Date.now(),
    };
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Check if files include images
 */
export function hasImages(files?: Array<{ mimeType: string }>): boolean {
  if (!files || files.length === 0) return false;
  return files.some((f) => f.mimeType.startsWith('image/'));
}

/**
 * Extract images from files
 */
export function extractImages(
  files: Array<{ data: Buffer | string; mimeType: string }>
): Array<{ data: Buffer | string; mimeType: string }> {
  return files.filter((f) => f.mimeType.startsWith('image/'));
}

/**
 * Collect all events into structured result (for testing)
 */
export async function executeAgentPipelineSync(
  input: AgentExecutionInput
): Promise<{
  response: string;
  metadata: AgentExecutionMetadata;
  reasoningLog: Array<{ step: string; content: string }>;
}> {
  let response = '';
  let metadata: AgentExecutionMetadata | null = null;
  const reasoningLog: Array<{ step: string; content: string }> = [];

  for await (const event of executeAgentPipeline(input)) {
    switch (event.type) {
      case 'coordinator-reasoning':
      case 'generation-reasoning':
        reasoningLog.push({ step: event.type, content: event.content });
        break;
      case 'token':
        response += event.content;
        break;
      case 'done':
        metadata = event.metadata;
        break;
      case 'error':
        throw new Error(event.content);
    }
  }

  if (!metadata) {
    throw new Error('Agent pipeline did not complete successfully');
  }

  return { response, metadata, reasoningLog };
}

/**
 * Format reasoning steps for UI display
 */
export function formatReasoningLog(
  log: Array<{ step: string; content: string }>
): string {
  return log.map((entry, i) => `${i + 1}. ${entry.content}`).join('\n');
}

/**
 * Get reasoning step icons
 */
export const REASONING_ICONS: Record<string, string> = {
  analyze: '🔍',
  classify: '📋',
  search: '🔎',
  found: '📚',
  route: '🎯',
  generate: '✍️',
  thinking: '💭',
  action: '⚡',
  observation: '👁️',
  decision: '✅',
};
