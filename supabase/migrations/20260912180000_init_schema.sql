create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('instructor', 'student')),
  name text,
  email text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.levels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  "order" int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references public.levels (id),
  title text not null,
  audience text,
  description text,
  created_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  title text not null,
  "order" int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.concepts (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections (id) on delete cascade,
  title text not null,
  "order" int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.standards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  body text,
  category text not null check (category in ('introduction', 'concept', 'standard')),
  "order" int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.concept_standards (
  concept_id uuid not null references public.concepts (id) on delete cascade,
  standard_id uuid not null references public.standards (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (concept_id, standard_id)
);

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  concept_id uuid references public.concepts (id),
  type text not null check (type in ('text', 'pptx', 'pdf', 'image', 'question_set', 'docx', 'csv')),
  original_filename text not null,
  storage_path text not null,
  sha256 text not null,
  uploaded_by uuid not null references public.users (id),
  version_of uuid references public.materials (id),
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.slides (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials (id) on delete cascade,
  "order" int not null,
  title text,
  body text,
  cue text,
  speaker_note text,
  layout text check (layout in ('hook', 'point', 'contrast', 'scenario', 'question', 'reveal', 'cue')),
  image_prompt text,
  status text not null default 'draft' check (status in ('draft', 'approved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.themes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  palette_json jsonb not null,
  is_professional_locked boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.image_pools (
  id uuid primary key default gen_random_uuid(),
  concept_id uuid not null references public.concepts (id) on delete cascade,
  keywords text[],
  approved_at timestamptz,
  approved_by uuid references public.users (id),
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.image_pool_items (
  id uuid primary key default gen_random_uuid(),
  image_pool_id uuid not null references public.image_pools (id) on delete cascade,
  url text not null,
  thumb_url text,
  source text,
  photographer text,
  "order" int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.theme_assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  slide_id uuid references public.slides (id) on delete cascade,
  theme_id uuid not null references public.themes (id),
  image_url text,
  run_id uuid,
  assigned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  stem text not null,
  choices_json jsonb,
  answer_key text,
  explanation text,
  standard_id uuid references public.standards (id),
  concept_id uuid references public.concepts (id),
  difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  source text not null check (source in ('mine', 'ai_generated')),
  approved boolean not null default false,
  created_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.question_pools (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.question_pool_items (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.question_pools (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  "order" int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.question_pools (id) on delete cascade,
  host_id uuid not null references public.users (id),
  mode text not null check (mode in ('jeopardy', 'standard')),
  time_per_q int,
  status text not null check (status in ('draft', 'live', 'ended')),
  join_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.quiz_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.quiz_sessions (id) on delete cascade,
  display_name text not null,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.quiz_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.quiz_sessions (id) on delete cascade,
  participant_id uuid not null references public.quiz_participants (id) on delete cascade,
  question_id uuid not null references public.questions (id),
  answer text,
  is_correct boolean,
  ms_taken int,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index users_email_idx on public.users (email);
create index classes_level_id_idx on public.classes (level_id);
create index classes_created_by_idx on public.classes (created_by);
create index sections_class_id_idx on public.sections (class_id);
create index concepts_section_id_idx on public.concepts (section_id);
create index concept_standards_standard_id_idx on public.concept_standards (standard_id);
create index materials_class_id_idx on public.materials (class_id);
create index materials_concept_id_idx on public.materials (concept_id);
create index materials_uploaded_by_idx on public.materials (uploaded_by);
create index materials_version_of_idx on public.materials (version_of);
create index slides_material_id_idx on public.slides (material_id);
create index image_pools_concept_id_idx on public.image_pools (concept_id);
create index image_pools_approved_by_idx on public.image_pools (approved_by);
create index image_pool_items_image_pool_id_idx on public.image_pool_items (image_pool_id);
create index theme_assignments_class_id_idx on public.theme_assignments (class_id);
create index theme_assignments_slide_id_idx on public.theme_assignments (slide_id);
create index theme_assignments_theme_id_idx on public.theme_assignments (theme_id);
create index questions_standard_id_idx on public.questions (standard_id);
create index questions_concept_id_idx on public.questions (concept_id);
create index questions_created_by_idx on public.questions (created_by);
create index question_pools_class_id_idx on public.question_pools (class_id);
create index question_pool_items_pool_id_idx on public.question_pool_items (pool_id);
create index question_pool_items_question_id_idx on public.question_pool_items (question_id);
create index quiz_sessions_pool_id_idx on public.quiz_sessions (pool_id);
create index quiz_sessions_host_id_idx on public.quiz_sessions (host_id);
create index quiz_participants_session_id_idx on public.quiz_participants (session_id);
create index quiz_responses_session_id_idx on public.quiz_responses (session_id);
create index quiz_responses_participant_id_idx on public.quiz_responses (participant_id);
create index quiz_responses_question_id_idx on public.quiz_responses (question_id);

create index materials_class_current_idx
  on public.materials (class_id, is_current)
  where deleted_at is null;

create index slides_material_order_idx
  on public.slides (material_id, "order");

create index questions_standard_concept_approved_idx
  on public.questions (standard_id, concept_id, approved);

create index quiz_responses_session_question_idx
  on public.quiz_responses (session_id, question_id);

create index quiz_responses_participant_question_idx
  on public.quiz_responses (participant_id, question_id);

do $$
declare
  t text;
begin
  foreach t in array array[
    'users', 'levels', 'classes', 'sections', 'concepts', 'standards',
    'concept_standards', 'materials', 'slides', 'themes', 'image_pools',
    'image_pool_items', 'theme_assignments', 'questions', 'question_pools',
    'question_pool_items', 'quiz_sessions', 'quiz_participants', 'quiz_responses'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t
    );
  end loop;
end;
$$;
