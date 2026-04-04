-- English display name (departments.name) is optional; Arabic name remains required.
alter table public.departments alter column name drop not null;
