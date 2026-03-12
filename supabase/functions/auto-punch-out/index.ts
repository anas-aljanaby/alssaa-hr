// Supabase Edge Function: auto punch-out safety net.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { PunchServiceClient } from '../punch/handler.ts';
import { handleAutoPunchOut, type AutoPunchDeps } from './handler.ts';

function defaultDeps(): AutoPunchDeps {
  return {
    getEnv: () => ({
      supabaseUrl: Deno.env.get('SUPABASE_URL')!,
      serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      isProduction: Deno.env.get('ENVIRONMENT') === 'production',
    }),
    createServiceClient: () =>
      createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!) as unknown as PunchServiceClient,
  };
}

Deno.serve((req) => handleAutoPunchOut(req, defaultDeps()));
