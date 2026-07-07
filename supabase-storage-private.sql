-- SiteWorks private storage phase
-- Run this after the server signed URL route is deployed and working.
-- It keeps server/service-role uploads working while removing anonymous public reads.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'siteworks-files',
  'siteworks-files',
  false,
  26214400,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'application/pdf',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "SiteWorks files public read" on storage.objects;

drop policy if exists "SiteWorks files app upload" on storage.objects;
create policy "SiteWorks files app upload"
on storage.objects
for insert
with check (bucket_id = 'siteworks-files');

drop policy if exists "SiteWorks files app update" on storage.objects;
create policy "SiteWorks files app update"
on storage.objects
for update
using (bucket_id = 'siteworks-files')
with check (bucket_id = 'siteworks-files');

drop policy if exists "SiteWorks files app delete" on storage.objects;
create policy "SiteWorks files app delete"
on storage.objects
for delete
using (bucket_id = 'siteworks-files');
