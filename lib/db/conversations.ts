import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';

type ConversationRow = {
  id: string;
  userId: string;
  title: string;
  persona: string;
  createdAt: string;
  updatedAt: string;
  messages?: { content: string; createdAt: string }[];
};

const mapConversation = (row: ConversationRow) => ({
  id: row.id,
  userId: row.userId,
  title: row.title,
  persona: row.persona,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export async function createConversation(userId: string, persona: string, title?: string) {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      id: randomUUID(),
      userId,
      persona,
      title: title || 'New Conversation',
      createdAt: now,
      updatedAt: now,
    })
    .select()
    .single();

  if (error) throw error;
  return mapConversation(data as ConversationRow);
}

export async function getConversations(userId: string) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      id,
      userId,
      title,
      persona,
      createdAt,
      updatedAt,
      messages (
        content,
        createdAt
      )
    `)
    .eq('userId', userId)
    .order('updatedAt', { ascending: false });

  if (error) throw error;
  
  return (data || []).map((conv: any) => ({
    ...mapConversation(conv as ConversationRow),
    messageCount: conv.messages?.length || 0,
    lastMessage: conv.messages?.[conv.messages.length - 1]?.content || null,
  }));
}

export async function getConversation(conversationId: string) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('conversations')
    .select('id, userId, title, persona, createdAt, updatedAt')
    .eq('id', conversationId)
    .single();

  if (error) throw error;
  return mapConversation(data as ConversationRow);
}

export async function updateConversationTitle(conversationId: string, title: string) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('conversations')
    .update({ title })
    .eq('id', conversationId)
    .select('id, userId, title, persona, createdAt, updatedAt')
    .single();

  if (error) throw error;
  return mapConversation(data as ConversationRow);
}

export async function deleteConversation(conversationId: string) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId);

  if (error) throw error;
}
