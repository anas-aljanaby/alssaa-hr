// Supabase Edge Function: create a new user (admin only).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createJwtUserClient } from '../_shared/user_client.ts';
import { handleInviteUser, type InviteAdminClient, type InviteDeps, type InviteUserClient } from './handler.ts';

function defaultDeps(): InviteDeps {
  return {
    createUserClient: (authHeader: string) => createJwtUserClient(authHeader) as unknown as InviteUserClient,
    createServiceClient: () =>
      createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!) as unknown as InviteAdminClient,
  };
}

Deno.serve((req) => handleInviteUser(req, defaultDeps()));
