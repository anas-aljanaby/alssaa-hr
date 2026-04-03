-- When a leave request status changes (e.g. approved or revoked), recalculate
-- attendance_daily_summary for every affected date so effective_status reflects
-- the leave correctly (on_leave vs absent).

create or replace function public.trigger_recalc_summary_on_leave_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _d date;
  _user_id uuid;
  _from date;
  _to date;
begin
  _user_id := coalesce(new.user_id, old.user_id);
  _from := date(coalesce(new.from_date_time, old.from_date_time));
  _to := date(coalesce(new.to_date_time, old.to_date_time));

  -- If the date range changed (e.g. request edited), also cover old range.
  if old.from_date_time is not null and new.from_date_time is not null then
    _from := least(_from, date(old.from_date_time));
    _to := greatest(_to, date(old.to_date_time));
  end if;

  for _d in select generate_series(_from, _to, '1 day'::interval)::date loop
    perform public.recalculate_attendance_daily_summary(_user_id, _d);
  end loop;

  return coalesce(new, old);
end;
$$;

create trigger on_leave_status_recalculate_summary
  after update of status on public.leave_requests
  for each row
  when (old.status is distinct from new.status)
  execute function public.trigger_recalc_summary_on_leave_change();
