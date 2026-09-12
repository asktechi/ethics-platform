alter table public.slides
  add column if not exists concept_id uuid references public.concepts (id),
  add column if not exists image_id uuid references public.image_pool_items (id);

alter table public.image_pools
  add column if not exists fallback_query text,
  add column if not exists last_generated_at timestamptz,
  add column if not exists generation_source text not null default 'none';

alter table public.image_pools
  drop constraint if exists image_pools_generation_source_check;

alter table public.image_pools
  add constraint image_pools_generation_source_check
  check (generation_source in ('unsplash', 'upload', 'none'));

alter table public.image_pool_items
  add column if not exists source_url text;

alter table public.theme_assignments
  add column if not exists theme_override_id uuid references public.themes (id),
  add column if not exists image_attribution text,
  add column if not exists variation_json jsonb default '{}'::jsonb;

create table if not exists public.presentation_runs (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  run_id uuid unique not null default gen_random_uuid(),
  started_by uuid not null references public.users (id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'setup' check (status in ('setup', 'live', 'ended')),
  settings_json jsonb not null default '{}'::jsonb,
  theme_ids_used uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists presentation_runs_class_id_idx
  on public.presentation_runs (class_id);

create index if not exists presentation_runs_run_id_idx
  on public.presentation_runs (run_id);

create index if not exists presentation_runs_status_idx
  on public.presentation_runs (class_id, status)
  where deleted_at is null;

create index if not exists slides_concept_id_idx on public.slides (concept_id);
create index if not exists slides_image_id_idx on public.slides (image_id);
create index if not exists theme_assignments_run_id_idx on public.theme_assignments (run_id);

drop trigger if exists set_updated_at on public.presentation_runs;
create trigger set_updated_at
  before update on public.presentation_runs
  for each row execute function public.set_updated_at();

create or replace function public.owns_presentation_run(p_run_pk uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.presentation_runs r
    join public.classes c on c.id = r.class_id
    where r.id = p_run_pk
      and c.created_by = auth.uid()
  );
$$;

alter table public.presentation_runs enable row level security;

drop policy if exists presentation_runs_instructor_all on public.presentation_runs;
create policy presentation_runs_instructor_all
  on public.presentation_runs
  for all
  to authenticated
  using (public.owns_class(class_id))
  with check (public.owns_class(class_id));

create or replace function public.get_run_by_run_id(p_run_id uuid)
returns table (
  id uuid,
  class_id uuid,
  run_id uuid,
  status text,
  settings_json jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.class_id, r.run_id, r.status, r.settings_json
  from public.presentation_runs r
  where r.run_id = p_run_id
    and r.status = 'live'
    and r.deleted_at is null;
$$;

revoke all on function public.get_run_by_run_id(uuid) from public;
grant execute on function public.get_run_by_run_id(uuid) to anon, authenticated;
