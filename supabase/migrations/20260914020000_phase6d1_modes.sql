-- Phase 6D.1: mode_config, teams, Rapid Fire + Team Battle scoring RPCs.

alter table public.game_templates
  add column if not exists mode_config jsonb not null default '{}'::jsonb;

alter table public.game_instances
  add column if not exists team_assignment_mode text not null default 'auto';

alter table public.game_instances
  drop constraint if exists game_instances_team_assignment_mode_check;
alter table public.game_instances
  add constraint game_instances_team_assignment_mode_check
  check (team_assignment_mode in ('auto', 'manual', 'self_select'));

alter table public.quiz_participants
  add column if not exists team_id text,
  add column if not exists team_role text;

alter table public.quiz_sessions
  drop constraint if exists quiz_sessions_mode_check;
alter table public.quiz_sessions
  add constraint quiz_sessions_mode_check
  check (mode in (
    'jeopardy',
    'standard',
    'rapid_fire',
    'team_battle',
    'case_study',
    'adaptive',
    'boss_battle'
  ));

create table if not exists public.game_teams (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.game_instances (id) on delete cascade,
  team_key text not null,
  name text not null,
  color text not null,
  created_at timestamptz not null default now(),
  unique (instance_id, team_key)
);

create index if not exists game_teams_instance_idx on public.game_teams (instance_id);
create index if not exists quiz_participants_team_idx on public.quiz_participants (session_id, team_id);

alter table public.game_teams enable row level security;

drop policy if exists game_teams_host_all on public.game_teams;
create policy game_teams_host_all on public.game_teams
  for all to authenticated
  using (
    exists (
      select 1 from public.game_instances gi
      where gi.id = instance_id and gi.host_id = auth.uid() and gi.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.game_instances gi
      where gi.id = instance_id and gi.host_id = auth.uid() and gi.deleted_at is null
    )
  );

do $$
begin
  begin
    alter publication supabase_realtime add table public.game_teams;
  exception
    when duplicate_object then null;
  end;
end;
$$;

create or replace function public.quiz_ensure_teams(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_instance public.game_instances%rowtype;
  v_count int;
  v_settings jsonb;
  i int;
  v_palette text[][] := array[
    array['red', 'Red', '#DC2626'],
    array['blue', 'Blue', '#2563EB'],
    array['green', 'Green', '#16A34A'],
    array['yellow', 'Yellow', '#CA8A04']
  ];
begin
  select * into v_instance
  from public.game_instances
  where quiz_session_id = p_session_id and deleted_at is null
  limit 1;
  if v_instance.id is null then
    return;
  end if;

  select settings_json into v_settings
  from public.quiz_sessions
  where id = p_session_id;

  v_count := coalesce(
    (v_settings->'mode_config'->>'team_count')::int,
    (v_instance.settings_snapshot->'mode_config'->>'team_count')::int,
    4
  );
  if v_count < 2 then v_count := 2; end if;
  if v_count > 4 then v_count := 4; end if;

  for i in 1..v_count loop
    insert into public.game_teams (instance_id, team_key, name, color)
    values (v_instance.id, v_palette[i][1], v_palette[i][2], v_palette[i][3])
    on conflict (instance_id, team_key) do nothing;
  end loop;
end;
$$;

revoke all on function public.quiz_ensure_teams(uuid) from public;
grant execute on function public.quiz_ensure_teams(uuid) to authenticated, service_role;

create or replace function public.quiz_assign_join_team(
  p_session_id uuid,
  p_participant_id uuid,
  p_team_key text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text;
  v_instance uuid;
  v_assign text;
  v_key text;
begin
  select qs.mode, gi.id, coalesce(gi.team_assignment_mode, 'auto')
    into v_mode, v_instance, v_assign
  from public.quiz_sessions qs
  left join public.game_instances gi
    on gi.quiz_session_id = qs.id and gi.deleted_at is null
  where qs.id = p_session_id;

  if v_mode is distinct from 'team_battle' or v_instance is null then
    return null;
  end if;

  perform public.quiz_ensure_teams(p_session_id);

  if p_team_key is not null and exists (
    select 1 from public.game_teams t
    where t.instance_id = v_instance and t.team_key = p_team_key
  ) then
    v_key := p_team_key;
  else
    select t.team_key into v_key
    from public.game_teams t
    left join public.quiz_participants p
      on p.session_id = p_session_id
     and p.team_id = t.team_key
     and p.deleted_at is null
     and p.id is distinct from p_participant_id
    where t.instance_id = v_instance
    group by t.team_key, t.created_at
    order by count(p.id), t.created_at
    limit 1;
  end if;

  if v_key is null then
    return null;
  end if;

  update public.quiz_participants
  set team_id = v_key, updated_at = now()
  where id = p_participant_id;

  return v_key;
end;
$$;

revoke all on function public.quiz_assign_join_team(uuid, uuid, text) from public;
grant execute on function public.quiz_assign_join_team(uuid, uuid, text) to anon, authenticated, service_role;

create or replace function public.quiz_reassign_team(
  p_session_id uuid,
  p_participant_id uuid,
  p_team_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid;
begin
  select host_id into v_host
  from public.quiz_sessions
  where id = p_session_id and deleted_at is null;
  if v_host is null then
    raise exception 'Session not found';
  end if;
  if auth.uid() is not null and auth.uid() <> v_host then
    raise exception 'Not the host';
  end if;

  perform public.quiz_assign_join_team(p_session_id, p_participant_id, p_team_key);
end;
$$;

revoke all on function public.quiz_reassign_team(uuid, uuid, text) from public;
grant execute on function public.quiz_reassign_team(uuid, uuid, text) to authenticated, service_role;

-- Keep a single join_quiz signature so PostgREST can resolve 2-arg calls.
drop function if exists public.join_quiz(text, text);
create or replace function public.join_quiz(
  p_join_code text,
  p_display_name text,
  p_student_code text default null
)
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
  v_allow boolean;
  v_count int;
  v_color text;
  v_token uuid;
  v_id uuid;
  v_profile uuid;
  v_palette text[] := array['#C9A227','#E07A3D','#2A9D8F','#4C8BF5','#9B5DE5','#E63946'];
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

  perform public.quiz_assign_join_team(v_session.id, v_id, null);

  return query select
    v_id,
    v_session.id,
    v_token,
    v_color,
    v_session.host_id,
    coalesce(v_session.settings_json->>'host_token', '');
end;
$$;

drop function if exists public.join_game_by_code(text, text, text);
create or replace function public.join_game_by_code(
  p_join_code text,
  p_display_name text,
  p_student_code text default null,
  p_team_key text default null
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
  v_session uuid;
  v_participant uuid;
  v_token uuid;
  v_color text;
begin
  select * into v_instance
  from public.game_instances gi
  where upper(gi.join_code) = upper(trim(p_join_code))
    and gi.deleted_at is null;

  if v_instance.id is null then
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

  v_session := v_joined.session_id;
  v_participant := v_joined.participant_id;
  v_token := v_joined.participant_token;
  v_color := v_joined.avatar_color;

  if p_team_key is not null then
    perform public.quiz_assign_join_team(v_session, v_participant, p_team_key);
  end if;

  if v_instance.id is not null then
    update public.game_instances
    set participant_count = (
      select count(*)::int from public.quiz_participants qp
      where qp.session_id = v_session and qp.deleted_at is null
    )
    where id = v_instance.id;
  end if;

  return query select
    v_instance.id,
    v_session,
    v_participant,
    v_token,
    v_color;
end;
$$;

revoke all on function public.join_game_by_code(text, text, text, text) from public;
grant execute on function public.join_game_by_code(text, text, text, text) to anon, authenticated, service_role;

drop function if exists public.lookup_quiz_by_code(text);
create or replace function public.lookup_quiz_by_code(p_code text)
returns table (
  session_id uuid,
  pool_name text,
  host_name text,
  participant_count int,
  status text,
  join_code text,
  time_per_q int,
  mode text,
  team_assignment_mode text,
  teams jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    qs.id,
    coalesce(qp.name, qs.settings_json->>'name', 'Game'),
    coalesce(u.name, u.email, 'Instructor'),
    (
      select count(*)::int
      from public.quiz_participants p
      where p.session_id = qs.id and p.deleted_at is null
    ),
    qs.status,
    qs.join_code,
    qs.time_per_q,
    qs.mode,
    coalesce(gi.team_assignment_mode, 'auto'),
    coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'team_key', t.team_key,
          'name', t.name,
          'color', t.color
        ) order by t.created_at)
        from public.game_teams t
        where t.instance_id = gi.id
      ),
      '[]'::jsonb
    )
  from public.quiz_sessions qs
  left join public.question_pools qp on qp.id = qs.pool_id
  join public.users u on u.id = qs.host_id
  left join public.game_instances gi
    on gi.quiz_session_id = qs.id and gi.deleted_at is null
  where upper(qs.join_code) = upper(trim(p_code))
    and qs.deleted_at is null
  limit 1;
$$;

revoke all on function public.lookup_quiz_by_code(text) from public;
grant execute on function public.lookup_quiz_by_code(text) to anon, authenticated, service_role;

drop function if exists public.get_participant_by_token(uuid);
create or replace function public.get_participant_by_token(p_token uuid)
returns table (
  id uuid,
  session_id uuid,
  display_name text,
  score int,
  streak int,
  avatar_color text,
  join_code text,
  status text,
  host_id uuid,
  host_token text,
  team_id text,
  team_role text,
  team_name text,
  team_color text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.session_id,
    p.display_name,
    p.score,
    p.streak,
    p.avatar_color,
    qs.join_code,
    qs.status,
    qs.host_id,
    coalesce(qs.settings_json->>'host_token', ''),
    p.team_id,
    p.team_role,
    t.name,
    t.color
  from public.quiz_participants p
  join public.quiz_sessions qs on qs.id = p.session_id
  left join public.game_instances gi
    on gi.quiz_session_id = qs.id and gi.deleted_at is null
  left join public.game_teams t
    on t.instance_id = gi.id and t.team_key = p.team_id
  where p.participant_token = p_token
    and p.deleted_at is null
  limit 1;
$$;

revoke all on function public.get_participant_by_token(uuid) from public;
grant execute on function public.get_participant_by_token(uuid) to anon, authenticated, service_role;

drop function if exists public.submit_answer(uuid, uuid, text, int);
create or replace function public.submit_answer(
  p_participant_token uuid,
  p_question_id uuid,
  p_choice_key text,
  p_ms_taken int
)
returns table (ok boolean, already_answered boolean, is_correct boolean, points int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant public.quiz_participants%rowtype;
  v_session public.quiz_sessions%rowtype;
  v_current uuid;
  v_existing uuid;
  v_correct boolean := false;
  v_points int := 0;
  v_key text;
  v_ids jsonb;
  v_total int;
  v_max int;
  v_answered int;
  v_penalty int;
  v_base int;
  v_unlimited boolean;
  v_start timestamptz;
begin
  select * into v_participant
  from public.quiz_participants
  where participant_token = p_participant_token
    and deleted_at is null;

  if v_participant.id is null then
    raise exception 'Invalid participant token';
  end if;

  select * into v_session
  from public.quiz_sessions
  where id = v_participant.session_id
    and deleted_at is null;

  if v_session.id is null or v_session.status <> 'live' then
    raise exception 'Quiz session is not live';
  end if;

  v_ids := coalesce(v_session.settings_json->'question_ids', '[]'::jsonb);

  if v_session.mode = 'rapid_fire' then
    v_total := coalesce(
      (v_session.settings_json->'mode_config'->>'total_time_seconds')::int,
      v_session.time_per_q,
      60
    );
    v_start := coalesce((v_session.settings_json->>'game_started_at')::timestamptz, null);
    if v_start is null then
      raise exception 'Game has not started';
    end if;
    if now() > v_start + make_interval(secs => v_total) then
      raise exception 'Game clock has ended';
    end if;

    if not exists (
      select 1 from jsonb_array_elements_text(v_ids) qid
      where qid = p_question_id::text
    ) then
      raise exception 'Not a session question';
    end if;

    v_unlimited := coalesce((v_session.settings_json->'mode_config'->>'questions_unlimited')::boolean, true);
    v_max := coalesce((v_session.settings_json->'mode_config'->>'questions_max')::int, 30);
    if not v_unlimited then
      select count(*)::int into v_answered
      from public.quiz_responses
      where participant_id = v_participant.id and deleted_at is null;
      if v_answered >= v_max then
        raise exception 'Question cap reached';
      end if;
    end if;
  else
    if coalesce(v_session.reveal_answer, false) then
      raise exception 'Question is closed';
    end if;

    v_current := (v_ids->>v_session.current_question_index)::uuid;
    if v_current is null or v_current is distinct from p_question_id then
      raise exception 'Not the current question';
    end if;
  end if;

  select r.id into v_existing
  from public.quiz_responses r
  where r.participant_id = v_participant.id
    and r.question_id = p_question_id
    and r.deleted_at is null;

  if v_existing is not null then
    return query select true, true, coalesce((
      select r.is_correct from public.quiz_responses r where r.id = v_existing
    ), false), coalesce((
      select r.points_earned from public.quiz_responses r where r.id = v_existing
    ), 0);
    return;
  end if;

  if v_session.mode = 'rapid_fire' then
    select q.answer_key into v_key from public.questions q where q.id = p_question_id;
    v_correct := upper(coalesce(nullif(trim(coalesce(p_choice_key, '')), ''), '')) = upper(coalesce(v_key, ''));
    v_base := coalesce((v_session.settings_json->'mode_config'->>'score_per_correct')::int, 100);
    v_penalty := coalesce((v_session.settings_json->'mode_config'->>'wrong_answer_penalty')::int, 0);
    if v_correct then
      v_points := v_base;
    else
      v_points := -abs(v_penalty);
    end if;

    insert into public.quiz_responses (
      session_id, participant_id, question_id, answer, choice_key, ms_taken, is_correct, points_earned, revealed_at
    )
    values (
      v_session.id,
      v_participant.id,
      p_question_id,
      nullif(trim(coalesce(p_choice_key, '')), ''),
      nullif(trim(coalesce(p_choice_key, '')), ''),
      p_ms_taken,
      v_correct,
      v_points,
      now()
    );

    update public.quiz_participants
    set
      score = score + v_points,
      streak = case when v_correct then streak + 1 else 0 end,
      last_correct_at = case when v_correct then now() - (greatest(p_ms_taken, 0) || ' milliseconds')::interval else last_correct_at end,
      updated_at = now()
    where id = v_participant.id;

    return query select true, false, v_correct, v_points;
    return;
  end if;

  insert into public.quiz_responses (
    session_id,
    participant_id,
    question_id,
    answer,
    choice_key,
    ms_taken,
    is_correct
  )
  values (
    v_session.id,
    v_participant.id,
    p_question_id,
    nullif(trim(coalesce(p_choice_key, '')), ''),
    nullif(trim(coalesce(p_choice_key, '')), ''),
    p_ms_taken,
    null
  );

  return query select true, false, null::boolean, 0;
end;
$$;

revoke all on function public.submit_answer(uuid, uuid, text, int) from public;
grant execute on function public.submit_answer(uuid, uuid, text, int) to anon, authenticated, service_role;

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
  v_mode text;
  rec record;
  v_correct boolean;
  v_ms int;
  v_bonus int;
  v_streak_bonus int;
  v_delta int;
  v_base int;
  v_time_on boolean;
  v_streak_on boolean;
begin
  select host_id, settings_json, greatest(1, coalesce(time_per_q, 30)) * 1000, mode
    into v_host, v_settings, v_time_ms, v_mode
  from public.quiz_sessions
  where id = p_session_id and deleted_at is null;
  if v_host is null then
    raise exception 'Session not found';
  end if;
  if auth.uid() is not null and auth.uid() <> v_host then
    raise exception 'Not the host';
  end if;

  if v_mode = 'rapid_fire' then
    return;
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

  v_base := coalesce(
    (v_settings->'mode_config'->>'base_points')::int,
    (v_settings->>'base_points')::int,
    100
  );
  v_time_on := coalesce(
    (v_settings->'mode_config'->>'time_bonus')::boolean,
    (v_settings->>'time_bonus')::boolean,
    true
  );
  v_streak_on := coalesce(
    (v_settings->'mode_config'->>'streak_bonus')::boolean,
    (v_settings->>'streak_bonus')::boolean,
    true
  );

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
      v_bonus := case when v_time_on
        then least(100, greatest(0, round(100 * (1 - least(v_ms, v_time_ms)::numeric / v_time_ms))::int))
        else 0 end;
      v_streak_bonus := case when v_streak_on then 20 * greatest(0, rec.streak) else 0 end;
      v_delta := v_base + v_bonus + v_streak_bonus;
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

create or replace function public.quiz_set_question(p_session_id uuid, p_index int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid;
  v_mode text;
  v_settings jsonb;
begin
  select host_id, mode, settings_json
    into v_host, v_mode, v_settings
  from public.quiz_sessions
  where id = p_session_id and deleted_at is null;
  if v_host is null then
    raise exception 'Session not found';
  end if;
  if auth.uid() is not null and auth.uid() <> v_host then
    raise exception 'Not the host';
  end if;

  if v_mode = 'rapid_fire' and coalesce(v_settings->>'game_started_at', '') = '' then
    v_settings := coalesce(v_settings, '{}'::jsonb) || jsonb_build_object('game_started_at', now()::text);
  end if;

  update public.quiz_sessions
  set
    current_question_index = greatest(0, p_index),
    reveal_answer = false,
    status = 'live',
    started_at = coalesce(started_at, now()),
    settings_json = coalesce(v_settings, settings_json),
    updated_at = now()
  where id = p_session_id;
end;
$$;

