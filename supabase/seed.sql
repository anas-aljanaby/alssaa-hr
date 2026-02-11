-- ============================================================
-- ALSSAA HR — Seed Data
-- Run after the initial migration
-- ============================================================

-- Default attendance policy (single row)
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
  '08:00', '16:00', 15, '{5,6}', 3, '12:00', 21, 10
);

-- Initial departments
insert into public.departments (name, name_ar) values
  ('News',      'الأخبار'),
  ('Technical', 'التقنية'),
  ('Marketing', 'التسويق'),
  ('Finance',   'المالية'),
  ('HR',        'الموارد البشرية');

-- ============================================================
-- Admin user setup
-- ============================================================
-- To create the first admin user:
--
-- 1. Via Supabase Dashboard:
--    - Go to Authentication > Users > "Add user"
--    - Set email & password
--    - In raw_user_meta_data add: { "name": "Admin", "name_ar": "مدير النظام", "role": "admin", "employee_id": "EMP-ADMIN-01" }
--    - The handle_new_user trigger will auto-create the profile and leave balance
--
-- 2. Via SQL (service role):
--    select supabase_auth.create_user(
--      '{"email": "admin@alssaa.com", "password": "your-secure-password",
--        "raw_user_meta_data": {"name": "Admin", "name_ar": "مدير النظام", "role": "admin", "employee_id": "EMP-ADMIN-01"}}'::jsonb
--    );
