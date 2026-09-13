-- Phase 6C: game library, templates, instances, student profiles.

alter table public.quiz_sessions
  alter column pool_id drop not null;

alter table public.quiz_participants
  add column if not exists student_profile_id uuid,
  add column if not exists left_at timestamptz;

alter table public.quiz_responses
  add column if not exists points_earned int not null default 0;

create table if not exists public.game_templates (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  owner_id uuid not null references public.users (id),
  name text not null,
  description text,
  tags text[] not null default '{}',
  mode text not null check (mode in ('jeopardy','rapid_fire','case_study','team_battle','adaptive','boss_battle')),
  pool_id uuid references public.question_pools (id) on delete set null,
  filter_json jsonb not null default '{}'::jsonb,
  settings_json jsonb not null default '{}'::jsonb,
  version int not null default 1,
  play_count int not null default 0,
  last_played_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.game_instances (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.game_templates (id) on delete cascade,
  template_version int not null default 1,
  host_id uuid not null references public.users (id),
  quiz_session_id uuid references public.quiz_sessions (id) on delete set null,
  join_code text not null unique,
  host_token uuid not null default gen_random_uuid(),
  status text not null check (status in ('scheduled','lobby','live','ended','abandoned')),
  scheduled_for timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  participant_count int not null default 0,
  avg_score numeric(8,2),
  duration_seconds int,
  settings_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.student_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users (id),
  display_name text not null,
  student_code text not null unique,
  email text,
  org text,
  cohort_tag text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.student_performance (
  id uuid primary key default gen_random_uuid(),
  student_profile_id uuid not null references public.student_profiles (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  standard_id uuid not null references public.standards (id) on delete cascade,
  attempts int not null default 0,
  correct int not null default 0,
  accuracy numeric(5,2) not null default 0,
  avg_ms int not null default 0,
  weakness_score numeric(6,3) not null default 0,
  last_practiced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_profile_id, class_id, standard_id)
);

create table if not exists public.cfa_exam_results (
  id uuid primary key default gen_random_uuid(),
  student_profile_id uuid not null references public.student_profiles (id) on delete cascade,
  exam_level text not null check (exam_level in ('I','II','III')),
  exam_date date not null,
  band_score numeric(3,1),
  passed boolean,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists game_templates_owner_idx on public.game_templates (owner_id) where deleted_at is null;
create index if not exists game_templates_class_idx on public.game_templates (class_id) where deleted_at is null;
create index if not exists game_instances_template_idx on public.game_instances (template_id) where deleted_at is null;
create index if not exists game_instances_host_idx on public.game_instances (host_id) where deleted_at is null;
create index if not exists game_instances_session_idx on public.game_instances (quiz_session_id);
create index if not exists student_profiles_owner_idx on public.student_profiles (owner_id);
create index if not exists student_performance_profile_idx on public.student_performance (student_profile_id);

alter table public.quiz_participants
  drop constraint if exists quiz_participants_student_profile_id_fkey;
alter table public.quiz_participants
  add constraint quiz_participants_student_profile_id_fkey
  foreign key (student_profile_id) references public.student_profiles (id) on delete set null;

drop trigger if exists game_templates_set_updated_at on public.game_templates;
create trigger game_templates_set_updated_at
  before update on public.game_templates
  for each row execute function public.set_updated_at();

drop trigger if exists game_instances_set_updated_at on public.game_instances;
create trigger game_instances_set_updated_at
  before update on public.game_instances
  for each row execute function public.set_updated_at();

drop trigger if exists student_profiles_set_updated_at on public.student_profiles;
create trigger student_profiles_set_updated_at
  before update on public.student_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists student_performance_set_updated_at on public.student_performance;
create trigger student_performance_set_updated_at
  before update on public.student_performance
  for each row execute function public.set_updated_at();

drop trigger if exists cfa_exam_results_set_updated_at on public.cfa_exam_results;
create trigger cfa_exam_results_set_updated_at
  before update on public.cfa_exam_results
  for each row execute function public.set_updated_at();

alter table public.game_templates enable row level security;
alter table public.game_instances enable row level security;
alter table public.student_profiles enable row level security;
alter table public.student_performance enable row level security;
alter table public.cfa_exam_results enable row level security;

drop policy if exists game_templates_owner_all on public.game_templates;
create policy game_templates_owner_all on public.game_templates
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists game_instances_host_all on public.game_instances;
create policy game_instances_host_all on public.game_instances
  for all to authenticated
  using (host_id = auth.uid())
  with check (host_id = auth.uid());

drop policy if exists student_profiles_owner_all on public.student_profiles;
create policy student_profiles_owner_all on public.student_profiles
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists student_performance_owner_select on public.student_performance;
create policy student_performance_owner_select on public.student_performance
  for all to authenticated
  using (
    exists (
      select 1 from public.student_profiles p
      where p.id = student_profile_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.student_profiles p
      where p.id = student_profile_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists cfa_exam_results_owner_all on public.cfa_exam_results;
create policy cfa_exam_results_owner_all on public.cfa_exam_results
  for all to authenticated
  using (
    exists (
      select 1 from public.student_profiles p
      where p.id = student_profile_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.student_profiles p
      where p.id = student_profile_id and p.owner_id = auth.uid()
    )
  );

create or replace function public.generate_student_code()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      if i = 3 then
        code := code || '-';
      end if;
    end loop;
    exit when not exists (select 1 from public.student_profiles where student_code = code);
  end loop;
  return code;
end;
$$;

create or replace function public.match_or_create_student_profile(
  p_owner_id uuid,
  p_display_name text,
  p_student_code text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_code text;
begin
  if p_student_code is not null and length(trim(p_student_code)) > 0 then
    select id into v_id
    from public.student_profiles
    where upper(replace(student_code, '-', '')) = upper(replace(trim(p_student_code), '-', ''))
      and owner_id = p_owner_id
      and deleted_at is null
    limit 1;
    if v_id is not null then
      update public.student_profiles
      set last_seen_at = now(), display_name = coalesce(nullif(trim(p_display_name), ''), display_name)
      where id = v_id;
      return v_id;
    end if;
    v_code := upper(replace(trim(p_student_code), '-', ''));
    if length(v_code) = 6 then
      v_code := substr(v_code, 1, 3) || '-' || substr(v_code, 4, 3);
      insert into public.student_profiles (owner_id, display_name, student_code, last_seen_at)
      values (p_owner_id, trim(p_display_name), v_code, now())
      returning id into v_id;
      return v_id;
    end if;
  end if;

  select id into v_id
  from public.student_profiles
  where owner_id = p_owner_id
    and lower(display_name) = lower(trim(p_display_name))
    and deleted_at is null
  limit 1;
  if v_id is not null then
    update public.student_profiles set last_seen_at = now() where id = v_id;
    return v_id;
  end if;

  v_code := public.generate_student_code();
  insert into public.student_profiles (owner_id, display_name, student_code, last_seen_at)
  values (p_owner_id, trim(p_display_name), v_code, now())
  returning id into v_id;
  return v_id;
end;
$$;

drop function if exists public.join_quiz(text, text);
create or replace function public.join_quiz(p_join_code text, p_display_name text, p_student_code text default null)
returns table (
  participant_id uuid,
  session_id uuid,
  participant_token uuid,
  avatar_color text,
  host_id uuid,
  host_token text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.quiz_sessions%rowtype;
  v_count int;
  v_allow boolean;
  v_color text;
  v_token uuid;
  v_id uuid;
  v_profile uuid;
  v_palette text[] := array[
    '#C9A227', '#4C8BF5', '#E07A3D', '#2A9D8F',
    '#9B5DE5', '#F4A261', '#E63946', '#457B9D'
  ];
begin
  if p_display_name is null or length(trim(p_display_name)) = 0 then
    raise exception 'Display name is required';
  end if;

  select * into v_session
  from public.quiz_sessions qs
  where upper(qs.join_code) = upper(trim(p_join_code))
    and qs.deleted_at is null;

  if v_session.id is null then
    raise exception 'Quiz session not found';
  end if;

  v_allow := coalesce((v_session.settings_json->>'allow_late_join')::boolean, true);

  if v_session.status = 'ended' then
    raise exception 'Quiz session has ended';
  end if;

  if v_session.status = 'draft' and not v_allow then
    raise exception 'Quiz session is not live';
  end if;

  if v_session.status = 'live'
     and not v_allow
     and coalesce(v_session.current_question_index, 0) > 0 then
    raise exception 'Late join is closed';
  end if;

  if v_session.status not in ('live', 'draft') then
    raise exception 'Quiz session is not live';
  end if;

  select count(*) into v_count
  from public.quiz_participants p
  where p.session_id = v_session.id
    and p.deleted_at is null;

  if v_count >= 50 then
    raise exception 'Session is full';
  end if;

  v_color := v_palette[1 + floor(random() * array_length(v_palette, 1))::int];
  v_token := gen_random_uuid();
  v_profile := public.match_or_create_student_profile(v_session.host_id, p_display_name, p_student_code);

  insert into public.quiz_participants (
    session_id, display_name, participant_token, avatar_color, connected, student_profile_id
  )
  values (v_session.id, trim(p_display_name), v_token, v_color, true, v_profile)
  returning id into v_id;

  return query select
    v_id,
    v_session.id,
    v_token,
    v_color,
    v_session.host_id,
    coalesce(v_session.settings_json->>'host_token', '');
end;
$$;

revoke all on function public.join_quiz(text, text, text) from public;
grant execute on function public.join_quiz(text, text, text) to anon, authenticated, service_role;

create or replace function public.join_game_by_code(
  p_join_code text,
  p_display_name text,
  p_student_code text default null
)
returns table (
  instance_id uuid,
  session_id uuid,
  participant_id uuid,
  participant_token uuid,
  avatar_color text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_instance public.game_instances%rowtype;
  v_joined record;
begin
  select * into v_instance
  from public.game_instances gi
  where upper(gi.join_code) = upper(trim(p_join_code))
    and gi.deleted_at is null;

  if v_instance.id is null then
    -- Fall back to a live quiz session that has not been linked yet.
    select qs.id into v_instance.quiz_session_id
    from public.quiz_sessions qs
    where upper(qs.join_code) = upper(trim(p_join_code))
      and qs.deleted_at is null
    limit 1;
    if v_instance.quiz_session_id is null then
      raise exception 'Game not found';
    end if;
  elsif v_instance.status in ('ended', 'abandoned') then
    raise exception 'Game session has ended';
  elsif v_instance.quiz_session_id is null then
    raise exception 'Game is not live yet';
  end if;

  select * into v_joined
  from public.join_quiz(p_join_code, p_display_name, p_student_code);

  if v_instance.id is not null then
    update public.game_instances
    set participant_count = (
      select count(*)::int from public.quiz_participants
      where session_id = v_joined.session_id and deleted_at is null
    )
    where id = v_instance.id;
  end if;

  return query select
    v_instance.id,
    v_joined.session_id,
    v_joined.participant_id,
    v_joined.participant_token,
    v_joined.avatar_color;
end;
$$;

revoke all on function public.join_game_by_code(text, text, text) from public;
grant execute on function public.join_game_by_code(text, text, text) to anon, authenticated, service_role;

create or replace function public.refresh_student_performance(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class uuid;
begin
  select coalesce(qp.class_id, q.class_id) into v_class
  from public.quiz_sessions qs
  left join public.question_pools qp on qp.id = qs.pool_id
  left join public.questions q on q.id = (
    select r.question_id from public.quiz_responses r
    where r.session_id = qs.id and r.deleted_at is null
    limit 1
  )
  where qs.id = p_session_id;

  if v_class is null then
    return;
  end if;

  insert into public.student_performance (
    student_profile_id, class_id, standard_id, attempts, correct, accuracy, avg_ms, weakness_score, last_practiced_at
  )
  select
    p.student_profile_id,
    v_class,
    q.standard_id,
    count(*)::int,
    count(*) filter (where r.is_correct)::int,
    round((100.0 * count(*) filter (where r.is_correct) / greatest(count(*), 1))::numeric, 2),
    coalesce(avg(r.ms_taken)::int, 0),
    round((1 - (count(*) filter (where r.is_correct)::numeric / greatest(count(*), 1)))::numeric, 3),
    now()
  from public.quiz_responses r
  join public.quiz_participants p on p.id = r.participant_id
  join public.questions q on q.id = r.question_id
  where r.session_id = p_session_id
    and p.student_profile_id is not null
    and q.standard_id is not null
    and r.deleted_at is null
  group by p.student_profile_id, q.standard_id
  on conflict (student_profile_id, class_id, standard_id) do update
  set
    attempts = public.student_performance.attempts + excluded.attempts,
    correct = public.student_performance.correct + excluded.correct,
    accuracy = round(
      (100.0 * (public.student_performance.correct + excluded.correct)
        / greatest(public.student_performance.attempts + excluded.attempts, 1))::numeric,
      2
    ),
    avg_ms = excluded.avg_ms,
    weakness_score = excluded.weakness_score,
    last_practiced_at = excluded.last_practiced_at,
    updated_at = now();
end;
$$;

create or replace function public.finalize_game_instance(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid;
  v_count int;
  v_avg numeric;
  v_started timestamptz;
  v_template uuid;
begin
  select host_id, started_at into v_host, v_started
  from public.quiz_sessions
  where id = p_session_id and deleted_at is null;
  if v_host is null then
    return;
  end if;
  if auth.uid() is not null and auth.uid() <> v_host then
    raise exception 'Not the host';
  end if;

  select count(*)::int, avg(score)
    into v_count, v_avg
  from public.quiz_participants
  where session_id = p_session_id and deleted_at is null;

  update public.game_instances
  set
    status = 'ended',
    ended_at = coalesce(ended_at, now()),
    participant_count = v_count,
    avg_score = v_avg,
    duration_seconds = greatest(0, extract(epoch from (now() - coalesce(started_at, v_started, created_at)))::int),
    updated_at = now()
  where quiz_session_id = p_session_id
    and deleted_at is null
  returning template_id into v_template;

  if v_template is not null then
    update public.game_templates
    set play_count = play_count + 1, last_played_at = now()
    where id = v_template;
  end if;

  perform public.refresh_student_performance(p_session_id);
end;
$$;

revoke all on function public.finalize_game_instance(uuid) from public;
grant execute on function public.finalize_game_instance(uuid) to authenticated, service_role;

-- Write points_earned on reveal.
create or replace function public.quiz_apply_reveal(p_session_id uuid, p_question_id uuid, p_correct_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid;
  v_settings jsonb;
  v_time_ms int;
  rec record;
  v_correct boolean;
  v_ms int;
  v_bonus int;
  v_streak_bonus int;
  v_delta int;
begin
  select host_id, settings_json, greatest(1, coalesce(time_per_q, 30)) * 1000
    into v_host, v_settings, v_time_ms
  from public.quiz_sessions
  where id = p_session_id and deleted_at is null;
  if v_host is null then
    raise exception 'Session not found';
  end if;
  if auth.uid() is not null and auth.uid() <> v_host then
    raise exception 'Not the host';
  end if;

  if coalesce(v_settings->>'last_revealed_question_id', '') = p_question_id::text
     or coalesce(v_settings->'scored_question_ids', '[]'::jsonb) ? p_question_id::text then
    update public.quiz_sessions
    set reveal_answer = true, updated_at = now()
    where id = p_session_id;
    return;
  end if;

  update public.quiz_sessions
  set
    reveal_answer = true,
    settings_json = coalesce(settings_json, '{}'::jsonb)
      || jsonb_build_object('last_revealed_question_id', p_question_id::text, 'paused_at', null)
      || jsonb_build_object(
        'scored_question_ids',
        coalesce(settings_json->'scored_question_ids', '[]'::jsonb) || jsonb_build_array(p_question_id::text)
      ),
    updated_at = now()
  where id = p_session_id;

  update public.quiz_responses
  set
    is_correct = (
      upper(coalesce(choice_key, answer, '')) = upper(coalesce(p_correct_key, ''))
    ),
    revealed_at = now(),
    updated_at = now()
  where session_id = p_session_id
    and question_id = p_question_id
    and deleted_at is null;

  for rec in
    select p.id, p.streak
    from public.quiz_participants p
    where p.session_id = p_session_id
      and p.deleted_at is null
  loop
    v_correct := false;
    v_ms := v_time_ms;
    select
      coalesce(r.is_correct, false),
      coalesce(r.ms_taken, v_time_ms)
      into v_correct, v_ms
    from public.quiz_responses r
    where r.participant_id = rec.id
      and r.question_id = p_question_id
      and r.deleted_at is null;

    if v_correct then
      v_bonus := least(100, greatest(0, round(100 * (1 - least(v_ms, v_time_ms)::numeric / v_time_ms))::int));
      v_streak_bonus := 20 * greatest(0, rec.streak);
      v_delta := 100 + v_bonus + v_streak_bonus;
      update public.quiz_responses
      set points_earned = v_delta
      where participant_id = rec.id and question_id = p_question_id and deleted_at is null;
      update public.quiz_participants
      set
        score = score + v_delta,
        streak = rec.streak + 1,
        last_correct_at = now() - (v_ms || ' milliseconds')::interval,
        updated_at = now()
      where id = rec.id;
    else
      update public.quiz_responses
      set points_earned = 0
      where participant_id = rec.id and question_id = p_question_id and deleted_at is null;
      update public.quiz_participants
      set streak = 0, updated_at = now()
      where id = rec.id;
    end if;
  end loop;
end;
$$;

-- Backfill templates + instances from existing sessions.
do $$
declare
  rec record;
  v_tid uuid;
  v_code text;
begin
  for rec in
    select
      qs.id,
      qs.host_id,
      qs.pool_id,
      qs.join_code,
      qs.status,
      qs.started_at,
      qs.ended_at,
      qs.time_per_q,
      qs.settings_json,
      qs.created_at,
      qp.class_id,
      qp.name as pool_name
    from public.quiz_sessions qs
    join public.question_pools qp on qp.id = qs.pool_id
    where qs.deleted_at is null
      and not exists (
        select 1 from public.game_instances gi where gi.quiz_session_id = qs.id
      )
  loop
    insert into public.game_templates (
      class_id, owner_id, name, description, tags, mode, pool_id, filter_json, settings_json, version, play_count, last_played_at
    ) values (
      rec.class_id,
      rec.host_id,
      coalesce(rec.pool_name, 'Quiz') || ' (auto)',
      'Imported from a live quiz session.',
      array['auto'],
      'jeopardy',
      rec.pool_id,
      '{}'::jsonb,
      coalesce(rec.settings_json, '{}'::jsonb) || jsonb_build_object('time_per_q', rec.time_per_q),
      1,
      case when rec.status = 'ended' then 1 else 0 end,
      rec.ended_at
    )
    returning id into v_tid;

    v_code := rec.join_code;
    if exists (select 1 from public.game_instances where join_code = v_code) then
      v_code := substr(replace(rec.id::text, '-', ''), 1, 6);
    end if;

    insert into public.game_instances (
      template_id, template_version, host_id, quiz_session_id, join_code, host_token, status,
      started_at, ended_at, settings_snapshot
    ) values (
      v_tid,
      1,
      rec.host_id,
      rec.id,
      v_code,
      coalesce((rec.settings_json->>'host_token')::uuid, gen_random_uuid()),
      case
        when rec.status = 'ended' then 'ended'
        when rec.status = 'live' then 'live'
        else 'lobby'
      end,
      rec.started_at,
      rec.ended_at,
      jsonb_build_object(
        'settings', coalesce(rec.settings_json, '{}'::jsonb),
        'time_per_q', rec.time_per_q,
        'mode', 'jeopardy',
        'question_ids', coalesce(rec.settings_json->'question_ids', '[]'::jsonb)
      )
    );
  end loop;
end;
$$;

-- Backfill student profiles from participants.
do $$
declare
  rec record;
  v_profile uuid;
begin
  for rec in
    select
      p.id,
      p.display_name,
      qs.host_id
    from public.quiz_participants p
    join public.quiz_sessions qs on qs.id = p.session_id
    where p.deleted_at is null
      and p.student_profile_id is null
      and p.display_name is not null
  loop
    v_profile := public.match_or_create_student_profile(rec.host_id, rec.display_name, null);
    update public.quiz_participants set student_profile_id = v_profile where id = rec.id;
  end loop;
end;
$$;

update public.quiz_responses r
set points_earned = case
  when coalesce(r.is_correct, false) then
    100 + least(
      100,
      greatest(
        0,
        round(
          100 * (
            1 - least(coalesce(r.ms_taken, greatest(1, coalesce(qs.time_per_q, 30) * 1000)), greatest(1, coalesce(qs.time_per_q, 30) * 1000))::numeric
              / greatest(1, coalesce(qs.time_per_q, 30) * 1000)
          )
        )::int
      )
    )
  else 0
end
from public.quiz_sessions qs
where qs.id = r.session_id
  and r.points_earned = 0;
