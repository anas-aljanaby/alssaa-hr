// Supabase Edge Function: delete a user account (admin only).

import { corsHeaders } from '../_shared/cors.ts';
import { parseBearerToken } from '../_shared/bearer.ts';
import type { PunchServiceClient } from '../punch/handler.ts';

export interface DeleteBody {
  user_id: string;
}

export type DeleteAdminClient = PunchServiceClient & {
  auth: {
    admin: {
      deleteUser: (id: string) => Promise<{
        data: { user: { id: string } | null } | null;
        error: { message?: string } | null;
      }>;
    };
  };
};

export type DeleteUserClient = {
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null }; error: unknown | null }> };
};

export type DeleteDeps = {
  createUserClient: (authHeader: string) => DeleteUserClient;
  createServiceClient: () => DeleteAdminClient;
};

export async function handleDeleteUser(req: Request, deps: DeleteDeps): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const token = parseBearerToken(req);
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'غير مصرح', code: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = `Bearer ${token}`;

    const clientWithAuth = deps.createUserClient(authHeader);
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

    const admin = deps.createServiceClient();
    const { data: callerProfileRaw } = await admin
      .from('profiles')
      .select('org_id, role')
      .eq('id', caller.id)
      .single();

    const callerProfile = callerProfileRaw as { org_id: string; role: string } | null;

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

    const { data: targetProfileRaw } = await admin
      .from('profiles')
      .select('id, org_id, role')
      .eq('id', targetUserId)
      .single();

    const targetProfile = targetProfileRaw as { id: string; org_id: string; role: string } | null;

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
        JSON.stringify({
          error: deleteError.message || 'فشل حذف المستخدم',
          code: 'DELETE_USER_FAILED',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, user_id: deleteResult?.user?.id ?? targetUserId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (_e) {
    return new Response(
      JSON.stringify({ error: 'خطأ في الخادم', code: 'INTERNAL' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
