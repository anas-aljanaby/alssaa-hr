// Supabase Edge Function: send-scheduled-notifications
// Entry point — wires real Supabase clients into the handler.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleSendScheduledNotifications, type ScheduledNotifDeps } from './handler.ts';

function defaultDeps(): ScheduledNotifDeps {
  return {
    getEnv: () => ({
      serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      // Re-use the same cron token as auto-punch-out for simplicity
      cronAuthToken: Deno.env.get('AUTO_PUNCH_OUT_CRON_TOKEN') ?? null,
      isProduction: Deno.env.get('ENVIRONMENT') === 'production',
    }),
    createServiceClient: () =>
      createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      ),
  };
}

Deno.serve((req) => handleSendScheduledNotifications(req, defaultDeps()));
