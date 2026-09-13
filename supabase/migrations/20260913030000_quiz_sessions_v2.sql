-- Phase 6 Session A: live quiz session columns, join token, answer RPCs.

alter table public.quiz_sessions
  add column if not exists current_question_index int not null default 0,
  add column if not exists started_at timestamptz,
  add column if not exists ended_at timestamptz,
  add column if not exists reveal_answer boolean not null default false,
  add column if not exists settings_json jsonb not null default '{}'::jsonb;

alter table public.quiz_responses
  add column if not exists choice_key text,
  add column if not exists is_correct boolean,
  add column if not exists revealed_at timestamptz;

alter table public.quiz_participants
  add column if not exists participant_token uuid not null default gen_random_uuid(),
  add column if not exists score int not null default 0,
  add column if not exists streak int not null default 0,
  add column if not exists last_correct_at timestamptz,
  add column if not exists connected boolean not null default false,
  add column if not exists avatar_color text;

create unique index if not exists quiz_participants_token_idx
  on public.quiz_participants (participant_token);

create unique index if not exists quiz_responses_one_per_question_idx
  on public.quiz_responses (participant_id, question_id)
  where deleted_at is null;

create or replace view public.quiz_session_summary as
select
  qs.id as session_id,
  qs.pool_id,
  qs.host_id,
  qs.mode,
  qs.time_per_q,
  qs.status,
  qs.join_code,
  (
    select count(*)::int
    from public.quiz_participants p
    where p.session_id = qs.id
      and p.deleted_at is null
  ) as participant_count,
  qs.current_question_index,
  qs.started_at,
  qs.ended_at
from public.quiz_sessions qs
where qs.deleted_at is null;

grant select on public.quiz_session_summary to authenticated, service_role;

drop policy if exists quiz_sessions_instructor_all on public.quiz_sessions;
create policy quiz_sessions_instructor_all on public.quiz_sessions
  for all to authenticated
  using (host_id = auth.uid() or public.owns_question_pool(pool_id))
  with check (host_id = auth.uid() or public.owns_question_pool(pool_id));

drop policy if exists quiz_participants_anon_insert on public.quiz_participants;
drop policy if exists quiz_responses_anon_insert on public.quiz_responses;

drop policy if exists quiz_participants_self_select on public.quiz_participants;
create policy quiz_participants_self_select on public.quiz_participants
  for select to anon, authenticated
  using (
    participant_token is not null
    and id::text = coalesce(current_setting('request.jwt.claims', true)::json->>'quiz_participant_id', '')
  );

-- Players read their own row via get_participant_by_token, not table SELECT.
-- Session B leaderboard uses get_final_leaderboard.

drop function if exists public.join_quiz(text, text);

create or replace function public.join_quiz(p_join_code text, p_display_name text)
returns table (
  participant_id uuid,
  session_id uuid,
  participant_token uuid,
  avatar_color text
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

  return query select v_id, v_session.id, v_token, v_color;
end;
$$;

revoke all on function public.join_quiz(text, text) from public;
grant execute on function public.join_quiz(text, text) to anon, authenticated, service_role;

create or replace function public.lookup_quiz_by_code(p_code text)
returns table (
  session_id uuid,
  pool_name text,
  host_name text,
  participant_count int,
  status text,
  join_code text,
  time_per_q int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    qs.id,
    qp.name,
    coalesce(u.name, u.email, 'Instructor'),
    (
      select count(*)::int
      from public.quiz_participants p
      where p.session_id = qs.id and p.deleted_at is null
    ),
    qs.status,
    qs.join_code,
    qs.time_per_q
  from public.quiz_sessions qs
  join public.question_pools qp on qp.id = qs.pool_id
  join public.users u on u.id = qs.host_id
  where upper(qs.join_code) = upper(trim(p_code))
    and qs.deleted_at is null
  limit 1;
$$;

revoke all on function public.lookup_quiz_by_code(text) from public;
grant execute on function public.lookup_quiz_by_code(text) to anon, authenticated, service_role;

create or replace function public.get_participant_by_token(p_token uuid)
returns table (
  id uuid,
  session_id uuid,
  display_name text,
  score int,
  streak int,
  avatar_color text,
  join_code text,
  status text
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
    qs.status
  from public.quiz_participants p
  join public.quiz_sessions qs on qs.id = p.session_id
  where p.participant_token = p_token
    and p.deleted_at is null
  limit 1;
$$;

revoke all on function public.get_participant_by_token(uuid) from public;
grant execute on function public.get_participant_by_token(uuid) to anon, authenticated, service_role;

create or replace function public.submit_answer(
  p_participant_token uuid,
  p_question_id uuid,
  p_choice_key text,
  p_ms_taken int
)
returns table (ok boolean, already_answered boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant public.quiz_participants%rowtype;
  v_session public.quiz_sessions%rowtype;
  v_current uuid;
  v_existing uuid;
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

  if coalesce(v_session.reveal_answer, false) then
    raise exception 'Question is closed';
  end if;

  v_current := (v_session.settings_json->'question_ids'->>v_session.current_question_index)::uuid;
  if v_current is null or v_current is distinct from p_question_id then
    raise exception 'Not the current question';
  end if;

  select r.id into v_existing
  from public.quiz_responses r
  where r.participant_id = v_participant.id
    and r.question_id = p_question_id
    and r.deleted_at is null;

  if v_existing is not null then
    return query select true, true;
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

  return query select true, false;
end;
$$;

revoke all on function public.submit_answer(uuid, uuid, text, int) from public;
grant execute on function public.submit_answer(uuid, uuid, text, int) to anon, authenticated, service_role;

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
    updated_at = now()
  where id = p_session_id;
end;
$$;

revoke all on function public.quiz_set_question(uuid, int) from public;
grant execute on function public.quiz_set_question(uuid, int) to authenticated, service_role;

create or replace function public.quiz_apply_reveal(p_session_id uuid, p_question_id uuid, p_correct_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid;
  v_settings jsonb;
  v_already text;
begin
  select host_id, settings_json
    into v_host, v_settings
  from public.quiz_sessions
  where id = p_session_id and deleted_at is null;
  if v_host is null then
    raise exception 'Session not found';
  end if;
  if auth.uid() is not null and auth.uid() <> v_host then
    raise exception 'Not the host';
  end if;

  v_already := coalesce(v_settings->>'last_revealed_question_id', '');
  if v_already = p_question_id::text
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
      || jsonb_build_object('last_revealed_question_id', p_question_id::text)
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

  update public.quiz_participants p
  set
    score = p.score + case
      when exists (
        select 1 from public.quiz_responses r
        where r.participant_id = p.id
          and r.question_id = p_question_id
          and r.is_correct = true
      ) then 100 else 0
    end,
    streak = case
      when exists (
        select 1 from public.quiz_responses r
        where r.participant_id = p.id
          and r.question_id = p_question_id
          and r.is_correct = true
      ) then p.streak + 1 else 0
    end,
    last_correct_at = case
      when exists (
        select 1 from public.quiz_responses r
        where r.participant_id = p.id
          and r.question_id = p_question_id
          and r.is_correct = true
      ) then now() else p.last_correct_at
    end,
    updated_at = now()
  where p.session_id = p_session_id
    and p.deleted_at is null;
end;
$$;

revoke all on function public.quiz_apply_reveal(uuid, uuid, text) from public;
grant execute on function public.quiz_apply_reveal(uuid, uuid, text) to authenticated, service_role;

create or replace function public.quiz_end_session(p_session_id uuid)
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
  set status = 'ended', ended_at = now(), updated_at = now()
  where id = p_session_id;
end;
$$;

revoke all on function public.quiz_end_session(uuid) from public;
grant execute on function public.quiz_end_session(uuid) to authenticated, service_role;

create or replace function public.get_final_leaderboard(p_session_id uuid)
returns table (
  participant_id uuid,
  display_name text,
  score int,
  streak int,
  avatar_color text,
  rank int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.display_name,
    p.score,
    p.streak,
    p.avatar_color,
    dense_rank() over (order by p.score desc, p.last_correct_at asc nulls last)::int
  from public.quiz_participants p
  where p.session_id = p_session_id
    and p.deleted_at is null
  order by 6, p.display_name;
$$;

revoke all on function public.get_final_leaderboard(uuid) from public;
grant execute on function public.get_final_leaderboard(uuid) to anon, authenticated, service_role;

-- Broadcast does not require table replication. Add tables if the publication exists.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.quiz_sessions;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.quiz_participants;
    exception when duplicate_object then null;
    end;
  end if;
end;
$$;
