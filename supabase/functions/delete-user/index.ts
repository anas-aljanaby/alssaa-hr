// Supabase Edge Function: delete a user account (admin only).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createJwtUserClient } from '../_shared/user_client.ts';
import { handleDeleteUser, type DeleteAdminClient, type DeleteDeps, type DeleteUserClient } from './handler.ts';

function defaultDeps(): DeleteDeps {
  return {
    createUserClient: (authHeader: string) => createJwtUserClient(authHeader) as unknown as DeleteUserClient,
    createServiceClient: () =>
      createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!) as unknown as DeleteAdminClient,
  };
}

Deno.serve((req) => handleDeleteUser(req, defaultDeps()));
