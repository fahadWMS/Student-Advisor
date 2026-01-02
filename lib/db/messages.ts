import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import type { AgentExecutionMetadata } from '../agents/agentExecutor';

export interface MessageInsert {
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  audioUrl?: string;
  attachments?: any[];
  metadata?: any;
  // Agent-specific fields
  intent?: string;
  persona?: string;
  ragUsed?: boolean;
  ragSources?: string[];
  toolCalls?: any;
  reasoning?: any;
  isVoiceMode?: boolean;
  modelUsed?: string;
}

type MessageRow = {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  audioUrl?: string | null;
  attachments: any[] | null;
  metadata: any;
  // Agent fields
  intent?: string | null;
  persona?: string | null;
  ragUsed?: boolean;
  ragSources?: string[];
  toolCalls?: any | null;
  reasoning?: any | null;
  isVoiceMode?: boolean;
  modelUsed?: string | null;
  createdAt: string;
};

const mapMessage = (row: MessageRow) => ({
  id: row.id,
  conversationId: row.conversationId,
  role: row.role,
  content: row.content,
  audioUrl: row.audioUrl ?? undefined,
  attachments: row.attachments ?? [],
  metadata: row.metadata,
  // Agent fields
  intent: row.intent ?? undefined,
  persona: row.persona ?? undefined,
  ragUsed: row.ragUsed ?? false,
  ragSources: row.ragSources ?? [],
  toolCalls: row.toolCalls ?? undefined,
  reasoning: row.reasoning ?? undefined,
  isVoiceMode: row.isVoiceMode ?? false,
  modelUsed: row.modelUsed ?? undefined,
  createdAt: row.createdAt,
});

export async function createMessage(message: MessageInsert) {
  const supabase = await createClient();
  const now = new Date().toISOString();
  
  const { data, error } = await supabase
    .from('messages')
    .insert({
      id: randomUUID(),
      conversationId: message.conversationId,
      role: message.role,
      content: message.content,
      audioUrl: message.audioUrl,
      attachments: message.attachments ?? [],
      metadata: message.metadata ?? {},
      // Agent fields
      intent: message.intent,
      persona: message.persona,
      ragUsed: message.ragUsed ?? false,
      ragSources: message.ragSources ?? [],
      toolCalls: message.toolCalls,
      reasoning: message.reasoning,
      isVoiceMode: message.isVoiceMode ?? false,
      modelUsed: message.modelUsed,
      createdAt: now,
    })
    .select()
    .single();

  if (error) throw error;
  return mapMessage(data as MessageRow);
}

export async function getMessages(conversationId: string) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversationId', conversationId)
    .order('createdAt', { ascending: true });

  if (error) throw error;
  const rows = (data || []) as MessageRow[];
  return rows.map(mapMessage);
}

export async function getConversationHistory(conversationId: string) {
  const messages = await getMessages(conversationId);
  return messages.map(msg => ({
    role: msg.role,
    content: msg.content,
  }));
}

/**
 * Create assistant message with agent metadata
 */
export async function createAgentMessage(
  conversationId: string,
  content: string,
  agentMetadata: AgentExecutionMetadata,
  voiceMode: boolean = false
) {
  return createMessage({
    conversationId,
    role: 'assistant',
    content,
    intent: agentMetadata.intent,
    persona: agentMetadata.persona,
    ragUsed: agentMetadata.ragUsed,
    ragSources: agentMetadata.ragSources,
    reasoning: {
      steps: agentMetadata.reasoningSteps,
      duration: agentMetadata.duration,
      confidence: agentMetadata.confidence,
    },
    isVoiceMode: voiceMode,
    modelUsed: agentMetadata.modelUsed,
    metadata: {
      tokenCount: agentMetadata.tokenCount,
      imageAnalysis: agentMetadata.imageAnalysis,
    },
  });
}
