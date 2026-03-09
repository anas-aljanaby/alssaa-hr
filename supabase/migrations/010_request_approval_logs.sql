-- Add explicit decision timestamp and append-only approval logs for request decisions.

alter table public.leave_requests
  add column if not exists decided_at timestamptz;

create table if not exists public.approval_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  request_id uuid not null references public.leave_requests (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  action text not null check (action in ('approved', 'rejected')),
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists idx_approval_logs_org on public.approval_logs (org_id);
create index if not exists idx_approval_logs_request on public.approval_logs (request_id, created_at desc);
create index if not exists idx_approval_logs_actor on public.approval_logs (actor_id);

alter table public.approval_logs enable row level security;

create policy "Users can read own request approval logs"
  on public.approval_logs for select
  to authenticated
  using (
    request_id in (
      select lr.id
      from public.leave_requests lr
      where lr.user_id = auth.uid()
    )
  );

create policy "Managers can read department approval logs"
  on public.approval_logs for select
  to authenticated
  using (
    public.current_user_role() = 'manager'
    and org_id = public.current_user_org_id()
    and request_id in (
      select lr.id
      from public.leave_requests lr
      join public.profiles p on p.id = lr.user_id
      where p.department_id = public.current_user_department()
        and p.org_id = public.current_user_org_id()
    )
  );

create policy "Admins can read org approval logs"
  on public.approval_logs for select
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and org_id = public.current_user_org_id()
  );

create policy "Managers can insert department approval logs"
  on public.approval_logs for insert
  to authenticated
  with check (
    actor_id = auth.uid()
    and public.current_user_role() = 'manager'
    and org_id = public.current_user_org_id()
    and request_id in (
      select lr.id
      from public.leave_requests lr
      join public.profiles p on p.id = lr.user_id
      where p.department_id = public.current_user_department()
        and p.org_id = public.current_user_org_id()
    )
  );

create policy "Admins can insert org approval logs"
  on public.approval_logs for insert
  to authenticated
  with check (
    actor_id = auth.uid()
    and public.current_user_role() = 'admin'
    and org_id = public.current_user_org_id()
  );
