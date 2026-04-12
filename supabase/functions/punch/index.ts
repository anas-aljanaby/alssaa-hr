// Supabase Edge Function: check-in / check-out.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handlePunch, type PunchDeps, type PunchServiceClient, type PunchUserClient } from './handler.ts';

/** Pass JWT into getUser(); header-only auth often returns null in Edge/Deno (supabase-js). */
function createUserClientForPunch(authHeader: string): PunchUserClient {
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
  } as unknown as PunchUserClient;
}

function defaultDeps(): PunchDeps {
  return {
    getEnv: () => ({
      supabaseUrl: Deno.env.get('SUPABASE_URL')!,
      supabaseAnonKey: Deno.env.get('SUPABASE_ANON_KEY')!,
      serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    }),
    createUserClient: createUserClientForPunch,
    createServiceClient: () =>
      createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!) as unknown as PunchServiceClient,
  };
}

Deno.serve((req) => handlePunch(req, defaultDeps()));
