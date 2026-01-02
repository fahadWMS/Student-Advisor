/**
 * Example: Coordinator API Route with SSE
 * Demonstrates streaming reasoning events to frontend
 * 
 * This is an example - not yet integrated into the main app
 */

import { NextRequest } from "next/server";
import { coordinateWithReasoning } from "@/lib/agents/coordinator";
import { CoordinationContext, ReasoningEvent } from "@/lib/agents/types";

/**
 * POST /api/chat/coordinate
 * 
 * Request body:
 * {
 *   message: string;
 *   userId?: string;
 *   conversationId?: string;
 *   context?: {
 *     conversationHistory?: Array<{role: "user" | "assistant", content: string}>;
 *     userProfile?: { major?: string, year?: string, gpa?: number };
 *   }
 * }
 * 
 * Response: Server-Sent Events (SSE)
 * - event: reasoning - Reasoning steps
 * - event: decision - Final coordinator decision
 * - event: complete - Stream complete
 * - event: error - Error occurred
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, userId, conversationId, context: userContext } = body;

    if (!message || typeof message !== "string") {
      return Response.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Build coordination context
    const context: CoordinationContext = {
      userId,
      conversationId,
      conversationHistory: userContext?.conversationHistory,
      userProfile: userContext?.userProfile,
      previousDecisions: userContext?.previousDecisions,
    };

    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          // Iterate through reasoning events and decisions
          for await (const event of coordinateWithReasoning(message, context)) {
            if ("intent" in event) {
              // This is the final decision
              const data = JSON.stringify(event);
              controller.enqueue(
                encoder.encode(`event: decision\ndata: ${data}\n\n`)
              );
            } else {
              // This is a reasoning event
              const reasoningEvent = event as ReasoningEvent;
              const data = JSON.stringify(reasoningEvent);
              controller.enqueue(
                encoder.encode(`event: reasoning\ndata: ${data}\n\n`)
              );
            }
          }

          // Send completion event
          controller.enqueue(
            encoder.encode(`event: complete\ndata: {}\n\n`)
          );
        } catch (error: any) {
          console.error("Coordination error:", error);

          // Send error event
          const errorData = JSON.stringify({
            error: error.message || "Unknown error",
          });
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${errorData}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // Disable nginx buffering
      },
    });
  } catch (error: any) {
    console.error("API error:", error);
    return Response.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Frontend Usage Example:
 * 
 * ```typescript
 * async function coordinateQuery(message: string) {
 *   const response = await fetch('/api/chat/coordinate', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({
 *       message,
 *       userId: user.id,
 *       conversationId: conversation.id,
 *       context: {
 *         conversationHistory: recentMessages,
 *         userProfile: {
 *           major: user.major,
 *           year: user.year,
 *           gpa: user.gpa,
 *         },
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
 *     const lines = chunk.split('\n\n');
 * 
 *     for (const line of lines) {
 *       if (!line.trim()) continue;
 * 
 *       const [eventLine, dataLine] = line.split('\n');
 *       const event = eventLine.replace('event: ', '');
 *       const data = JSON.parse(dataLine.replace('data: ', ''));
 * 
 *       if (event === 'reasoning') {
 *         displayReasoningStep(data);
 *       } else if (event === 'decision') {
 *         handleDecision(data);
 *       } else if (event === 'complete') {
 *         console.log('Coordination complete');
 *       } else if (event === 'error') {
 *         console.error('Coordination error:', data.error);
 *       }
 *     }
 *   }
 * }
 * 
 * function displayReasoningStep(event: ReasoningEvent) {
 *   const icons = {
 *     thinking: '💭',
 *     action: '⚡',
 *     observation: '👁️',
 *     decision: '✅',
 *   };
 * 
 *   const icon = icons[event.type];
 *   console.log(`${icon} ${event.content}`);
 *   
 *   // Update UI
 *   addReasoningStep({
 *     icon,
 *     type: event.type,
 *     content: event.content,
 *     timestamp: event.timestamp,
 *   });
 * }
 * 
 * function handleDecision(decision: CoordinatorDecision) {
 *   console.log('Routing to:', decision.persona);
 *   console.log('Intent:', decision.intent);
 *   console.log('Confidence:', decision.confidence);
 *   
 *   if (decision.ragNeeded) {
 *     console.log('RAG queries:', decision.ragQueries);
 *     // Trigger RAG search
 *     searchKnowledgeBase(decision.ragQueries);
 *   }
 *   
 *   // Route to appropriate advisor
 *   routeToAdvisor(decision.persona, decision);
 * }
 * ```
 * 
 * Alternative: Using EventSource API
 * 
 * ```typescript
 * function coordinateWithEventSource(message: string) {
 *   // Note: EventSource doesn't support POST, so we'd need to use GET with query params
 *   // or use fetch with manual streaming (shown above)
 *   
 *   const params = new URLSearchParams({
 *     message,
 *     userId: user.id,
 *   });
 *   
 *   const eventSource = new EventSource(`/api/chat/coordinate?${params}`);
 *   
 *   eventSource.addEventListener('reasoning', (e) => {
 *     const event = JSON.parse(e.data);
 *     displayReasoningStep(event);
 *   });
 *   
 *   eventSource.addEventListener('decision', (e) => {
 *     const decision = JSON.parse(e.data);
 *     handleDecision(decision);
 *   });
 *   
 *   eventSource.addEventListener('complete', () => {
 *     eventSource.close();
 *   });
 *   
 *   eventSource.addEventListener('error', (e) => {
 *     console.error('SSE error:', e);
 *     eventSource.close();
 *   });
 * }
 * ```
 */
