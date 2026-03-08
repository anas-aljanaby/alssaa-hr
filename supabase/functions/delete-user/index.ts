// Supabase Edge Function: delete a user account (admin only).
// Uses service role to delete auth user; cascades to profile and related rows.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteBody {
  user_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const rawAuthHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');
    const bearerMatch = rawAuthHeader?.match(/^Bearer\s+(.+)$/i);
    const tokenFromBearer = bearerMatch?.[1]?.trim();
    const tokenFromRaw = rawAuthHeader && !bearerMatch ? rawAuthHeader.trim() : undefined;

    const token =
      (tokenFromBearer && tokenFromBearer.includes('.') && tokenFromBearer.length > 20
        ? tokenFromBearer
        : undefined) ??
      (tokenFromRaw && tokenFromRaw.includes('.') && tokenFromRaw.length > 20 ? tokenFromRaw : undefined);

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'غير مصرح', code: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = `Bearer ${token}`;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const clientWithAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await clientWithAuth.auth.getUser();
    if (!caller) {
      return new Response(
        JSON.stringify({ error: 'انتهت الجلسة أو لا تملك الصلاحية', code: 'PGRST301' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = (await req.json()) as DeleteBody;
    const targetUserId = typeof body?.user_id === 'string' ? body.user_id.trim() : '';
    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: 'معرّف المستخدم مطلوب', code: 'INVALID_USER_ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (targetUserId === caller.id) {
      return new Response(
        JSON.stringify({ error: 'لا يمكنك حذف حسابك', code: 'CANNOT_DELETE_SELF' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('org_id, role')
      .eq('id', caller.id)
      .single();

    if (!callerProfile) {
      return new Response(
        JSON.stringify({ error: 'لم يتم العثور على الملف الشخصي', code: 'NO_PROFILE' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (callerProfile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'ليس لديك صلاحية تنفيذ هذه العملية', code: '42501' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: targetProfile } = await admin
      .from('profiles')
      .select('id, org_id, role')
      .eq('id', targetUserId)
      .single();

    if (!targetProfile) {
      return new Response(
        JSON.stringify({ error: 'المستخدم غير موجود', code: 'USER_NOT_FOUND' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (targetProfile.org_id !== callerProfile.org_id) {
      return new Response(
        JSON.stringify({ error: 'لا يمكنك حذف مستخدم من مؤسسة أخرى', code: 'ORG_MISMATCH' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (targetProfile.role === 'admin') {
      return new Response(
        JSON.stringify({ error: 'لا يمكن حذف المدير العام من هنا', code: 'CANNOT_DELETE_ADMIN' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: deleteResult, error: deleteError } = await admin.auth.admin.deleteUser(targetUserId);
    if (deleteError) {
      return new Response(
        JSON.stringify({ error: deleteError.message || 'فشل حذف المستخدم', code: 'DELETE_USER_FAILED' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, user_id: deleteResult.user?.id ?? targetUserId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: 'خطأ في الخادم', code: 'INTERNAL' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
