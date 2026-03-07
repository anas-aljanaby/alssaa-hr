-- Remove profile active/inactive status; feature no longer needed.
drop index if exists public.idx_profiles_status;
alter table public.profiles drop column if exists status;
