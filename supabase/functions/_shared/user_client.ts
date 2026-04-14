import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type JwtAuthUserClient = {
  auth: {
    getUser: () => Promise<unknown>;
  };
};

/** Always pass the bearer JWT into getUser() ourselves; header-only auth is flaky in Edge/Deno. */
export function createJwtUserClient(authHeader: string): JwtAuthUserClient {
  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    auth: {
      getUser: () => client.auth.getUser(jwt),
    },
  };
}
