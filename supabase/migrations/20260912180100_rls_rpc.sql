create or replace function public.owns_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.classes c
    where c.id = p_class_id
      and c.created_by = auth.uid()
  );
$$;

create or replace function public.owns_section(p_section_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sections s
    join public.classes c on c.id = s.class_id
    where s.id = p_section_id
      and c.created_by = auth.uid()
  );
$$;

create or replace function public.owns_concept(p_concept_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.concepts n
    join public.sections s on s.id = n.section_id
    join public.classes c on c.id = s.class_id
    where n.id = p_concept_id
      and c.created_by = auth.uid()
  );
$$;

create or replace function public.owns_material(p_material_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.materials m
    join public.classes c on c.id = m.class_id
    where m.id = p_material_id
      and c.created_by = auth.uid()
  );
$$;

create or replace function public.owns_slide(p_slide_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.slides sl
    join public.materials m on m.id = sl.material_id
    join public.classes c on c.id = m.class_id
    where sl.id = p_slide_id
      and c.created_by = auth.uid()
  );
$$;

create or replace function public.owns_image_pool(p_image_pool_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.image_pools ip
    join public.concepts n on n.id = ip.concept_id
    join public.sections s on s.id = n.section_id
    join public.classes c on c.id = s.class_id
    where ip.id = p_image_pool_id
      and c.created_by = auth.uid()
  );
$$;

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
    where q.id = p_question_id
      and (
        q.created_by = auth.uid()
        or (q.concept_id is not null and public.owns_concept(q.concept_id))
      )
  );
$$;

create or replace function public.owns_question_pool(p_pool_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.question_pools qp
    join public.classes c on c.id = qp.class_id
    where qp.id = p_pool_id
      and c.created_by = auth.uid()
  );
$$;

create or replace function public.owns_quiz_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.quiz_sessions qs
    join public.question_pools qp on qp.id = qs.pool_id
    join public.classes c on c.id = qp.class_id
    where qs.id = p_session_id
      and c.created_by = auth.uid()
  );
$$;

alter table public.users enable row level security;
alter table public.levels enable row level security;
alter table public.classes enable row level security;
alter table public.sections enable row level security;
alter table public.concepts enable row level security;
alter table public.standards enable row level security;
alter table public.concept_standards enable row level security;
alter table public.materials enable row level security;
alter table public.slides enable row level security;
alter table public.themes enable row level security;
alter table public.image_pools enable row level security;
alter table public.image_pool_items enable row level security;
alter table public.theme_assignments enable row level security;
alter table public.questions enable row level security;
alter table public.question_pools enable row level security;
alter table public.question_pool_items enable row level security;
alter table public.quiz_sessions enable row level security;
alter table public.quiz_participants enable row level security;
alter table public.quiz_responses enable row level security;

create policy users_self_select on public.users
  for select to authenticated
  using (id = auth.uid());

create policy users_self_update on public.users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy levels_authenticated_read on public.levels
  for select to authenticated
  using (true);

create policy standards_authenticated_read on public.standards
  for select to authenticated
  using (true);

create policy themes_authenticated_read on public.themes
  for select to authenticated
  using (true);

create policy classes_instructor_all on public.classes
  for all to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy sections_instructor_all on public.sections
  for all to authenticated
  using (public.owns_class(class_id))
  with check (public.owns_class(class_id));

create policy concepts_instructor_all on public.concepts
  for all to authenticated
  using (public.owns_section(section_id))
  with check (public.owns_section(section_id));

create policy concept_standards_instructor_all on public.concept_standards
  for all to authenticated
  using (public.owns_concept(concept_id))
  with check (public.owns_concept(concept_id));

create policy materials_instructor_all on public.materials
  for all to authenticated
  using (public.owns_class(class_id))
  with check (public.owns_class(class_id));

create policy slides_instructor_all on public.slides
  for all to authenticated
  using (public.owns_material(material_id))
  with check (public.owns_material(material_id));

create policy image_pools_instructor_all on public.image_pools
  for all to authenticated
  using (public.owns_concept(concept_id))
  with check (public.owns_concept(concept_id));

create policy image_pool_items_instructor_all on public.image_pool_items
  for all to authenticated
  using (public.owns_image_pool(image_pool_id))
  with check (public.owns_image_pool(image_pool_id));

create policy theme_assignments_instructor_all on public.theme_assignments
  for all to authenticated
  using (public.owns_class(class_id))
  with check (public.owns_class(class_id));

create policy questions_instructor_all on public.questions
  for all to authenticated
  using (
    created_by = auth.uid()
    or (concept_id is not null and public.owns_concept(concept_id))
  )
  with check (
    created_by = auth.uid()
    or (concept_id is not null and public.owns_concept(concept_id))
  );

create policy question_pools_instructor_all on public.question_pools
  for all to authenticated
  using (public.owns_class(class_id))
  with check (public.owns_class(class_id));

create policy question_pool_items_instructor_all on public.question_pool_items
  for all to authenticated
  using (public.owns_question_pool(pool_id))
  with check (public.owns_question_pool(pool_id));

create policy quiz_sessions_instructor_all on public.quiz_sessions
  for all to authenticated
  using (public.owns_question_pool(pool_id))
  with check (public.owns_question_pool(pool_id));

create policy quiz_participants_instructor_all on public.quiz_participants
  for all to authenticated
  using (public.owns_quiz_session(session_id))
  with check (public.owns_quiz_session(session_id));

create policy quiz_participants_anon_insert on public.quiz_participants
  for insert to anon
  with check (true);

create policy quiz_responses_instructor_all on public.quiz_responses
  for all to authenticated
  using (public.owns_quiz_session(session_id))
  with check (public.owns_quiz_session(session_id));

create policy quiz_responses_anon_insert on public.quiz_responses
  for insert to anon
  with check (true);

create or replace function public.join_quiz(p_join_code text, p_display_name text)
returns table(participant_id uuid, session_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_participant_id uuid;
begin
  if p_display_name is null or length(trim(p_display_name)) = 0 then
    raise exception 'Display name is required';
  end if;

  select qs.id
    into v_session_id
  from public.quiz_sessions qs
  where qs.join_code = p_join_code
    and qs.status = 'live'
    and qs.deleted_at is null;

  if v_session_id is null then
    raise exception 'Quiz session not found or not live';
  end if;

  insert into public.quiz_participants (session_id, display_name)
  values (v_session_id, trim(p_display_name))
  returning id into v_participant_id;

  return query select v_participant_id, v_session_id;
end;
$$;

revoke all on function public.join_quiz(text, text) from public;
grant execute on function public.join_quiz(text, text) to anon, authenticated;

create or replace function public.health_public_table_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from information_schema.tables
  where table_schema = 'public'
    and table_type = 'BASE TABLE';
$$;

revoke all on function public.health_public_table_count() from public;
grant execute on function public.health_public_table_count() to service_role;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, role, name, email)
  values (
    new.id,
    'instructor',
    split_part(coalesce(new.email, 'instructor'), '@', 1),
    new.email
  )
  on conflict (id) do update
    set email = excluded.email,
        name = coalesce(public.users.name, excluded.name),
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
