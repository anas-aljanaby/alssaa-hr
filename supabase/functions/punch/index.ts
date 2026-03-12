// Supabase Edge Function: check-in / check-out with optional devOverrideTime.
// In production, devOverrideTime is ignored. In non-production, it is used as effective "now".

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handlePunch, type PunchDeps, type PunchServiceClient, type PunchUserClient } from './handler.ts';

function defaultDeps(): PunchDeps {
  return {
    getEnv: () => ({
      supabaseUrl: Deno.env.get('SUPABASE_URL')!,
      supabaseAnonKey: Deno.env.get('SUPABASE_ANON_KEY')!,
      serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      isProduction: Deno.env.get('ENVIRONMENT') === 'production',
    }),
    createUserClient: (authHeader: string) =>
      createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      }) as unknown as PunchUserClient,
    createServiceClient: () =>
      createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!) as unknown as PunchServiceClient,
  };
}

Deno.serve((req) => handlePunch(req, defaultDeps()));
