import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createJwtUserClient } from '../_shared/user_client.ts';
import { handleSendTestNotification, type SendTestNotificationDeps } from './handler.ts';

function defaultDeps(): SendTestNotificationDeps {
  return {
    createUserClient: createJwtUserClient,
    createServiceClient: () =>
      createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      ),
  };
}

Deno.serve((req) => handleSendTestNotification(req, defaultDeps()));
