import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleSendTestNotification, type SendTestNotificationDeps } from './handler.ts';

function createUserClient(authHeader: string) {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}

function defaultDeps(): SendTestNotificationDeps {
  return {
    createUserClient,
    createServiceClient: () =>
      createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      ),
  };
}

Deno.serve((req) => handleSendTestNotification(req, defaultDeps()));
