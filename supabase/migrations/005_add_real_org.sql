-- ============================================================
-- Seed/Upsert real organization + initial real users
-- - Creates real org if missing
-- - Creates GM/Admin account for "رضوان"
-- - Creates two employee accounts with random demo values
-- - Ensures org.general_manager_id points to رضوان profile
-- ============================================================

do $$
declare
  _real_org_id uuid := '11111111-1111-1111-1111-111111111111';
  _pw_hash     text;

  _gm_uid      uuid := 'bbbbbbbb-0000-0000-0000-000000000001';
  _emp1_uid    uuid := 'bbbbbbbb-0000-0000-0000-000000000101';
  _emp2_uid    uuid := 'bbbbbbbb-0000-0000-0000-000000000102';
begin
  _pw_hash := extensions.crypt('ChangeMe123!', extensions.gen_salt('bf'));

  -- 1) Real organization
  insert into public.organizations (id, name, is_demo)
  values (_real_org_id, 'Alssaa Media Network', false)
  on conflict (id) do update set
    name = excluded.name,
    is_demo = excluded.is_demo;

  -- 2) Attendance policy (required for leave balances defaults in some flows)
  insert into public.attendance_policy (org_id)
  values (_real_org_id)
  on conflict (org_id) do nothing;

  -- 3) Helper: upsert auth user + identity + profile + leave balance
  create or replace function public._seed_real_user(
    _id uuid,
    _email text,
    _password_hash text,
    _meta jsonb
  ) returns void language plpgsql as $fn$
  begin
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, last_sign_in_at, recovery_sent_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      _id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      _email,
      _password_hash,
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      _meta,
      now(), now(),
      '', '', '', ''
    )
    on conflict (id) do update set
      email = excluded.email,
      encrypted_password = excluded.encrypted_password,
      email_confirmed_at = excluded.email_confirmed_at,
      last_sign_in_at = excluded.last_sign_in_at,
      recovery_sent_at = excluded.recovery_sent_at,
      raw_user_meta_data = excluded.raw_user_meta_data,
      updated_at = now();

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      _id, _id, _id::text,
      format('{"sub":"%s","email":"%s"}', _id::text, _email)::jsonb,
      'email', now(), now(), now()
    )
    on conflict (id) do update set
      identity_data = excluded.identity_data,
      last_sign_in_at = now(),
      updated_at = now();

    insert into public.profiles (
      id, org_id, employee_id, name, name_ar, phone, role,
      created_at, updated_at
    ) values (
      _id,
      (_meta->>'org_id')::uuid,
      _meta->>'employee_id',
      _meta->>'name',
      _meta->>'name_ar',
      _meta->>'phone',
      _meta->>'role',
      now(), now()
    )
    on conflict (id) do update set
      org_id = excluded.org_id,
      employee_id = excluded.employee_id,
      name = excluded.name,
      name_ar = excluded.name_ar,
      phone = excluded.phone,
      role = excluded.role,
      updated_at = now();

    insert into public.leave_balances (
      org_id, user_id, total_annual, used_annual, remaining_annual
    ) values (
      (_meta->>'org_id')::uuid,
      _id,
      21, 0, 21
    )
    on conflict (user_id) do update set
      org_id = excluded.org_id,
      total_annual = excluded.total_annual,
      used_annual = excluded.used_annual,
      remaining_annual = excluded.remaining_annual;
  end;
  $fn$;

  -- 4) Create/upsert real users
  perform public._seed_real_user(
    _gm_uid,
    'ridwan.gm@alssaa.tv',
    _pw_hash,
    jsonb_build_object(
      'name', 'Ridwan',
      'name_ar', 'رضوان',
      'phone', '+964 770 555 0101',
      'role', 'admin',
      'employee_id', 'ALS-GM-001',
      'org_id', _real_org_id
    )
  );

  perform public._seed_real_user(
    _emp1_uid,
    'employee.random1@alssaa.tv',
    _pw_hash,
    jsonb_build_object(
      'name', 'Ali Kareem',
      'name_ar', 'علي كريم',
      'phone', '+964 770 555 0187',
      'role', 'employee',
      'employee_id', 'ALS-EMP-101',
      'org_id', _real_org_id
    )
  );

  perform public._seed_real_user(
    _emp2_uid,
    'employee.random2@alssaa.tv',
    _pw_hash,
    jsonb_build_object(
      'name', 'Mariam Nasser',
      'name_ar', 'مريم ناصر',
      'phone', '+964 770 555 0243',
      'role', 'employee',
      'employee_id', 'ALS-EMP-102',
      'org_id', _real_org_id
    )
  );

  drop function if exists public._seed_real_user(uuid, text, text, jsonb);

  -- 5) Enforce GM pointer to رضوان profile
  update public.organizations
  set general_manager_id = _gm_uid
  where id = _real_org_id;

  raise notice 'Real org seed complete. GM/Admin: رضوان (ridwan.gm@alssaa.tv). Temporary password: ChangeMe123!';
end;
$$;
