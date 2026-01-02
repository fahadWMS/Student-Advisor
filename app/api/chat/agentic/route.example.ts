/**
 * Full Agentic Chat API Route
 * Demonstrates complete integration:
 * 1. Coordinator (with reasoning)
 * 2. RAG retrieval (if needed)
 * 3. Output generation (with reasoning)
 * 
 * All streamed via Server-Sent Events (SSE)
 */

import { NextRequest } from 'next/server';
import {
  coordinateWithReasoning,
  generateWithReasoning,
  type CoordinatorDecision,
  type UserContext,
  type StreamEvent,
  type ReasoningEvent,
} from '@/lib/agents';

// Note: Import your actual RAG service
// import { retrieveFromRAG } from '@/lib/ai/ragService';

// Mock RAG function for this example
async function retrieveFromRAG(queries: string[], options?: any): Promise<any[]> {
  // Replace with actual RAG implementation
  return [];
}

/**
 * POST /api/chat/agentic
 * 
 * Request body:
 * {
 *   message: string;
 *   userId?: string;
 *   voiceMode?: boolean;
 *   context?: {
 *     profile?: { major?: string, year?: string, gpa?: number };
 *     conversationHistory?: Array<{role: "user" | "assistant", content: string}>;
 *   };
 * }
 * 
 * Response: Server-Sent Events (SSE)
 * - event: coordinator-reasoning - Coordinator thinking steps
 * - event: coordinator-decision - Routing decision
 * - event: rag-status - RAG retrieval status
 * - event: generation-reasoning - Output generator reasoning
 * - event: token - Response tokens
 * - event: done - Stream complete
 * - event: error - Error occurred
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, userId, voiceMode = false, context } = body;

    // Validate message
    if (!message || typeof message !== 'string') {
      return Response.json({ error: 'Message is required' }, { status: 400 });
    }

    // Build user context
    const userContext: UserContext = {
      userId,
      profile: context?.profile,
      conversationHistory: context?.conversationHistory,
      preferences: { voiceMode },
    };

    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          // ============================================
          // Phase 1: Coordination with Reasoning Stream
          // ============================================

          let decision: CoordinatorDecision | null = null;

          for await (const event of coordinateWithReasoning(message, {
            userId,
            userProfile: context?.profile,
            conversationHistory: context?.conversationHistory,
          })) {
            // Check if this is a decision event (has 'persona' field)
            if ('persona' in event) {
              decision = event as CoordinatorDecision;

              // Send decision to client
              controller.enqueue(
                encoder.encode(
                  `event: coordinator-decision\ndata: ${JSON.stringify({
                    persona: decision.persona,
                    confidence: decision.confidence,
                    ragNeeded: decision.ragNeeded,
                    reasoning: decision.reasoning,
                  })}\n\n`
                )
              );
            } else {
              // This is a reasoning event
              const reasoningEvent = event as ReasoningEvent;
              controller.enqueue(
                encoder.encode(
                  `event: coordinator-reasoning\ndata: ${JSON.stringify({
                    step: reasoningEvent.step,
                    content: reasoningEvent.content,
                  })}\n\n`
                )
              );
            }
          }

          if (!decision) {
            throw new Error('Coordination failed - no decision made');
          }

          // ============================================
          // Phase 2: RAG Retrieval (if needed)
          // ============================================

          let ragContext: string | null = null;

          if (decision.ragNeeded && decision.ragQueries.length > 0) {
            controller.enqueue(
              encoder.encode(
                `event: rag-status\ndata: ${JSON.stringify({
                  status: 'retrieving',
                  queries: decision.ragQueries,
                })}\n\n`
              )
            );

            try {
              // Retrieve from vector store
              const results = await retrieveFromRAG(decision.ragQueries, {
                topK: 5,
                minScore: 0.7,
              });

              ragContext = results
                .map((r: any) => `${r.metadata?.title || 'Document'}:\n${r.content}`)
                .join('\n\n---\n\n');

              controller.enqueue(
                encoder.encode(
                  `event: rag-status\ndata: ${JSON.stringify({
                    status: 'complete',
                    resultCount: results.length,
                    contextLength: ragContext?.length || 0,
                  })}\n\n`
                )
              );
            } catch (error: any) {
              console.error('RAG retrieval error:', error);
              controller.enqueue(
                encoder.encode(
                  `event: rag-status\ndata: ${JSON.stringify({
                    status: 'failed',
                    error: error.message,
                  })}\n\n`
                )
              );
              // Continue without RAG context
              ragContext = null;
            }
          }

          // ============================================
          // Phase 3: Output Generation with Reasoning
          // ============================================

          for await (const event of generateWithReasoning(
            decision,
            message,
            ragContext,
            userContext,
            voiceMode
          )) {
            switch (event.type) {
              case 'reasoning':
                // Send generation reasoning to client
                controller.enqueue(
                  encoder.encode(
                    `event: generation-reasoning\ndata: ${JSON.stringify({
                      content: event.content,
                      metadata: event.metadata,
                    })}\n\n`
                  )
                );
                break;

              case 'token':
                // Send response token to client
                controller.enqueue(
                  encoder.encode(
                    `event: token\ndata: ${JSON.stringify({
                      content: event.content,
                    })}\n\n`
                  )
                );
                break;

              case 'done':
                // Send completion metadata
                controller.enqueue(
                  encoder.encode(
                    `event: done\ndata: ${JSON.stringify({
                      metadata: event.metadata,
                    })}\n\n`
                  )
                );
                break;

              case 'error':
                // Send error to client
                controller.enqueue(
                  encoder.encode(
                    `event: error\ndata: ${JSON.stringify({
                      error: event.content,
                    })}\n\n`
                  )
                );
                break;
            }
          }

          // Close stream
          controller.close();
        } catch (error: any) {
          console.error('Agentic chat error:', error);

          // Send error event
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({
                error: error.message || 'Unknown error',
              })}\n\n`
            )
          );

          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  } catch (error: any) {
    console.error('API error:', error);
    return Response.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Frontend Usage Example
 * 
 * ```typescript
 * async function sendAgenticMessage(message: string) {
 *   const response = await fetch('/api/chat/agentic', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({
 *       message,
 *       userId: user.id,
 *       voiceMode: false,
 *       context: {
 *         profile: {
 *           major: user.major,
 *           year: user.year,
 *           gpa: user.gpa,
 *         },
 *         conversationHistory: recentMessages.slice(-3),
 *       },
 *     }),
 *   });
 * 
 *   const reader = response.body!.getReader();
 *   const decoder = new TextDecoder();
 * 
 *   while (true) {
 *     const { done, value } = await reader.read();
 *     if (done) break;
 * 
 *     const chunk = decoder.decode(value);
 *     const events = chunk.split('\n\n').filter(e => e.trim());
 * 
 *     for (const eventStr of events) {
 *       const [eventLine, dataLine] = eventStr.split('\n');
 *       const event = eventLine.replace('event: ', '');
 *       const data = JSON.parse(dataLine.replace('data: ', ''));
 * 
 *       switch (event) {
 *         case 'coordinator-reasoning':
 *           addReasoningStep('coordinator', data.content);
 *           break;
 * 
 *         case 'coordinator-decision':
 *           showDecision(data.persona, data.confidence, data.reasoning);
 *           break;
 * 
 *         case 'rag-status':
 *           if (data.status === 'retrieving') {
 *             showRagStatus('Searching knowledge base...');
 *           } else if (data.status === 'complete') {
 *             showRagStatus(`Found ${data.resultCount} relevant documents`);
 *           }
 *           break;
 * 
 *         case 'generation-reasoning':
 *           addReasoningStep('generation', data.content);
 *           break;
 * 
 *         case 'token':
 *           appendResponseToken(data.content);
 *           break;
 * 
 *         case 'done':
 *           markComplete(data.metadata);
 *           break;
 * 
 *         case 'error':
 *           showError(data.error);
 *           break;
 *       }
 *     }
 *   }
 * }
 * ```
 * 
 * React Component Example:
 * 
 * ```typescript
 * 'use client';
 * 
 * import { useState } from 'react';
 * 
 * export function AgenticChat() {
 *   const [coordinatorSteps, setCoordinatorSteps] = useState<string[]>([]);
 *   const [decision, setDecision] = useState<any>(null);
 *   const [ragStatus, setRagStatus] = useState<string>('');
 *   const [generationSteps, setGenerationSteps] = useState<string[]>([]);
 *   const [response, setResponse] = useState('');
 *   const [isDone, setIsDone] = useState(false);
 * 
 *   async function handleSubmit(message: string) {
 *     // Reset state
 *     setCoordinatorSteps([]);
 *     setDecision(null);
 *     setRagStatus('');
 *     setGenerationSteps([]);
 *     setResponse('');
 *     setIsDone(false);
 * 
 *     const res = await fetch('/api/chat/agentic', {
 *       method: 'POST',
 *       body: JSON.stringify({
 *         message,
 *         userId: 'user123',
 *         context: { profile: { major: 'CS', year: 'Junior' } },
 *       }),
 *     });
 * 
 *     const reader = res.body!.getReader();
 *     const decoder = new TextDecoder();
 * 
 *     while (true) {
 *       const { done, value } = await reader.read();
 *       if (done) break;
 * 
 *       const chunk = decoder.decode(value);
 *       const events = chunk.split('\n\n').filter(e => e.trim());
 * 
 *       for (const eventStr of events) {
 *         const [eventLine, dataLine] = eventStr.split('\n');
 *         const event = eventLine.replace('event: ', '');
 *         const data = JSON.parse(dataLine.replace('data: ', ''));
 * 
 *         if (event === 'coordinator-reasoning') {
 *           setCoordinatorSteps(prev => [...prev, data.content]);
 *         } else if (event === 'coordinator-decision') {
 *           setDecision(data);
 *         } else if (event === 'rag-status') {
 *           setRagStatus(data.status);
 *         } else if (event === 'generation-reasoning') {
 *           setGenerationSteps(prev => [...prev, data.content]);
 *         } else if (event === 'token') {
 *           setResponse(prev => prev + data.content);
 *         } else if (event === 'done') {
 *           setIsDone(true);
 *         }
 *       }
 *     }
 *   }
 * 
 *   return (
 *     <div className="space-y-4">
 *       {coordinatorSteps.length > 0 && (
 *         <div className="bg-blue-50 p-4 rounded">
 *           <h3 className="font-bold">🧭 Coordinator Reasoning</h3>
 *           {coordinatorSteps.map((step, i) => (
 *             <div key={i} className="text-sm">{step}</div>
 *           ))}
 *         </div>
 *       )}
 * 
 *       {decision && (
 *         <div className="bg-green-50 p-4 rounded">
 *           <h3 className="font-bold">✅ Decision</h3>
 *           <div>Persona: {decision.persona}</div>
 *           <div>Confidence: {(decision.confidence * 100).toFixed(0)}%</div>
 *         </div>
 *       )}
 * 
 *       {ragStatus && (
 *         <div className="bg-purple-50 p-4 rounded">
 *           <h3 className="font-bold">📚 RAG Status</h3>
 *           <div>{ragStatus}</div>
 *         </div>
 *       )}
 * 
 *       {generationSteps.length > 0 && (
 *         <div className="bg-yellow-50 p-4 rounded">
 *           <h3 className="font-bold">🧠 Generation Reasoning</h3>
 *           {generationSteps.map((step, i) => (
 *             <div key={i} className="text-sm">{step}</div>
 *           ))}
 *         </div>
 *       )}
 * 
 *       {response && (
 *         <div className="bg-white p-4 rounded border">
 *           <h3 className="font-bold">💬 Response</h3>
 *           <div className="prose">{response}</div>
 *         </div>
 *       )}
 * 
 *       {isDone && <div className="text-green-600">✅ Complete</div>}
 *     </div>
 *   );
 * }
 * ```
 */
