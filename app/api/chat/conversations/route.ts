import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-helpers';
import { getConversations } from '@/lib/db/conversations';

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await getAuthenticatedUser();
    if (error || !user) {
      return unauthorizedResponse();
    }

    const conversations = await getConversations(user.id);

    return NextResponse.json({ conversations });

  } catch (error) {
    console.error('Get conversations error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
