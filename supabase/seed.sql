-- ============================================================
-- ALSSAA HR — Seed Data
-- Run after the initial migration (001_initial_schema.sql)
-- ============================================================
-- Prerequisites:
--   1. Migration 001 has been applied (tables, RLS, triggers exist)
--   2. This file is idempotent-safe for attendance_policy (single row)
-- ============================================================

-- ============================================================
-- 1. Default Attendance Policy (single row)
-- ============================================================
-- Iraqi standard: Sun–Thu work week, Fri–Sat off (day indexes 5, 6)
insert into public.attendance_policy (
  work_start_time,
  work_end_time,
  grace_period_minutes,
  weekly_off_days,
  max_late_days_before_warning,
  absent_cutoff_time,
  annual_leave_per_year,
  sick_leave_per_year
) values (
  '08:00',
  '16:00',
  15,
  '{5,6}',
  3,
  '12:00',
  21,
  10
);

-- ============================================================
-- 2. Initial Departments
-- ============================================================
insert into public.departments (name, name_ar) values
  ('News Department',      'قسم الأخبار'),
  ('Technical Department', 'القسم التقني'),
  ('Marketing Department', 'قسم التسويق'),
  ('Finance Department',   'القسم المالي'),
  ('HR Department',        'قسم الموارد البشرية');

-- ============================================================
-- 3. Default Admin User (SQL)
-- ============================================================
-- Creates admin@alssaa.tv. The handle_new_user trigger will
-- auto-create profile + leave_balances. Idempotent: skipped if
-- a user with this email already exists.
-- Password: ChangeMe-InProduction-123! (change after first login)
-- ============================================================
do $$
declare
  v_user_id uuid;
  v_encrypted_pw text;
begin
  if exists (select 1 from auth.users where email = 'admin@alssaa.tv') then
    return;
  end if;

  v_user_id := gen_random_uuid();
  v_encrypted_pw := crypt('ChangeMe-InProduction-123!', gen_salt('bf'));

  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin@alssaa.tv',
    v_encrypted_pw,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{
      "name": "Ahmed Hassan",
      "name_ar": "أحمد حسن",
      "role": "admin",
      "employee_id": "EMP-001",
      "phone": "+964 770 123 4567"
    }'::jsonb,
    now(),
    now()
  );

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    v_user_id,
    format('{"sub": "%s", "email": "admin@alssaa.tv"}', v_user_id)::jsonb,
    'email',
    v_user_id,
    now(),
    now(),
    now()
  );

  -- Assign admin to HR department (trigger already created profile)
  update public.profiles
  set department_id = (select id from public.departments where name = 'HR Department' limit 1)
  where employee_id = 'EMP-001';
end $$;
--
-- Alternative: create more users via Supabase Dashboard →
--   Authentication → Users → Add user, with User Metadata
--   containing name, name_ar, role, employee_id, phone.
--   See docs/ADMIN_SETUP.md for details.
--
-- ============================================================
-- 4. (Optional) Demo Users for Testing
-- ============================================================
-- After creating the admin, you can create additional demo users
-- using the same methods above. Here are the recommended test users
-- matching the application's mock data:
--
-- Manager — News Department:
--   {
--     "name": "Sara Ali",
--     "name_ar": "سارة علي",
--     "role": "manager",
--     "employee_id": "EMP-002",
--     "phone": "+964 770 234 5678"
--   }
--   → After creation, assign department_id in profiles:
--     UPDATE public.profiles
--     SET department_id = (SELECT id FROM public.departments WHERE name = 'News Department')
--     WHERE employee_id = 'EMP-002';
--     UPDATE public.departments
--     SET manager_uid = (SELECT id FROM public.profiles WHERE employee_id = 'EMP-002')
--     WHERE name = 'News Department';
--
-- Employee — News Department:
--   {
--     "name": "Mohammed Karim",
--     "name_ar": "محمد كريم",
--     "role": "employee",
--     "employee_id": "EMP-003",
--     "phone": "+964 770 345 6789"
--   }
--   → After creation, assign department_id in profiles:
--     UPDATE public.profiles
--     SET department_id = (SELECT id FROM public.departments WHERE name = 'News Department')
--     WHERE employee_id = 'EMP-003';
--
-- See docs/ADMIN_SETUP.md for the full list of demo users and
-- step-by-step setup instructions.
