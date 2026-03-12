// Supabase Edge Function: create a new user (admin only).
// Uses service role to create user; org_id is taken from the caller's profile.

import { corsHeaders } from '../_shared/cors.ts';
import { parseBearerToken } from '../_shared/bearer.ts';
import type { PunchServiceClient } from '../punch/handler.ts';

export interface InviteBody {
  email: string;
  name: string;
  phone?: string;
  role: 'employee' | 'manager';
  department_id: string;
}

export type InviteAdminClient = PunchServiceClient & {
  auth: {
    admin: {
      inviteUserByEmail: (
        email: string,
        options: unknown
      ) => Promise<{ data: { user: { id: string } | null } | null; error: { message?: string } | null }>;
    };
  };
};

export type InviteUserClient = {
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null }; error: unknown | null }> };
};

export type InviteDeps = {
  createUserClient: (authHeader: string) => InviteUserClient;
  createServiceClient: () => InviteAdminClient;
};

export async function handleInviteUser(req: Request, deps: InviteDeps): Promise<Response> {
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

    const admin = deps.createServiceClient();
    const { data: profileRaw } = await admin
      .from('profiles')
      .select('org_id, role')
      .eq('id', caller.id)
      .single();

    const profile = profileRaw as { org_id: string; role: string } | null;

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'لم يتم العثور على الملف الشخصي', code: 'NO_PROFILE' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (profile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'ليس لديك صلاحية تنفيذ هذه العملية', code: '42501' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = (await req.json()) as InviteBody;
    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const role = body?.role;
    const department_id = typeof body?.department_id === 'string' ? body.department_id.trim() : '';
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : undefined;
    const allowedRoles = ['employee', 'manager'] as const;

    const originHeader = req.headers.get('origin')?.trim();
    const refererHeader = req.headers.get('referer')?.trim() ?? req.headers.get('referrer')?.trim();
    const originFromReferer = refererHeader
      ? (() => {
          try {
            return new URL(refererHeader).origin;
          } catch {
            return undefined;
          }
        })()
      : undefined;
    const origin = originHeader || originFromReferer;
    const redirectTo = origin ? `${origin.replace(/\/+$/, '')}/set-password` : undefined;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: 'البريد الإلكتروني غير صالح', code: 'INVALID_EMAIL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!name || name.length < 2) {
      return new Response(
        JSON.stringify({ error: 'الاسم يجب أن يكون حرفين على الأقل', code: 'INVALID_NAME' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!role || !allowedRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: 'الدور مطلوب', code: 'INVALID_ROLE' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!department_id) {
      return new Response(
        JSON.stringify({ error: 'القسم مطلوب', code: 'INVALID_DEPARTMENT' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const user_metadata: Record<string, unknown> = {
      name,
      name_ar: name,
      role,
      org_id: profile.org_id,
      department_id,
    };
    if (phone) user_metadata.phone = phone;

    const { data: invitedUser, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: user_metadata,
      ...(redirectTo ? { redirectTo } : {}),
    });

    if (error) {
      const msg = error.message || '';
      if (/already been registered|already exists|duplicate/i.test(msg)) {
        return new Response(
          JSON.stringify({ error: 'البريد الإلكتروني مسجل مسبقاً', code: 'DUPLICATE_EMAIL' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (/permission|denied|policy|RLS/i.test(msg)) {
        return new Response(
          JSON.stringify({ error: 'ليس لديك صلاحية تنفيذ هذه العملية', code: '42501' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: msg || 'فشل إنشاء المستخدم', code: 'CREATE_USER_FAILED' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, user_id: invitedUser?.user?.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (_e) {
    return new Response(
      JSON.stringify({ error: 'خطأ في الخادم', code: 'INTERNAL' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
