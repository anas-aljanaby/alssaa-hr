-- ============================================================
-- Persisted department colors
-- ============================================================

alter table public.departments
add column if not exists color text;

update public.departments as d
set color = palette.color
from (
  select
    id,
    (array[
      '#2563EB',
      '#059669',
      '#D97706',
      '#DB2777',
      '#7C3AED',
      '#0891B2'
    ])[((row_number() over (order by created_at, name_ar)) - 1) % 6 + 1] as color
  from public.departments
  where color is null
) as palette
where d.id = palette.id;

alter table public.departments
alter column color set default '#2563EB';

alter table public.departments
alter column color set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'departments_color_check'
  ) then
    alter table public.departments
    add constraint departments_color_check
    check (color in (
      '#2563EB',
      '#059669',
      '#D97706',
      '#DB2777',
      '#7C3AED',
      '#0891B2'
    ));
  end if;
end $$;
