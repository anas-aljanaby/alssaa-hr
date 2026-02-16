-- ============================================================
-- Storage bucket for leave-request attachments
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'request-attachments',
  'request-attachments',
  false,
  5242880, -- 5 MB
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
);

-- ============================================================
-- RLS policies on storage.objects for the bucket
-- ============================================================

-- Users can upload files to their own folder: request-attachments/{user_id}/*
create policy "Users can upload own attachments"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'request-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can read their own attachments
create policy "Users can read own attachments"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'request-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Managers can read attachments from their department's employees
create policy "Managers can read department attachments"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'request-attachments'
    and public.current_user_role() = 'manager'
    and (storage.foldername(name))[1] in (
      select id::text from public.profiles
      where department_id = public.current_user_department()
    )
  );

-- Admins can read all attachments
create policy "Admins can read all attachments"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'request-attachments'
    and public.current_user_role() = 'admin'
  );

-- Users can delete their own attachments
create policy "Users can delete own attachments"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'request-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
