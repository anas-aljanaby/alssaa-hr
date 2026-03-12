// Supabase Edge Function: delete all is_dev attendance records for the current user.

import { corsHeaders } from '../_shared/cors.ts';
import type { PunchServiceClient } from '../punch/handler.ts';

export type DevResetEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  serviceRoleKey: string;
  isProduction: boolean;
};

export type DevResetUserClient = {
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null }; error: unknown | null }> };
};

export type DevResetDeps = {
  getEnv: () => DevResetEnv;
  createUserClient: (authHeader: string) => DevResetUserClient;
  createServiceClient: () => PunchServiceClient;
};

function errMsg(e: unknown): string {
  return typeof e === 'object' && e !== null && 'message' in e && typeof (e as { message: unknown }).message === 'string'
    ? (e as { message: string }).message
    : 'Error';
}

export async function handleDevResetAttendance(req: Request, deps: DevResetDeps): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (deps.getEnv().isProduction) {
    return new Response(
      JSON.stringify({ error: 'Not available in production', code: 'FORBIDDEN' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'غير مصرح', code: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { supabaseUrl, supabaseAnonKey, serviceRoleKey } = deps.getEnv();

    const clientWithAuth = deps.createUserClient(authHeader);
    const { data: { user: caller } } = await clientWithAuth.auth.getUser();
    if (!caller) {
      return new Response(
        JSON.stringify({ error: 'انتهت الجلسة', code: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const admin = deps.createServiceClient();

    const { data: deletedRaw, error } = await admin
      .from('attendance_logs')
      .delete()
      .eq('user_id', caller.id)
      .eq('is_dev', true)
      .select('id');

    const deleted = deletedRaw as { id: string }[] | null;

    if (error) {
      return new Response(
        JSON.stringify({ error: errMsg(error), code: 'DELETE_FAILED' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const count = deleted?.length ?? 0;
    return new Response(
      JSON.stringify({ ok: true, deleted: count, message: `Deleted ${count} dev attendance record(s)` }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (_e) {
    return new Response(
      JSON.stringify({ error: 'خطأ في الخادم', code: 'INTERNAL' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
