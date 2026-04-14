// Supabase Edge Function: auto punch-out safety net.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createJwtUserClient } from '../_shared/user_client.ts';
import type { PunchServiceClient } from '../punch/handler.ts';
import { handleAutoPunchOut, type AutoPunchDeps, type AutoPunchUserClient } from './handler.ts';

function defaultDeps(): AutoPunchDeps {
  return {
    getEnv: () => ({
      supabaseUrl: Deno.env.get('SUPABASE_URL')!,
      supabaseAnonKey: Deno.env.get('SUPABASE_ANON_KEY')!,
      serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      cronAuthToken: Deno.env.get('AUTO_PUNCH_OUT_CRON_TOKEN') ?? null,
    }),
    createUserClient: (authHeader: string) => createJwtUserClient(authHeader) as unknown as AutoPunchUserClient,
    createServiceClient: () =>
      createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!) as unknown as PunchServiceClient,
  };
}

Deno.serve((req) => handleAutoPunchOut(req, defaultDeps()));
