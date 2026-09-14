-- Phase 6D.2: Case Study + Adaptive Drill.

create table if not exists public.case_studies (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  title text not null,
  scenario_text text not null,
  scenario_media_url text,
  created_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists case_studies_class_idx
  on public.case_studies (class_id)
  where deleted_at is null;

drop trigger if exists case_studies_set_updated_at on public.case_studies;
create trigger case_studies_set_updated_at
  before update on public.case_studies
  for each row execute function public.set_updated_at();

alter table public.questions
  add column if not exists case_study_id uuid references public.case_studies (id) on delete set null,
  add column if not exists case_study_order int;

create index if not exists questions_case_study_idx
  on public.questions (case_study_id, case_study_order)
  where deleted_at is null and case_study_id is not null;

alter table public.game_templates
  add column if not exists case_study_ids uuid[] not null default '{}',
  add column if not exists adaptive_config jsonb not null default '{}'::jsonb;

alter table public.game_instances
  add column if not exists adaptive_state jsonb not null default '{}'::jsonb;

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

alter table public.ai_usage_log
  drop constraint if exists ai_usage_log_feature_check;
alter table public.ai_usage_log
  add constraint ai_usage_log_feature_check
  check (feature in ('tagging', 'generation', 'hint'));

alter table public.case_studies enable row level security;

drop policy if exists case_studies_instructor_all on public.case_studies;
create policy case_studies_instructor_all on public.case_studies
  for all to authenticated
  using (
    exists (
      select 1 from public.classes c
      where c.id = class_id and c.created_by = auth.uid() and c.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.classes c
      where c.id = class_id and c.created_by = auth.uid() and c.deleted_at is null
    )
  );

drop policy if exists case_studies_live_select on public.case_studies;
create policy case_studies_live_select on public.case_studies
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.quiz_sessions qs
      join public.game_instances gi
        on gi.quiz_session_id = qs.id and gi.deleted_at is null
      where qs.deleted_at is null
        and qs.status in ('live', 'ended', 'lobby')
        and (
          case_studies.id = any (coalesce(
            (select gt.case_study_ids from public.game_templates gt where gt.id = gi.template_id),
            '{}'::uuid[]
          ))
          or exists (
            select 1 from public.questions q
            where q.case_study_id = case_studies.id
              and q.id::text in (
                select jsonb_array_elements_text(coalesce(qs.settings_json->'question_ids', '[]'::jsonb))
              )
          )
        )
    )
  );

do $$
begin
  begin
    alter publication supabase_realtime add table public.case_studies;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.game_instances;
  exception
    when duplicate_object then null;
  end;
end;
$$;

-- Recreate submit_answer with Adaptive Drill instant scoring (Jeopardy formula).
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
  v_time_ms int;
  v_bonus int;
  v_streak_bonus int;
  v_time_on boolean;
  v_streak_on boolean;
  v_state jsonb;
  v_part jsonb;
  v_answered_ids jsonb;
  v_instance uuid;
  v_standard uuid;
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
  elsif v_session.mode = 'adaptive' then
    if not exists (
      select 1 from jsonb_array_elements_text(v_ids) qid
      where qid = p_question_id::text
    ) then
      raise exception 'Not a session question';
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

  if v_session.mode = 'adaptive' then
    select q.answer_key, q.standard_id into v_key, v_standard from public.questions q where q.id = p_question_id;
    v_correct := upper(coalesce(nullif(trim(coalesce(p_choice_key, '')), ''), '')) = upper(coalesce(v_key, ''));
    v_time_ms := greatest(1, coalesce(v_session.time_per_q, 30)) * 1000;
    v_base := coalesce(
      (v_session.settings_json->'mode_config'->>'base_points')::int,
      (v_session.settings_json->>'base_points')::int,
      100
    );
    v_time_on := coalesce(
      (v_session.settings_json->'mode_config'->>'time_bonus')::boolean,
      (v_session.settings_json->>'time_bonus')::boolean,
      true
    );
    v_streak_on := coalesce(
      (v_session.settings_json->'mode_config'->>'streak_bonus')::boolean,
      (v_session.settings_json->>'streak_bonus')::boolean,
      true
    );
    if v_correct then
      v_bonus := case when v_time_on
        then least(100, greatest(0, round(100 * (1 - least(greatest(p_ms_taken, 0), v_time_ms)::numeric / v_time_ms))::int))
        else 0 end;
      v_streak_bonus := case when v_streak_on then 20 * greatest(0, v_participant.streak) else 0 end;
      v_points := v_base + v_bonus + v_streak_bonus;
    else
      v_points := 0;
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

    select gi.id, coalesce(gi.adaptive_state, '{}'::jsonb)
      into v_instance, v_state
    from public.game_instances gi
    where gi.quiz_session_id = v_session.id and gi.deleted_at is null
    limit 1;

    if v_instance is not null then
      v_part := coalesce(v_state->'per_participant'->v_participant.id::text, '{}'::jsonb);
      v_answered_ids := coalesce(v_part->'answered_ids', '[]'::jsonb);
      if not (v_answered_ids ? p_question_id::text) then
        v_answered_ids := v_answered_ids || jsonb_build_array(p_question_id::text);
      end if;
      v_part := v_part || jsonb_build_object(
        'answered_ids', v_answered_ids,
        'last_standard_id', v_standard,
        'current_standard_id', v_standard,
        'current_question_id', null,
        'streak', case when v_correct then coalesce((v_part->>'streak')::int, v_participant.streak) + 1 else 0 end,
        'wrong_in_row', case when v_correct then 0 else coalesce((v_part->>'wrong_in_row')::int, 0) + 1 end,
        'question_index', jsonb_array_length(v_answered_ids)
      );
      v_state := jsonb_set(
        coalesce(v_state, '{}'::jsonb),
        array['per_participant', v_participant.id::text],
        v_part,
        true
      );
      update public.game_instances
      set adaptive_state = v_state, updated_at = now()
      where id = v_instance;
    end if;

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

  if v_mode in ('rapid_fire', 'adaptive') then
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

  if v_mode in ('rapid_fire', 'adaptive') and coalesce(v_settings->>'game_started_at', '') = '' then
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

create or replace function public.pick_next_adaptive_question(
  p_session_id uuid,
  p_participant_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.quiz_sessions%rowtype;
  v_instance public.game_instances%rowtype;
  v_participant public.quiz_participants%rowtype;
  v_config jsonb;
  v_state jsonb;
  v_part jsonb;
  v_answered jsonb;
  v_current uuid;
  v_total int;
  v_prefer_weak boolean;
  v_avoid_days int;
  v_min_per int;
  v_ramp boolean;
  v_streak int;
  v_wrong int;
  v_class uuid;
  v_picked uuid;
  v_standard uuid;
  v_cutoff timestamptz;
begin
  select * into v_session from public.quiz_sessions where id = p_session_id and deleted_at is null;
  if v_session.id is null then
    raise exception 'Session not found';
  end if;
  if v_session.mode is distinct from 'adaptive' then
    raise exception 'Not an adaptive session';
  end if;
  if v_session.status <> 'live' then
    raise exception 'Quiz session is not live';
  end if;

  select * into v_participant
  from public.quiz_participants
  where id = p_participant_id and session_id = p_session_id and deleted_at is null;
  if v_participant.id is null then
    raise exception 'Participant not found';
  end if;

  select * into v_instance
  from public.game_instances
  where quiz_session_id = p_session_id and deleted_at is null
  limit 1;

  v_config := coalesce(v_session.settings_json->'mode_config', '{}'::jsonb);
  v_total := coalesce((v_config->>'total_questions')::int, 15);
  v_prefer_weak := coalesce((v_session.settings_json->'mode_config'->>'prefer_weak')::boolean, true);
  v_avoid_days := coalesce((v_session.settings_json->'mode_config'->>'avoid_recent_days')::int, 14);
  v_min_per := coalesce((v_session.settings_json->'mode_config'->>'min_questions_per_standard')::int, 2);
  v_ramp := coalesce((v_session.settings_json->'mode_config'->>'difficulty_ramp')::boolean, true);

  v_state := coalesce(v_instance.adaptive_state, '{}'::jsonb);
  v_part := coalesce(v_state->'per_participant'->p_participant_id::text, '{}'::jsonb);
  v_answered := coalesce(v_part->'answered_ids', '[]'::jsonb);
  v_current := nullif(v_part->>'current_question_id', '')::uuid;
  v_streak := coalesce((v_part->>'streak')::int, v_participant.streak, 0);
  v_wrong := coalesce((v_part->>'wrong_in_row')::int, 0);

  if v_current is not null and not (v_answered ? v_current::text) then
    return v_current;
  end if;

  if jsonb_array_length(v_answered) >= v_total then
    return null;
  end if;

  select coalesce(qp.class_id, q.class_id) into v_class
  from public.quiz_sessions qs
  left join public.question_pools qp on qp.id = qs.pool_id
  left join public.questions q on q.id::text = (qs.settings_json->'question_ids'->>0)
  where qs.id = p_session_id;

  v_cutoff := now() - make_interval(days => greatest(v_avoid_days, 0));

  with pool as (
    select q.id, q.standard_id, q.difficulty,
      case
        when v_prefer_weak then coalesce(sp.weakness_score, 0.5)
        else 1 - coalesce(sp.weakness_score, 0.5)
      end as weakness,
      (
        select count(*)::int
        from jsonb_array_elements_text(v_answered) aid
        join public.questions aq on aq.id::text = aid
        where aq.standard_id is not distinct from q.standard_id
      ) as std_count,
      exists (
        select 1 from public.quiz_responses r
        join public.quiz_participants p on p.id = r.participant_id
        where p.student_profile_id is not distinct from v_participant.student_profile_id
          and p.student_profile_id is not null
          and r.question_id = q.id
          and r.is_correct is true
          and r.deleted_at is null
          and r.submitted_at >= v_cutoff
      ) as recent_correct
    from public.questions q
    left join public.student_performance sp
      on sp.student_profile_id = v_participant.student_profile_id
     and sp.class_id = v_class
     and sp.standard_id = q.standard_id
    where q.id::text in (select jsonb_array_elements_text(coalesce(v_session.settings_json->'question_ids', '[]'::jsonb)))
      and q.deleted_at is null
      and not (v_answered ? q.id::text)
  ),
  filtered as (
    select *
    from pool
    where not recent_correct
       or not exists (select 1 from pool p2 where not p2.recent_correct)
  ),
  scored as (
    select
      id,
      standard_id,
      (
        weakness * 10
        + case when std_count < v_min_per then 4 else 0 end
        + case
            when v_ramp and v_streak >= 3 and difficulty = 'hard' then 3
            when v_ramp and v_streak >= 3 and difficulty = 'medium' then 1
            when v_ramp and v_wrong >= 2 and difficulty = 'easy' then 3
            when v_ramp and v_wrong >= 2 and difficulty = 'medium' then 1
            else 0
          end
      ) as score
    from filtered
  ),
  ranked as (
    select *, ntile(greatest(1, least(10, (select count(*) from scored)))) over (order by score desc) as bucket
    from scored
  ),
  candidates as (
    select * from ranked
    where bucket = 1 or score >= (
      select percentile_cont(0.7) within group (order by score) from ranked
    )
  )
  select id, standard_id into v_picked, v_standard
  from candidates
  order by random() * (score + 0.01) desc
  limit 1;

  if v_picked is null then
    return null;
  end if;

  if v_instance.id is not null then
    v_part := v_part || jsonb_build_object(
      'answered_ids', v_answered,
      'current_question_id', v_picked,
      'current_standard_id', v_standard,
      'last_standard_id', coalesce(v_part->>'last_standard_id', v_standard::text),
      'streak', v_streak,
      'wrong_in_row', v_wrong,
      'question_index', jsonb_array_length(v_answered)
    );
    v_state := jsonb_set(
      coalesce(v_state, '{}'::jsonb),
      array['per_participant', p_participant_id::text],
      v_part,
      true
    );
    update public.game_instances
    set adaptive_state = v_state, updated_at = now()
    where id = v_instance.id;
  end if;

  return v_picked;
end;
$$;

revoke all on function public.pick_next_adaptive_question(uuid, uuid) from public;
grant execute on function public.pick_next_adaptive_question(uuid, uuid) to anon, authenticated, service_role;

create or replace function public.get_adaptive_play_question(p_question_id uuid)
returns table (
  question_id uuid,
  stem text,
  choices_json jsonb,
  time_limit_seconds int,
  standard_id uuid,
  standard_code text,
  standard_title text
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
    45,
    q.standard_id,
    s.code,
    s.title
  from public.questions q
  left join public.standards s on s.id = q.standard_id
  where q.id = p_question_id
    and q.deleted_at is null
  limit 1;
$$;

revoke all on function public.get_adaptive_play_question(uuid) from public;
grant execute on function public.get_adaptive_play_question(uuid) to anon, authenticated, service_role;

create or replace function public.apply_adaptive_hint(
  p_participant_token uuid,
  p_question_id uuid
)
returns table (ok boolean, already_hinted boolean, points_cost int, new_score int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant public.quiz_participants%rowtype;
  v_session public.quiz_sessions%rowtype;
  v_instance uuid;
  v_state jsonb;
  v_part jsonb;
  v_hinted jsonb;
  v_cost int;
begin
  select * into v_participant
  from public.quiz_participants
  where participant_token = p_participant_token and deleted_at is null;
  if v_participant.id is null then
    raise exception 'Invalid participant token';
  end if;

  select * into v_session
  from public.quiz_sessions
  where id = v_participant.session_id and deleted_at is null;
  if v_session.id is null or v_session.mode is distinct from 'adaptive' then
    raise exception 'Not an adaptive session';
  end if;
  if v_session.status <> 'live' then
    raise exception 'Quiz session is not live';
  end if;

  v_cost := coalesce((v_session.settings_json->'mode_config'->>'hint_penalty')::int, 50);

  select gi.id, coalesce(gi.adaptive_state, '{}'::jsonb)
    into v_instance, v_state
  from public.game_instances gi
  where gi.quiz_session_id = v_session.id and gi.deleted_at is null
  limit 1;

  v_part := coalesce(v_state->'per_participant'->v_participant.id::text, '{}'::jsonb);
  v_hinted := coalesce(v_part->'hinted_ids', '[]'::jsonb);

  if v_hinted ? p_question_id::text then
    return query select true, true, 0, v_participant.score;
    return;
  end if;

  v_hinted := v_hinted || jsonb_build_array(p_question_id::text);
  v_part := v_part || jsonb_build_object('hinted_ids', v_hinted);
  v_state := jsonb_set(
    coalesce(v_state, '{}'::jsonb),
    array['per_participant', v_participant.id::text],
    v_part,
    true
  );

  update public.quiz_participants
  set score = score - v_cost, updated_at = now()
  where id = v_participant.id
  returning score into v_participant.score;

  if v_instance is not null then
    update public.game_instances
    set adaptive_state = v_state, updated_at = now()
    where id = v_instance;
  end if;

  return query select true, false, v_cost, v_participant.score;
end;
$$;

revoke all on function public.apply_adaptive_hint(uuid, uuid) from public;
grant execute on function public.apply_adaptive_hint(uuid, uuid) to anon, authenticated, service_role;
