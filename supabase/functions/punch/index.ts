// Supabase Edge Function: check-in / check-out.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createJwtUserClient } from '../_shared/user_client.ts';
import { handlePunch, type PunchDeps, type PunchServiceClient, type PunchUserClient } from './handler.ts';

function defaultDeps(): PunchDeps {
  return {
    getEnv: () => ({
      supabaseUrl: Deno.env.get('SUPABASE_URL')!,
      supabaseAnonKey: Deno.env.get('SUPABASE_ANON_KEY')!,
      serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    }),
    createUserClient: (authHeader: string) => createJwtUserClient(authHeader) as unknown as PunchUserClient,
    createServiceClient: () =>
      createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!) as unknown as PunchServiceClient,
  };
}

Deno.serve((req) => handlePunch(req, defaultDeps()));
