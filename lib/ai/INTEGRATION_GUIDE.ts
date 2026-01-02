/**
 * Example: Integrating RAG with existing chat API
 * 
 * This file shows how to update your chat route to use the vector store
 */

import { NextRequest } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-helpers';
import { generateAgenticResponse, streamAgenticResponse } from '@/lib/ai/agenticChatService';
import { createMessage, getConversationHistory } from '@/lib/db/messages';
import { createConversation, getConversation, updateConversationTitle } from '@/lib/db/conversations';

/**
 * INTEGRATION EXAMPLE 1: Simple RAG-Enhanced Response
 * Replace your existing message generation with this:
 */
export async function simpleRAGIntegration(
  message: string,
  userId: string,
  conversationId: string,
  persona: string
) {
  // Call the agentic chat service
  const response = await generateAgenticResponse(message, {
    userId,
    conversationId,
    category: persona as "academic" | "career" | "wellness" | "general",
    useRAG: true,
    usePersonalization: true,
    temperature: 0.7,
  });

  console.log(`📚 Used ${response.contexts.length} knowledge base contexts`);
  console.log(`📂 Category: ${response.category}`);

  return response.message;
}

/**
 * INTEGRATION EXAMPLE 2: Streaming RAG Response
 * For real-time streaming in your chat UI:
 */
export async function streamingRAGIntegration(
  message: string,
  userId: string,
  conversationId: string,
  persona: string,
  controller: ReadableStreamDefaultController
) {
  const encoder = new TextEncoder();
  let fullResponse = '';

  // Stream tokens from agentic service
  for await (const token of streamAgenticResponse(message, {
    userId,
    conversationId,
    category: persona as "academic" | "career" | "wellness" | "general",
    useRAG: true,
    temperature: 0.7,
  })) {
    fullResponse += token;
    
    // Send token to client
    controller.enqueue(
      encoder.encode(`data: ${JSON.stringify({ token })}\n\n`)
    );
  }

  return fullResponse;
}

/**
 * INTEGRATION EXAMPLE 3: Hybrid Approach
 * Use RAG for certain personas, fallback to regular for others:
 */
export async function hybridIntegration(
  message: string,
  userId: string,
  conversationId: string,
  persona: string,
  useRAG: boolean = true
) {
  if (useRAG && ['academic', 'career', 'wellness'].includes(persona)) {
    // Use RAG-enhanced response for knowledge-intensive personas
    const response = await generateAgenticResponse(message, {
      userId,
      conversationId,
      category: persona as "academic" | "career" | "wellness" | "general",
      useRAG: true,
      usePersonalization: true,
    });

    return {
      message: response.message,
      metadata: {
        contexts: response.contexts,
        category: response.category,
        ragEnabled: true,
      },
    };
  } else {
    // Fallback to your existing Gemini/Groq implementation
    // ... your existing code ...
    return {
      message: "Regular response without RAG",
      metadata: { ragEnabled: false },
    };
  }
}

/**
 * FULL EXAMPLE: Updated POST handler with RAG
 */
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  try {
    const { user, error } = await getAuthenticatedUser();
    if (error || !user) {
      return unauthorizedResponse();
    }

    const formData = await request.formData();
    const message = formData.get('message') as string;
    const conversationId = formData.get('conversationId') as string | null;
    const persona = (formData.get('persona') as string) || 'academic';
    const useRAG = formData.get('useRAG') !== 'false'; // Enable by default

    if (!message || typeof message !== 'string') {
      const errorStream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Message is required' })}\n\n`));
          controller.close();
        },
      });
      return new Response(errorStream, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      });
    }

    let currentConversationId = conversationId;
    let isNewConversation = false;

    if (!currentConversationId) {
      const newConversation = await createConversation(user.id, persona);
      currentConversationId = newConversation.id;
      isNewConversation = true;
    }

    const conversation = await getConversation(currentConversationId);
    if (conversation.userId !== user.id) {
      const errorStream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Forbidden' })}\n\n`));
          controller.close();
        },
      });
      return new Response(errorStream, {
        status: 403,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }

    // Save user message
    await createMessage({
      conversationId: currentConversationId,
      role: 'user',
      content: message,
    });

    // Stream response with RAG
    const responseStream = new ReadableStream({
      async start(controller) {
        try {
          let fullResponse = '';
          
          // Send conversation ID first
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ conversationId: currentConversationId })}\n\n`)
          );

          if (useRAG) {
            // Use RAG-enhanced streaming
            for await (const token of streamAgenticResponse(message, {
              userId: user.id,
              conversationId: currentConversationId,
              category: persona as "academic" | "career" | "wellness" | "general",
              useRAG: true,
              usePersonalization: true,
            })) {
              fullResponse += token;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ token })}\n\n`)
              );
            }
          } else {
            // Your existing non-RAG implementation
            // ... existing code ...
          }

          // Save assistant message
          const assistantMsg = await createMessage({
            conversationId: currentConversationId,
            role: 'assistant',
            content: fullResponse,
          });

          // Generate title for new conversations
          if (isNewConversation) {
            // You can use your existing title generation or create a new one
            const title = message.substring(0, 50);
            await updateConversationTitle(currentConversationId, title);
          }

          // Send done signal
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ done: true, messageId: assistantMsg.id })}\n\n`)
          );
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: 'Internal server error' })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Chat API error:', error);
    const errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Internal server error' })}\n\n`));
        controller.close();
      },
    });
    return new Response(errorStream, {
      status: 500,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }
}
