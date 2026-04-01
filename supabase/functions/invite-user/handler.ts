// Supabase Edge Function: create a new user (admin only).
// Uses service role to create user; org_id is taken from the caller's profile.

import { corsHeaders } from '../_shared/cors.ts';
import { parseBearerToken } from '../_shared/bearer.ts';
import type { PunchServiceClient } from '../punch/handler.ts';

export interface InviteBody {
  email: string;
  name: string;
  password: string;
  role: 'employee' | 'manager';
  department_id?: string;
}

export type InviteAdminClient = PunchServiceClient & {
  auth: {
    admin: {
      createUser: (
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

const PROFILE_SYNC_MAX_ATTEMPTS = 6;
const PROFILE_SYNC_DELAY_MS = 150;

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

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
    const password = typeof body?.password === 'string' ? body.password : '';
    const role = body?.role;
    const department_id = typeof body?.department_id === 'string' ? body.department_id.trim() : '';
    const allowedRoles = ['employee', 'manager'] as const;

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
    if (
      !password
      || password.length < 8
      || password.length > 128
      || !/[a-z]/.test(password)
      || !/[A-Z]/.test(password)
      || !/\d/.test(password)
    ) {
      return new Response(
        JSON.stringify({
          error: 'كلمة المرور يجب أن تكون 8-128 وتحتوي على حرف كبير وحرف صغير ورقم',
          code: 'INVALID_PASSWORD',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!role || !allowedRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: 'الدور مطلوب', code: 'INVALID_ROLE' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const user_metadata: Record<string, unknown> = {
      name,
      name_ar: name,
      role,
      org_id: profile.org_id,
    };
    if (department_id) user_metadata.department_id = department_id;

    const { data: createdUser, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: user_metadata,
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

    if (createdUser?.user?.id) {
      for (let attempt = 0; attempt < PROFILE_SYNC_MAX_ATTEMPTS; attempt += 1) {
        const { data: existingProfile } = await admin
          .from('profiles')
          .select('id')
          .eq('id', createdUser.user.id)
          .maybeSingle();

        if (existingProfile) {
          await admin
            .from('profiles')
            .update({
              email,
              org_id: profile.org_id,
              role,
              name,
              name_ar: name,
              department_id: department_id || null,
            })
            .eq('id', createdUser.user.id);
          break;
        }

        if (attempt < PROFILE_SYNC_MAX_ATTEMPTS - 1) {
          await wait(PROFILE_SYNC_DELAY_MS);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, user_id: createdUser?.user?.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (_e) {
    return new Response(
      JSON.stringify({ error: 'خطأ في الخادم', code: 'INTERNAL' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
