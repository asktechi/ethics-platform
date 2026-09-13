-- Phase 6 Session B: Jeopardy scoring, pause/skip, host token, analytics.

drop function if exists public.join_quiz(text, text);
create or replace function public.join_quiz(p_join_code text, p_display_name text)
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

  insert into public.quiz_participants (
    session_id, display_name, participant_token, avatar_color, connected
  )
  values (v_session.id, trim(p_display_name), v_token, v_color, true)
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

revoke all on function public.join_quiz(text, text) from public;
grant execute on function public.join_quiz(text, text) to anon, authenticated, service_role;

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
  host_token text
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
    coalesce(qs.settings_json->>'host_token', '')
  from public.quiz_participants p
  join public.quiz_sessions qs on qs.id = p.session_id
  where p.participant_token = p_token
    and p.deleted_at is null
  limit 1;
$$;

revoke all on function public.get_participant_by_token(uuid) from public;
grant execute on function public.get_participant_by_token(uuid) to anon, authenticated, service_role;

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
      update public.quiz_participants
      set
        score = score + v_delta,
        streak = rec.streak + 1,
        last_correct_at = now() - (v_ms || ' milliseconds')::interval,
        updated_at = now()
      where id = rec.id;
    else
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
begin
  select host_id into v_host from public.quiz_sessions where id = p_session_id and deleted_at is null;
  if v_host is null then
    raise exception 'Session not found';
  end if;
  if auth.uid() is not null and auth.uid() <> v_host then
    raise exception 'Not the host';
  end if;

  update public.quiz_sessions
  set
    current_question_index = greatest(0, p_index),
    reveal_answer = false,
    status = 'live',
    started_at = coalesce(started_at, now()),
    settings_json = coalesce(settings_json, '{}'::jsonb)
      || jsonb_build_object('paused_at', null, 'question_started_at', now()::text),
    updated_at = now()
  where id = p_session_id;
end;
$$;

create or replace function public.quiz_set_pause(p_session_id uuid, p_paused boolean, p_remaining_ms int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid;
begin
  select host_id into v_host from public.quiz_sessions where id = p_session_id and deleted_at is null;
  if v_host is null then
    raise exception 'Session not found';
  end if;
  if auth.uid() is not null and auth.uid() <> v_host then
    raise exception 'Not the host';
  end if;

  update public.quiz_sessions
  set
    settings_json = coalesce(settings_json, '{}'::jsonb)
      || jsonb_build_object(
        'paused_at', case when p_paused then now()::text else null end,
        'remaining_ms', case when p_paused then p_remaining_ms else null end
      ),
    updated_at = now()
  where id = p_session_id;
end;
$$;

revoke all on function public.quiz_set_pause(uuid, boolean, int) from public;
grant execute on function public.quiz_set_pause(uuid, boolean, int) to authenticated, service_role;

create or replace function public.quiz_skip_question(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid;
  v_index int;
begin
  select host_id, current_question_index
    into v_host, v_index
  from public.quiz_sessions
  where id = p_session_id and deleted_at is null;
  if v_host is null then
    raise exception 'Session not found';
  end if;
  if auth.uid() is not null and auth.uid() <> v_host then
    raise exception 'Not the host';
  end if;

  update public.quiz_sessions
  set
    current_question_index = v_index + 1,
    reveal_answer = false,
    settings_json = coalesce(settings_json, '{}'::jsonb)
      || jsonb_build_object('paused_at', null, 'question_started_at', now()::text),
    updated_at = now()
  where id = p_session_id;
end;
$$;

revoke all on function public.quiz_skip_question(uuid) from public;
grant execute on function public.quiz_skip_question(uuid) to authenticated, service_role;

create or replace function public.quiz_set_connected(p_session_id uuid, p_online_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid;
begin
  select host_id into v_host from public.quiz_sessions where id = p_session_id and deleted_at is null;
  if v_host is null then
    raise exception 'Session not found';
  end if;
  if auth.uid() is not null and auth.uid() <> v_host then
    raise exception 'Not the host';
  end if;

  update public.quiz_participants
  set connected = (id = any(coalesce(p_online_ids, '{}'::uuid[]))),
      updated_at = now()
  where session_id = p_session_id
    and deleted_at is null;
end;
$$;

revoke all on function public.quiz_set_connected(uuid, uuid[]) from public;
grant execute on function public.quiz_set_connected(uuid, uuid[]) to authenticated, service_role;

revoke all on function public.quiz_apply_reveal(uuid, uuid, text) from public;
grant execute on function public.quiz_apply_reveal(uuid, uuid, text) to authenticated, service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.quiz_responses;
    exception when duplicate_object then null;
    end;
  end if;
end;
$$;
