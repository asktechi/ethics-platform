alter table public.materials
  add column if not exists byte_size bigint,
  add column if not exists list_order int;

insert into storage.buckets (id, name, public, file_size_limit)
values ('materials', 'materials', false, 52428800)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

create or replace function public.storage_class_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
begin
  return nullif(split_part(object_name, '/', 2), '')::uuid;
exception
  when others then
    return null;
end;
$$;

drop policy if exists materials_storage_select on storage.objects;
drop policy if exists materials_storage_insert on storage.objects;
drop policy if exists materials_storage_update on storage.objects;
drop policy if exists materials_storage_delete on storage.objects;

create policy materials_storage_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'materials'
    and public.owns_class(public.storage_class_id(name))
  );

create policy materials_storage_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'materials'
    and public.owns_class(public.storage_class_id(name))
  );

create policy materials_storage_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'materials'
    and public.owns_class(public.storage_class_id(name))
  )
  with check (
    bucket_id = 'materials'
    and public.owns_class(public.storage_class_id(name))
  );

-- Objects are immutable originals. Instructors do not delete storage bytes.
create policy materials_storage_delete
  on storage.objects
  for delete
  to authenticated
  using (false);
