-- ============================================================
-- Bootstrap one organization + its General Manager (GM/Admin)
-- ------------------------------------------------------------
-- Purpose:
-- - Create (or update) an organization
-- - Ensure attendance_policy exists for that organization
-- - Create (or update) a GM auth user
-- - Ensure GM profile + leave_balance exist
-- - Point organizations.general_manager_id to that GM
--
-- Safe to re-run (idempotent upserts).
-- ============================================================
--
-- HOW TO USE
-- 1) Edit only the values in the CONFIG section.
-- 2) Run this SQL in Supabase SQL editor or via psql.
-- 3) Log in with GM email/password from CONFIG.
--
-- NOTE:
-- - This script sets email_confirmed_at so GM can log in immediately.
-- - GM role is set to admin.
-- - attendance_policy is inserted with default schema values.

do $$
declare
  -- =========================
  -- CONFIG (EDIT THESE)
  -- =========================
  v_org_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_org_name text := 'my new org';
  v_org_is_demo boolean := false;

  v_gm_email text := 'anas.aljanaby667@gmail.com';
  v_gm_password_plain text := 'ChangeMe123!';
  v_gm_name text := 'anas ahmed';
  v_gm_name_ar text := 'أنس أحمد';
  v_gm_phone text := '+964 770 000 0000';
  v_gm_employee_id text := 'ORG-GM-001';

  -- Optional: set to a fixed UUID if you want deterministic GM user id.
  -- Keep null to auto-generate when user is first created.
  v_gm_user_id uuid := null;

  -- =========================
  -- INTERNALS (DO NOT EDIT)
  -- =========================
  v_effective_gm_user_id uuid;
  v_existing_auth_user_id uuid;
  v_password_hash text;
begin
  if v_org_id is null then
    raise exception 'CONFIG_ERROR: v_org_id is required';
  end if;
  if coalesce(trim(v_org_name), '') = '' then
    raise exception 'CONFIG_ERROR: v_org_name is required';
  end if;
  if coalesce(trim(v_gm_email), '') = '' then
    raise exception 'CONFIG_ERROR: v_gm_email is required';
  end if;
  if coalesce(trim(v_gm_password_plain), '') = '' then
    raise exception 'CONFIG_ERROR: v_gm_password_plain is required';
  end if;

  -- 1) Organization (upsert)
  insert into public.organizations (id, name, is_demo)
  values (v_org_id, v_org_name, v_org_is_demo)
  on conflict (id) do update
  set
    name = excluded.name,
    is_demo = excluded.is_demo;

  -- 2) Minimum policy row so downstream defaults work.
  insert into public.attendance_policy (org_id)
  values (v_org_id)
  on conflict (org_id) do nothing;

  -- 3) Prepare GM auth account details.
  v_password_hash := extensions.crypt(v_gm_password_plain, extensions.gen_salt('bf'));

  select u.id
    into v_existing_auth_user_id
  from auth.users u
  where lower(u.email) = lower(v_gm_email)
  limit 1;

  v_effective_gm_user_id := coalesce(v_existing_auth_user_id, v_gm_user_id, gen_random_uuid());

  -- 4) Auth user (upsert by id) and keep email confirmed for immediate login.
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    last_sign_in_at,
    recovery_sent_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) values (
    v_effective_gm_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_gm_email,
    v_password_hash,
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'name', v_gm_name,
      'name_ar', v_gm_name_ar,
      'phone', v_gm_phone,
      'role', 'admin',
      'employee_id', v_gm_employee_id,
      'org_id', v_org_id
    ),
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  on conflict (id) do update set
    email = excluded.email,
    encrypted_password = excluded.encrypted_password,
    email_confirmed_at = excluded.email_confirmed_at,
    last_sign_in_at = excluded.last_sign_in_at,
    recovery_sent_at = excluded.recovery_sent_at,
    raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = now();

  -- Keep email unique logic friendly when account already existed by email.
  if v_existing_auth_user_id is not null and v_existing_auth_user_id <> v_effective_gm_user_id then
    raise exception 'EMAIL_CONFLICT: % already belongs to auth user %', v_gm_email, v_existing_auth_user_id;
  end if;

  -- 5) Auth identity row (required for normal Supabase auth consistency).
  insert into auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    v_effective_gm_user_id,
    v_effective_gm_user_id,
    v_effective_gm_user_id::text,
    format('{"sub":"%s","email":"%s"}', v_effective_gm_user_id::text, v_gm_email)::jsonb,
    'email',
    now(),
    now(),
    now()
  )
  on conflict (id) do update set
    identity_data = excluded.identity_data,
    last_sign_in_at = now(),
    updated_at = now();

  -- 6) Ensure profile row exists and is admin in the target org.
  insert into public.profiles (
    id,
    org_id,
    employee_id,
    name,
    name_ar,
    email,
    phone,
    role,
    created_at,
    updated_at
  ) values (
    v_effective_gm_user_id,
    v_org_id,
    v_gm_employee_id,
    v_gm_name,
    v_gm_name_ar,
    v_gm_email,
    v_gm_phone,
    'admin',
    now(),
    now()
  )
  on conflict (id) do update set
    org_id = excluded.org_id,
    employee_id = excluded.employee_id,
    name = excluded.name,
    name_ar = excluded.name_ar,
    email = excluded.email,
    phone = excluded.phone,
    role = excluded.role,
    updated_at = now();

  -- 7) Ensure leave balance exists.
  insert into public.leave_balances (
    org_id,
    user_id,
    total_annual,
    used_annual,
    remaining_annual,
    total_sick,
    used_sick,
    remaining_sick
  ) values (
    v_org_id,
    v_effective_gm_user_id,
    21, 0, 21,
    10, 0, 10
  )
  on conflict (user_id) do update set
    org_id = excluded.org_id,
    total_annual = excluded.total_annual,
    used_annual = excluded.used_annual,
    remaining_annual = excluded.remaining_annual,
    total_sick = excluded.total_sick,
    used_sick = excluded.used_sick,
    remaining_sick = excluded.remaining_sick;

  -- 8) Set GM pointer on organization.
  update public.organizations
  set general_manager_id = v_effective_gm_user_id
  where id = v_org_id;

  raise notice 'Bootstrap complete.';
  raise notice 'Org: % (%)', v_org_name, v_org_id;
  raise notice 'GM: % (user_id=%)', v_gm_email, v_effective_gm_user_id;
  raise notice 'You can now log in and start inviting users.';
end;
$$;
