-- Phase 5: question bank columns, import batches, AI usage log, pool settings.

alter table public.questions
  add column if not exists class_id uuid references public.classes (id) on delete cascade,
  add column if not exists tag_approved boolean not null default false,
  add column if not exists ai_tag_confidence numeric(3, 2),
  add column if not exists ai_tag_reasoning text,
  add column if not exists import_batch_id uuid,
  add column if not exists rejected boolean not null default false;

alter table public.questions drop constraint if exists questions_source_check;
alter table public.questions
  add constraint questions_source_check
  check (source in ('mine', 'imported', 'ai_generated'));

create index if not exists questions_class_id_idx on public.questions (class_id);
create index if not exists questions_import_batch_id_idx on public.questions (import_batch_id);
create index if not exists questions_tag_approved_idx on public.questions (tag_approved);

alter table public.question_pools
  add column if not exists shuffle_on_play boolean not null default true,
  add column if not exists time_per_q int;

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  filename text not null,
  question_count int not null default 0,
  imported_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists import_batches_class_id_idx on public.import_batches (class_id);

alter table public.questions
  drop constraint if exists questions_import_batch_id_fkey;
alter table public.questions
  add constraint questions_import_batch_id_fkey
  foreign key (import_batch_id) references public.import_batches (id) on delete set null;

create table if not exists public.ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  class_id uuid references public.classes (id) on delete set null,
  feature text not null check (feature in ('tagging', 'generation')),
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_usd numeric(10, 6) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_log_user_id_idx on public.ai_usage_log (user_id);
create index if not exists ai_usage_log_class_id_idx on public.ai_usage_log (class_id);

create or replace function public.owns_question(p_question_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.questions q
    left join public.classes c on c.id = q.class_id
    where q.id = p_question_id
      and (
        q.created_by = auth.uid()
        or (q.class_id is not null and c.created_by = auth.uid())
        or (q.concept_id is not null and public.owns_concept(q.concept_id))
      )
  );
$$;

create or replace function public.owns_import_batch(p_batch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.import_batches b
    join public.classes c on c.id = b.class_id
    where b.id = p_batch_id
      and c.created_by = auth.uid()
  );
$$;

alter table public.import_batches enable row level security;
alter table public.ai_usage_log enable row level security;

drop policy if exists import_batches_instructor_all on public.import_batches;
create policy import_batches_instructor_all on public.import_batches
  for all to authenticated
  using (public.owns_class(class_id))
  with check (public.owns_class(class_id));

drop policy if exists ai_usage_log_self_all on public.ai_usage_log;
create policy ai_usage_log_self_all on public.ai_usage_log
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists questions_instructor_all on public.questions;
create policy questions_instructor_all on public.questions
  for all to authenticated
  using (
    created_by = auth.uid()
    or (class_id is not null and public.owns_class(class_id))
    or (concept_id is not null and public.owns_concept(concept_id))
  )
  with check (
    created_by = auth.uid()
    or (class_id is not null and public.owns_class(class_id))
    or (concept_id is not null and public.owns_concept(concept_id))
  );

-- Phase 6 host will call this to load a pool in play order.
create or replace function public.load_pool_questions(p_pool_id uuid)
returns table (
  question_id uuid,
  stem text,
  choices_json jsonb,
  answer_key text,
  explanation text,
  difficulty text,
  item_order int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    q.id,
    q.stem,
    q.choices_json,
    q.answer_key,
    q.explanation,
    q.difficulty,
    i."order"
  from public.question_pool_items i
  join public.question_pools p on p.id = i.pool_id
  join public.questions q on q.id = i.question_id
  where i.pool_id = p_pool_id
    and i.deleted_at is null
    and q.deleted_at is null
    and q.approved = true
    and p.deleted_at is null
  order by i."order";
$$;

revoke all on function public.load_pool_questions(uuid) from public;
grant execute on function public.load_pool_questions(uuid) to authenticated, service_role;
