-- Migration: add org-wide publishing tag holder state
--
-- This table stores the current publishing tag holder for an organization.
-- The row is reused as the tag is claimed and released so the app can read
-- the latest state quickly, while force-release actions are tracked in
-- audit_logs for user-facing history.

create table public.publishing_tag_holders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  claimed_at timestamptz,
  released_at timestamptz,
  force_released_by uuid references public.profiles (id) on delete set null,
  force_released_at timestamptz
);

create index idx_publishing_tag_holders_org
  on public.publishing_tag_holders (org_id);

create unique index idx_publishing_tag_holders_org_active
  on public.publishing_tag_holders (org_id)
  where user_id is not null;

alter table public.publishing_tag_holders enable row level security;

create policy "Users can read org publishing tag"
  on public.publishing_tag_holders for select
  to authenticated
  using (org_id = public.current_user_org_id());

create policy "Users can create own publishing tag claim"
  on public.publishing_tag_holders for insert
  to authenticated
  with check (
    org_id = public.current_user_org_id()
    and user_id = auth.uid()
  );

create policy "Users can claim or release own publishing tag"
  on public.publishing_tag_holders for update
  to authenticated
  using (
    org_id = public.current_user_org_id()
    and (
      user_id is null
      or user_id = auth.uid()
    )
  )
  with check (
    org_id = public.current_user_org_id()
    and (
      user_id is null
      or user_id = auth.uid()
    )
  );

create policy "Admins can force release publishing tag"
  on public.publishing_tag_holders for update
  to authenticated
  using (
    public.current_user_role() = 'admin'
    and org_id = public.current_user_org_id()
  )
  with check (
    org_id = public.current_user_org_id()
    and (
      user_id is null
      or user_id = auth.uid()
    )
  );
