-- Patch pick_next_adaptive_question: avoid ntile(bigint).
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
  v_prefer_weak := coalesce((v_config->>'prefer_weak')::boolean, true);
  v_avoid_days := coalesce((v_config->>'avoid_recent_days')::int, 14);
  v_min_per := coalesce((v_config->>'min_questions_per_standard')::int, 2);
  v_ramp := coalesce((v_config->>'difficulty_ramp')::boolean, true);

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
    select
      *,
      row_number() over (order by score desc) as rn,
      count(*) over () as total
    from scored
  ),
  candidates as (
    select * from ranked
    where rn <= greatest(1, ceil(total * 0.3))
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
