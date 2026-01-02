/**
 * Production Agentic Chat API Route
 * 
 * Full pipeline with SSE streaming:
 * 1. Save user message
 * 2. Execute agent pipeline (coordinator → RAG → generation)
 * 3. Stream reasoning events + response tokens
 * 4. Save assistant message with agent metadata
 * 
 * POST /api/chat/message
 */

import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-helpers';
import { generateConversationTitle } from '@/lib/ai/chatService';
import { createMessage, createAgentMessage, getConversationHistory } from '@/lib/db/messages';
import { createConversation, getConversation, updateConversationTitle } from '@/lib/db/conversations';
import {
  executeAgentPipeline,
  extractImages,
  hasImages,
  type AgentEvent,
  type AgentExecutionMetadata,
} from '@/lib/agents/agentExecutor';

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  try {
    // Authenticate user
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError || !user) {
      return unauthorizedResponse();
    }

    // Parse form data
    const formData = await req.formData();
    const message = formData.get('message') as string;
    let conversationId = formData.get('conversationId') as string | null;
    const voiceMode = formData.get('voiceMode') === 'true';
    const persona = (formData.get('persona') as string) || 'academic';

    // Process image files
    const fileList = formData.getAll('files') as File[];
    const imageFiles: Array<{ data: Buffer; mimeType: string }> = [];

    for (const file of fileList) {
      if (file.type.startsWith('image/')) {
        const bytes = await file.arrayBuffer();
        imageFiles.push({
          data: Buffer.from(bytes),
          mimeType: file.type,
        });
      }
    }

    // Validate message
    if (!message || typeof message !== 'string') {
      return Response.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Create conversation if needed
    let isNewConversation = false;
    if (!conversationId) {
      const newConversation = await createConversation(user.id, persona);
      conversationId = newConversation.id;
      isNewConversation = true;
    }

    // Verify conversation ownership
    const conversation = await getConversation(conversationId);
    if (conversation.userId !== user.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get conversation history
    const history = await getConversationHistory(conversationId);

    // Save user message
    await createMessage({
      conversationId,
      role: 'user',
      content: message,
      attachments: imageFiles.length > 0 ? imageFiles.map(f => ({ type: f.mimeType })) : undefined,
      isVoiceMode: voiceMode,
    });

    // Build user context
    const userContext = {
      userId: user.id,
      profile: {
        name: user.name || undefined,
        email: user.email || undefined,
      },
      conversationHistory: history.slice(-5), // Last 5 messages
      preferences: {
        voiceMode,
      },
    };

    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = '';
        let agentMetadata: AgentExecutionMetadata | null = null;

        try {
          // Send conversation ID first
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'conversation',
                conversationId,
              })}\n\n`
            )
          );

          // Execute agent pipeline
          for await (const event of executeAgentPipeline({
            userMessage: message,
            userContext,
            voiceMode,
            conversationHistory: history,
            images: imageFiles.length > 0 ? imageFiles : undefined,
          })) {
            // Format event for SSE
            const sseEvent = formatSSEEvent(event);
            controller.enqueue(encoder.encode(sseEvent));

            // Collect response and metadata
            if (event.type === 'token') {
              fullResponse += event.content;
            } else if (event.type === 'done') {
              agentMetadata = event.metadata;
            }
          }

          // Save assistant message with agent metadata
          if (agentMetadata) {
            const savedMessage = await createAgentMessage(
              conversationId,
              fullResponse,
              agentMetadata,
              voiceMode
            );

            // Generate title for new conversations
            if (isNewConversation) {
              const title = await generateConversationTitle(message);
              await updateConversationTitle(conversationId, title);
            }

            // Send message ID
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'saved',
                  messageId: savedMessage.id,
                })}\n\n`
              )
            );
          }

          controller.close();
        } catch (error: any) {
          console.error('[Chat API] Pipeline error:', error);

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'error',
                content: error.message || 'Agent pipeline failed',
                timestamp: Date.now(),
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
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error: any) {
    console.error('[Chat API] Error:', error);
    return Response.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Format agent event as SSE event
 */
function formatSSEEvent(event: AgentEvent): string {
  let data: any;

  switch (event.type) {
    case 'coordinator-reasoning':
      data = {
        type: 'reasoning',
        step: event.step,
        content: event.content,
        timestamp: event.timestamp,
      };
      break;

    case 'coordinator-decision':
      data = {
        type: 'decision',
        persona: event.decision.persona,
        intent: event.decision.intent,
        confidence: event.decision.confidence,
        ragNeeded: event.decision.ragNeeded,
        timestamp: event.timestamp,
      };
      break;

    case 'image-analysis':
      data = {
        type: 'reasoning',
        step: 'image',
        content: event.content,
        timestamp: event.timestamp,
      };
      break;

    case 'rag-search':
      data = {
        type: 'reasoning',
        step: 'search',
        content: `🔎 Searching: ${event.queries.join(', ')}`,
        timestamp: event.timestamp,
      };
      break;

    case 'rag-results':
      data = {
        type: 'reasoning',
        step: 'found',
        content: `📚 Found ${event.resultCount} source(s)`,
        sources: event.sources,
        timestamp: event.timestamp,
      };
      break;

    case 'generation-reasoning':
      data = {
        type: 'reasoning',
        step: 'generate',
        content: event.content,
        timestamp: event.timestamp,
      };
      break;

    case 'token':
      data = {
        type: 'token',
        content: event.content,
        timestamp: event.timestamp,
      };
      break;

    case 'done':
      data = {
        type: 'done',
        metadata: event.metadata,
        timestamp: event.timestamp,
      };
      break;

    case 'error':
      data = {
        type: 'error',
        content: event.content,
        timestamp: event.timestamp,
      };
      break;

    default:
      data = event;
  }

  return `data: ${JSON.stringify(data)}\n\n`;
}
