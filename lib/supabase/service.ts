import { createClient } from '@supabase/supabase-js';

let cachedClient: ReturnType<typeof createClient> | null = null;

export function createServiceRoleClient() {
  if (cachedClient) {
    return cachedClient;
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase service role credentials are not configured');
  }

  cachedClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
      },
    }
  );

  return cachedClient;
}
