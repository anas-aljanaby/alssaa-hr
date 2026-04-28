import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleNotify } from './handler.ts';

Deno.serve((req) =>
  handleNotify(req, {
    createServiceClient: () =>
      createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      ),
  }));
