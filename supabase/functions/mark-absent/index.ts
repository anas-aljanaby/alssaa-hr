// Supabase Edge Function: end-of-day backfill for absent/on_leave summaries.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createJwtUserClient } from '../_shared/user_client.ts';
import type { PunchServiceClient } from '../punch/handler.ts';
import { handleMarkAbsent, type MarkAbsentDeps, type MarkAbsentUserClient } from './handler.ts';

function defaultDeps(): MarkAbsentDeps {
  return {
    getEnv: () => ({
      supabaseUrl: Deno.env.get('SUPABASE_URL')!,
      supabaseAnonKey: Deno.env.get('SUPABASE_ANON_KEY')!,
      serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    }),
    createUserClient: (authHeader: string) => createJwtUserClient(authHeader) as unknown as MarkAbsentUserClient,
    createServiceClient: () =>
      createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!) as unknown as PunchServiceClient,
  };
}

Deno.serve((req) => handleMarkAbsent(req, defaultDeps()));
