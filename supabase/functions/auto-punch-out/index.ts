// Supabase Edge Function: auto punch-out safety net.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { PunchServiceClient } from '../punch/handler.ts';
import { handleAutoPunchOut, type AutoPunchDeps, type AutoPunchUserClient } from './handler.ts';

function createUserClientForAutoPunch(authHeader: string): AutoPunchUserClient {
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
  } as unknown as AutoPunchUserClient;
}

function defaultDeps(): AutoPunchDeps {
  return {
    getEnv: () => ({
      supabaseUrl: Deno.env.get('SUPABASE_URL')!,
      supabaseAnonKey: Deno.env.get('SUPABASE_ANON_KEY')!,
      serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      cronAuthToken: Deno.env.get('AUTO_PUNCH_OUT_CRON_TOKEN') ?? null,
      isProduction: Deno.env.get('ENVIRONMENT') === 'production',
    }),
    createUserClient: createUserClientForAutoPunch,
    createServiceClient: () =>
      createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!) as unknown as PunchServiceClient,
  };
}

Deno.serve((req) => handleAutoPunchOut(req, defaultDeps()));
