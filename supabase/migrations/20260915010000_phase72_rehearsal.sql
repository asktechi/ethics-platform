-- Phase 7.2: rehearsal mode columns. No new tables (health stays 30).

alter table public.game_instances
  add column if not exists is_rehearsal boolean not null default false,
  add column if not exists rehearsal_config jsonb not null default '{}'::jsonb;

comment on column public.game_instances.is_rehearsal is 'Practice session with simulated students. Excluded from lists, play_count, and analytics.';
comment on column public.game_instances.rehearsal_config is '{ bot_count, bot_profiles, fast_forward, time_multiplier, question_scope, bots[] }';

create index if not exists idx_game_instances_rehearsal
  on public.game_instances (is_rehearsal)
  where deleted_at is null;

alter table public.quiz_participants
  add column if not exists is_bot boolean not null default false;

create index if not exists quiz_participants_bot_idx
  on public.quiz_participants (session_id)
  where is_bot and deleted_at is null;

-- Rehearsal sessions must never increment play_count or write student_performance.
create or replace function public.refresh_student_performance(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class uuid;
begin
  -- TODO(Phase 6E): analytics aggregations must also exclude is_rehearsal instances.
  if exists (
    select 1 from public.game_instances gi
    where gi.quiz_session_id = p_session_id and gi.is_rehearsal = true
  ) then
    return;
  end if;

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
    and coalesce(p.is_bot, false) = false
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
  v_rehearsal boolean;
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

  select coalesce(is_rehearsal, false) into v_rehearsal
  from public.game_instances
  where quiz_session_id = p_session_id
    and deleted_at is null
  limit 1;

  if v_rehearsal then
    -- Practice data is discarded via end_rehearsal, never counted as a play.
    return;
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

-- Hard-delete a rehearsal instance and its session children. Host-only.
create or replace function public.end_rehearsal(p_instance_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid;
  v_session uuid;
  v_rehearsal boolean;
begin
  select host_id, quiz_session_id, is_rehearsal
    into v_host, v_session, v_rehearsal
  from public.game_instances
  where id = p_instance_id;

  if v_host is null then
    raise exception 'Rehearsal not found';
  end if;
  if not v_rehearsal then
    raise exception 'Not a rehearsal instance';
  end if;
  if auth.uid() is not null and auth.uid() <> v_host then
    raise exception 'Not the host';
  end if;

  delete from public.quiz_responses where session_id = v_session;
  delete from public.quiz_participants where session_id = v_session;
  delete from public.game_teams where instance_id = p_instance_id;
  delete from public.game_instances where id = p_instance_id;
  if v_session is not null then
    delete from public.quiz_sessions where id = v_session;
  end if;
end;
$$;

revoke all on function public.end_rehearsal(uuid) from public;
grant execute on function public.end_rehearsal(uuid) to authenticated, service_role;
