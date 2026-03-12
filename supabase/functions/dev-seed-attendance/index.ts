// Supabase Edge Function: seed one month of varied attendance for the authenticated user.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { PunchServiceClient } from '../punch/handler.ts';
import { handleDevSeedAttendance, type DevSeedDeps, type DevSeedUserClient } from './handler.ts';

function defaultDeps(): DevSeedDeps {
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
      }) as unknown as DevSeedUserClient,
    createServiceClient: () =>
      createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!) as unknown as PunchServiceClient,
  };
}

Deno.serve((req) => handleDevSeedAttendance(req, defaultDeps()));
