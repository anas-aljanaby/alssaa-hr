-- Migration: add 'overtime' as a valid leave_requests.type value
-- Overtime requests are auto-created when an employee punches in outside shift hours.

alter table public.leave_requests
  drop constraint if exists leave_requests_type_check;

alter table public.leave_requests
  add constraint leave_requests_type_check
    check (type in ('annual_leave', 'sick_leave', 'hourly_permission', 'time_adjustment', 'overtime'));
