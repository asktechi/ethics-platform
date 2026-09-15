-- Phase 7.5: AI-generated slide imagery

create table if not exists public.slide_generated_images (
  id uuid primary key default gen_random_uuid(),
  slide_id uuid not null references public.slides (id) on delete cascade,
  prompt text not null,
  storage_path text not null,
  width int,
  height int,
  model text,
  cost_usd numeric(10, 6),
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists slide_generated_images_slide_id_idx
  on public.slide_generated_images (slide_id)
  where deleted_at is null;

create index if not exists slide_generated_images_current_idx
  on public.slide_generated_images (slide_id, is_current)
  where deleted_at is null and is_current = true;

alter table public.slides
  add column if not exists generated_image_id uuid,
  add column if not exists image_status text not null default 'none',
  add column if not exists image_preference text not null default 'auto';

alter table public.slides drop constraint if exists slides_image_status_check;
alter table public.slides
  add constraint slides_image_status_check
  check (image_status in ('none', 'queued', 'generating', 'ready', 'failed'));

alter table public.slides drop constraint if exists slides_image_preference_check;
alter table public.slides
  add constraint slides_image_preference_check
  check (image_preference in ('auto', 'pool', 'ai', 'none'));

alter table public.slides drop constraint if exists slides_generated_image_id_fkey;
alter table public.slides
  add constraint slides_generated_image_id_fkey
  foreign key (generated_image_id) references public.slide_generated_images (id)
  on delete set null;

alter table public.ai_usage_log drop constraint if exists ai_usage_log_feature_check;
alter table public.ai_usage_log
  add constraint ai_usage_log_feature_check
  check (feature in ('tagging', 'generation', 'hint', 'image_generation'));

insert into storage.buckets (id, name, public, file_size_limit)
values ('generated-images', 'generated-images', false, 10485760)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

create or replace function public.storage_slide_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
begin
  return nullif(split_part(object_name, '/', 1), '')::uuid;
exception
  when others then
    return null;
end;
$$;

alter table public.slide_generated_images enable row level security;

drop policy if exists slide_generated_images_instructor_all on public.slide_generated_images;
create policy slide_generated_images_instructor_all on public.slide_generated_images
  for all to authenticated
  using (public.owns_slide(slide_id))
  with check (public.owns_slide(slide_id));

drop policy if exists generated_images_storage_select on storage.objects;
drop policy if exists generated_images_storage_insert on storage.objects;
drop policy if exists generated_images_storage_update on storage.objects;
drop policy if exists generated_images_storage_delete on storage.objects;

create policy generated_images_storage_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'generated-images'
    and public.owns_slide(public.storage_slide_id(name))
  );

create policy generated_images_storage_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'generated-images'
    and public.owns_slide(public.storage_slide_id(name))
  );

create policy generated_images_storage_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'generated-images'
    and public.owns_slide(public.storage_slide_id(name))
  )
  with check (
    bucket_id = 'generated-images'
    and public.owns_slide(public.storage_slide_id(name))
  );

create policy generated_images_storage_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'generated-images'
    and public.owns_slide(public.storage_slide_id(name))
  );
