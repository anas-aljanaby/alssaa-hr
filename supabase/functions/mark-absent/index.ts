// Supabase Edge Function: end-of-day backfill for absent/on_leave summaries.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { PunchServiceClient } from '../punch/handler.ts';
import { handleMarkAbsent, type MarkAbsentDeps, type MarkAbsentUserClient } from './handler.ts';

function createUserClientForMarkAbsent(authHeader: string): MarkAbsentUserClient {
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
  } as unknown as MarkAbsentUserClient;
}

function defaultDeps(): MarkAbsentDeps {
  return {
    getEnv: () => ({
      supabaseUrl: Deno.env.get('SUPABASE_URL')!,
      supabaseAnonKey: Deno.env.get('SUPABASE_ANON_KEY')!,
      serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      isProduction: Deno.env.get('ENVIRONMENT') === 'production',
    }),
    createUserClient: createUserClientForMarkAbsent,
    createServiceClient: () =>
      createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!) as unknown as PunchServiceClient,
  };
}

Deno.serve((req) => handleMarkAbsent(req, defaultDeps()));
