-- Phase 6D.3: Boss Battle.

create table if not exists public.bosses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  subtitle text,
  portrait_emoji text,
  portrait_url text,
  max_hp int not null default 400,
  standard_id uuid references public.standards (id) on delete set null,
  phase_1_taunts text[] not null default '{}',
  phase_2_taunts text[] not null default '{}',
  phase_3_taunts text[] not null default '{}',
  victory_line text,
  defeat_line text,
  palette_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists bosses_slug_idx on public.bosses (slug) where deleted_at is null;

drop trigger if exists bosses_set_updated_at on public.bosses;
create trigger bosses_set_updated_at
  before update on public.bosses
  for each row execute function public.set_updated_at();

alter table public.game_templates
  add column if not exists boss_id uuid references public.bosses (id) on delete set null,
  add column if not exists boss_config jsonb not null default '{}'::jsonb;

alter table public.game_instances
  add column if not exists boss_hp_current int,
  add column if not exists party_hp_current int,
  add column if not exists boss_phase int not null default 1,
  add column if not exists boss_state jsonb not null default '{}'::jsonb;

alter table public.bosses enable row level security;

drop policy if exists bosses_authenticated_select on public.bosses;
create policy bosses_authenticated_select on public.bosses
  for select to authenticated
  using (deleted_at is null);

drop policy if exists bosses_live_select on public.bosses;
create policy bosses_live_select on public.bosses
  for select to anon, authenticated
  using (
    deleted_at is null
    and exists (
      select 1
      from public.game_templates gt
      join public.game_instances gi on gi.template_id = gt.id and gi.deleted_at is null
      join public.quiz_sessions qs on qs.id = gi.quiz_session_id and qs.deleted_at is null
      where gt.boss_id = bosses.id
        and qs.status in ('live', 'ended', 'lobby')
    )
  );

insert into public.bosses (
  slug, name, subtitle, portrait_emoji, max_hp, standard_id,
  phase_1_taunts, phase_2_taunts, phase_3_taunts,
  victory_line, defeat_line, palette_json
)
select
  'insider_phantom',
  'The Insider Phantom',
  'The Whisperer of MNPI',
  '👻',
  350,
  (select id from public.standards where code = 'II(A)' limit 1),
  array[
    'I overheard it in the elevator. That makes it public, right?',
    'Just a rumor among friends. No mosaic, no problem.'
  ],
  array[
    'Trade first, file the memo later. The market never waits.',
    'Information barriers are for people without an edge.'
  ],
  array[
    'If everyone is whispering, it is already priced in.',
    'Standard II(A) is a suggestion. Alpha is a duty.'
  ],
  'The hallway goes quiet. Material nonpublic information stays that way.',
  'The Phantom slips the tape. Someone traded on what was not yet public.',
  '{"bg":"#2E1065","accent":"#A78BFA","hpBar":"#8B5CF6"}'::jsonb
where not exists (select 1 from public.bosses where slug = 'insider_phantom');

insert into public.bosses (
  slug, name, subtitle, portrait_emoji, max_hp, standard_id,
  phase_1_taunts, phase_2_taunts, phase_3_taunts,
  victory_line, defeat_line, palette_json
)
select
  'market_manipulator',
  'The Market Manipulator',
  'Volume is a costume',
  '🎭',
  400,
  (select id from public.standards where code = 'II(B)' limit 1),
  array[
    'A few prints to wake the tape. Harmless theater.',
    'Spreading a rumor is just marketing with better timing.'
  ],
  array[
    'Wash the book, paint the close, call it liquidity.',
    'If the price moves, the story was true enough.'
  ],
  array[
    'Distort it until the crowd believes. That is the close.',
    'II(B) cannot catch a whisper campaign this pretty.'
  ],
  'The tape is clean. No artificial volume, no planted story.',
  'The Manipulator owns the close. Prices lied and the crowd followed.',
  '{"bg":"#450A0A","accent":"#F87171","hpBar":"#DC2626"}'::jsonb
where not exists (select 1 from public.bosses where slug = 'market_manipulator');

insert into public.bosses (
  slug, name, subtitle, portrait_emoji, max_hp, standard_id,
  phase_1_taunts, phase_2_taunts, phase_3_taunts,
  victory_line, defeat_line, palette_json
)
select
  'conflict_hydra',
  'The Conflict Hydra',
  'Three heads, one undisclosed fee',
  '🐉',
  500,
  (select id from public.standards where code = 'VI' limit 1),
  array[
    'I can serve the client and the referrer. Watch me.',
    'Disclosure is paperwork. Loyalty is a feeling.'
  ],
  array[
    'My personal account goes first. The client can wait for the fill.',
    'Referral gold does not count if I smile while I recommend it.'
  ],
  array[
    'Cut one head and two more invoices appear.',
    'Standard VI is a brochure. The Hydra has a term sheet.'
  ],
  'Every head is named. Conflicts sit in daylight.',
  'The Hydra keeps the fee, the fill, and the client in the dark.',
  '{"bg":"#042F2E","accent":"#2DD4BF","hpBar":"#0D9488"}'::jsonb
where not exists (select 1 from public.bosses where slug = 'conflict_hydra');

insert into public.bosses (
  slug, name, subtitle, portrait_emoji, max_hp, standard_id,
  phase_1_taunts, phase_2_taunts, phase_3_taunts,
  victory_line, defeat_line, palette_json
)
select
  'suitability_shade',
  'The Suitability Shade',
  'One product, every IPS',
  '🌫️',
  350,
  (select id from public.standards where code = 'III(C)' limit 1),
  array[
    'They all want growth. I already know the answer.',
    'Know-your-client is a form we file after the trade.'
  ],
  array[
    'This concentrated idea is suitable because I like it.',
    'Risk tolerance is a mood. The model portfolio is a fact.'
  ],
  array[
    'The whole book gets the same ticket. Efficiency is care.',
    'III(C) cannot see into a house account this quiet.'
  ],
  'Each mandate stands on its own. The Shade thins to air.',
  'One ticket hit every IPS. Suitability was a slogan.',
  '{"bg":"#0F172A","accent":"#94A3B8","hpBar":"#64748B"}'::jsonb
where not exists (select 1 from public.bosses where slug = 'suitability_shade');

insert into public.bosses (
  slug, name, subtitle, portrait_emoji, max_hp, standard_id,
  phase_1_taunts, phase_2_taunts, phase_3_taunts,
  victory_line, defeat_line, palette_json
)
select
  'corpus_impostor',
  'The Corpus Impostor',
  'Guaranteed past, invented charter',
  '🪞',
  400,
  (select id from public.standards where code = 'I(C)' limit 1),
  array[
    'Call me a charterholder. The exam is a technicality.',
    'This backtest never lost. You can print that.'
  ],
  array[
    'I did not lie. I omitted the years that were inconvenient.',
    'A performance guarantee is just confidence with a decimal.'
  ],
  array[
    'If the pitch book is beautiful, the facts will catch up.',
    'I(C) is for people who cannot sell.'
  ],
  'The record is fair, accurate, and complete. The Impostor has no mask.',
  'The Impostor still has the room. Someone guaranteed what no one can.',
  '{"bg":"#1C1917","accent":"#C9A227","hpBar":"#EAB308"}'::jsonb
where not exists (select 1 from public.bosses where slug = 'corpus_impostor');

create or replace function public.init_boss_combat(p_session_id uuid)
returns table (
  boss_hp int,
  boss_max_hp int,
  party_hp int,
  party_max_hp int,
  phase int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.quiz_sessions%rowtype;
  v_instance public.game_instances%rowtype;
  v_template public.game_templates%rowtype;
  v_boss public.bosses%rowtype;
  v_config jsonb;
  v_party int;
  v_play text;
begin
  select * into v_session from public.quiz_sessions where id = p_session_id and deleted_at is null;
  if v_session.id is null then
    raise exception 'Session not found';
  end if;
  if v_session.mode is distinct from 'boss_battle' then
    raise exception 'Not a boss battle session';
  end if;

  select * into v_instance
  from public.game_instances
  where quiz_session_id = p_session_id and deleted_at is null
  limit 1;
  if v_instance.id is null then
    raise exception 'Game instance not found';
  end if;

  select * into v_template from public.game_templates where id = v_instance.template_id;
  v_config := coalesce(v_session.settings_json->'mode_config', '{}'::jsonb)
    || coalesce(v_template.boss_config, '{}'::jsonb)
    || coalesce(v_template.mode_config, '{}'::jsonb);

  select * into v_boss
  from public.bosses
  where id = coalesce(v_template.boss_id, nullif(v_config->>'boss_id', '')::uuid)
    and deleted_at is null;
  if v_boss.id is null then
    select * into v_boss from public.bosses where deleted_at is null order by slug limit 1;
  end if;
  if v_boss.id is null then
    raise exception 'No boss seeded';
  end if;

  v_play := coalesce(v_config->>'mode', 'co-op');
  v_party := coalesce((v_config->>'party_max_hp')::int, 300);

  update public.game_instances
  set
    boss_hp_current = coalesce(boss_hp_current, v_boss.max_hp),
    party_hp_current = case when v_play = 'solo' then null else coalesce(party_hp_current, v_party) end,
    boss_phase = coalesce(nullif(boss_phase, 0), 1),
    boss_state = coalesce(boss_state, '{}'::jsonb) || jsonb_build_object(
      'boss_id', v_boss.id,
      'boss_slug', v_boss.slug,
      'max_hp', v_boss.max_hp,
      'party_max_hp', v_party,
      'play_mode', v_play,
      'log', coalesce(boss_state->'log', '[]'::jsonb)
    ),
    updated_at = now()
  where id = v_instance.id
  returning boss_hp_current, party_hp_current, boss_phase
    into boss_hp, party_hp, phase;

  boss_max_hp := v_boss.max_hp;
  party_max_hp := v_party;
  return next;
end;
$$;

create or replace function public.apply_boss_combat(p_session_id uuid, p_question_id uuid)
returns table (
  boss_hp int,
  boss_max_hp int,
  party_hp int,
  party_max_hp int,
  phase int,
  phase_changed boolean,
  taunt text,
  outcome text,
  combat_log jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.quiz_sessions%rowtype;
  v_instance public.game_instances%rowtype;
  v_template public.game_templates%rowtype;
  v_boss public.bosses%rowtype;
  v_config jsonb;
  v_state jsonb;
  v_log jsonb;
  v_scored jsonb;
  v_hp int;
  v_max int;
  v_party int;
  v_party_max int;
  v_phase int;
  v_prev_phase int;
  v_play text;
  v_penalty text;
  v_heal int;
  v_party_dmg int;
  v_base int;
  v_time_bonus int;
  v_mult numeric;
  v_streak_on boolean;
  v_phases boolean;
  v_time_ms int;
  v_diff_bonus int;
  v_damage int;
  v_delta int;
  v_taunt text;
  v_outcome text := 'ongoing';
  rec record;
  v_difficulty text;
begin
  select * into v_session from public.quiz_sessions where id = p_session_id and deleted_at is null;
  if v_session.id is null then
    raise exception 'Session not found';
  end if;
  if v_session.mode is distinct from 'boss_battle' then
    raise exception 'Not a boss battle session';
  end if;

  select * into v_instance
  from public.game_instances
  where quiz_session_id = p_session_id and deleted_at is null
  limit 1;
  if v_instance.id is null then
    raise exception 'Game instance not found';
  end if;

  perform public.init_boss_combat(p_session_id);
  select * into v_instance
  from public.game_instances
  where id = v_instance.id;

  select * into v_template from public.game_templates where id = v_instance.template_id;
  v_config := coalesce(v_session.settings_json->'mode_config', '{}'::jsonb)
    || coalesce(v_template.boss_config, '{}'::jsonb)
    || coalesce(v_template.mode_config, '{}'::jsonb);
  v_state := coalesce(v_instance.boss_state, '{}'::jsonb);
  v_scored := coalesce(v_state->'scored_question_ids', '[]'::jsonb);
  v_log := coalesce(v_state->'log', '[]'::jsonb);

  if v_scored ? p_question_id::text then
    boss_hp := v_instance.boss_hp_current;
    boss_max_hp := coalesce((v_state->>'max_hp')::int, 400);
    party_hp := v_instance.party_hp_current;
    party_max_hp := coalesce((v_state->>'party_max_hp')::int, 300);
    phase := v_instance.boss_phase;
    phase_changed := false;
    taunt := null;
    outcome := coalesce(v_state->>'outcome', 'ongoing');
    combat_log := v_log;
    return next;
    return;
  end if;

  select * into v_boss
  from public.bosses
  where id = coalesce((v_state->>'boss_id')::uuid, v_template.boss_id)
    and deleted_at is null;
  if v_boss.id is null then
    select * into v_boss from public.bosses where deleted_at is null order by slug limit 1;
  end if;

  v_max := coalesce(v_boss.max_hp, (v_state->>'max_hp')::int, 400);
  v_hp := coalesce(v_instance.boss_hp_current, v_max);
  v_play := coalesce(v_config->>'mode', v_state->>'play_mode', 'co-op');
  v_party_max := coalesce((v_config->>'party_max_hp')::int, (v_state->>'party_max_hp')::int, 300);
  v_party := case when v_play = 'solo' then null else coalesce(v_instance.party_hp_current, v_party_max) end;
  v_penalty := coalesce(v_config->>'wrong_answer_penalty', 'boss_heal');
  v_heal := coalesce((v_config->>'boss_heal_amount')::int, 15);
  v_party_dmg := coalesce((v_config->>'party_damage_amount')::int, 20);
  v_base := coalesce((v_config->>'base_damage')::int, 40);
  v_time_bonus := coalesce((v_config->>'time_bonus_damage')::int, 20);
  v_streak_on := coalesce((v_config->>'streak_damage_multiplier')::boolean, true);
  v_phases := coalesce((v_config->>'phases_enabled')::boolean, true);
  v_time_ms := greatest(1, coalesce(v_session.time_per_q, 30)) * 1000;
  v_prev_phase := coalesce(v_instance.boss_phase, 1);
  select q.difficulty into v_difficulty from public.questions q where q.id = p_question_id;
  v_diff_bonus := case
    when v_difficulty = 'hard' then 20
    when v_difficulty = 'medium' then 10
    else 0
  end;

  for rec in
    select p.id, p.display_name, p.streak, p.score,
           coalesce(r.is_correct, false) as is_correct,
           coalesce(r.ms_taken, v_time_ms) as ms_taken
    from public.quiz_participants p
    join public.quiz_responses r
      on r.participant_id = p.id
     and r.question_id = p_question_id
     and r.deleted_at is null
    where p.session_id = p_session_id
      and p.deleted_at is null
  loop
    if rec.is_correct then
      v_mult := 1;
      if v_streak_on then
        if rec.streak >= 3 then
          v_mult := 2;
        elsif rec.streak >= 2 then
          v_mult := 1.5;
        end if;
      end if;
      v_damage := greatest(0, round(
        (v_base
          + v_time_bonus * (1 - least(rec.ms_taken, v_time_ms)::numeric / v_time_ms)
          + v_diff_bonus
        ) * v_mult
      )::int);
      v_hp := v_hp - v_damage;
      update public.quiz_responses
      set points_earned = v_damage
      where participant_id = rec.id and question_id = p_question_id and deleted_at is null;
      update public.quiz_participants
      set
        score = score + v_damage,
        streak = rec.streak + 1,
        last_correct_at = now() - (rec.ms_taken || ' milliseconds')::interval,
        updated_at = now()
      where id = rec.id;
      v_log := v_log || jsonb_build_array(jsonb_build_object(
        'kind', 'damage',
        'name', rec.display_name,
        'amount', v_damage,
        'multiplier', v_mult,
        'question_id', p_question_id
      ));
    else
      update public.quiz_responses
      set points_earned = 0
      where participant_id = rec.id and question_id = p_question_id and deleted_at is null;
      update public.quiz_participants
      set streak = 0, updated_at = now()
      where id = rec.id;
      if v_penalty = 'party_damage' and v_play <> 'solo' then
        v_party := greatest(0, coalesce(v_party, v_party_max) - v_party_dmg);
        v_log := v_log || jsonb_build_array(jsonb_build_object(
          'kind', 'party_damage',
          'name', rec.display_name,
          'amount', v_party_dmg,
          'question_id', p_question_id
        ));
      else
        v_hp := v_hp + v_heal;
        v_log := v_log || jsonb_build_array(jsonb_build_object(
          'kind', 'heal',
          'name', rec.display_name,
          'amount', v_heal,
          'question_id', p_question_id
        ));
      end if;
    end if;
  end loop;

  v_hp := greatest(0, least(v_max * 2, v_hp));
  if v_party is not null then
    v_party := greatest(0, v_party);
  end if;

  if v_phases then
    if v_hp::numeric / greatest(v_max, 1) > 0.66 then
      v_phase := 1;
    elsif v_hp::numeric / greatest(v_max, 1) >= 0.33 then
      v_phase := 2;
    else
      v_phase := 3;
    end if;
  else
    v_phase := 1;
  end if;

  v_taunt := null;
  if v_phase is distinct from v_prev_phase then
    if v_phase = 2 then
      v_taunt := coalesce(v_boss.phase_2_taunts[1 + floor(random() * greatest(array_length(v_boss.phase_2_taunts, 1), 1))::int], v_boss.phase_2_taunts[1]);
    elsif v_phase = 3 then
      v_taunt := coalesce(v_boss.phase_3_taunts[1 + floor(random() * greatest(array_length(v_boss.phase_3_taunts, 1), 1))::int], v_boss.phase_3_taunts[1]);
    else
      v_taunt := coalesce(v_boss.phase_1_taunts[1], '');
    end if;
  end if;

  if v_hp <= 0 then
    v_hp := 0;
    v_outcome := 'victory';
  elsif v_play <> 'solo' and coalesce(v_party, 1) <= 0 then
    v_outcome := 'defeat';
  end if;

  v_state := v_state || jsonb_build_object(
    'boss_id', v_boss.id,
    'boss_slug', v_boss.slug,
    'max_hp', v_max,
    'party_max_hp', v_party_max,
    'play_mode', v_play,
    'log', v_log,
    'scored_question_ids', v_scored || jsonb_build_array(p_question_id::text),
    'outcome', v_outcome,
    'last_taunt', v_taunt
  );

  update public.game_instances
  set
    boss_hp_current = v_hp,
    party_hp_current = v_party,
    boss_phase = v_phase,
    boss_state = v_state,
    updated_at = now()
  where id = v_instance.id;

  boss_hp := v_hp;
  boss_max_hp := v_max;
  party_hp := v_party;
  party_max_hp := v_party_max;
  phase := v_phase;
  phase_changed := v_phase is distinct from v_prev_phase;
  taunt := v_taunt;
  outcome := v_outcome;
  combat_log := v_log;
  return next;
end;
$$;

create or replace function public.force_boss_outcome(p_session_id uuid, p_victory boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid;
  v_instance uuid;
  v_state jsonb;
  v_max int;
begin
  select host_id into v_host from public.quiz_sessions where id = p_session_id and deleted_at is null;
  if v_host is null then
    raise exception 'Session not found';
  end if;
  if auth.uid() is not null and auth.uid() <> v_host then
    raise exception 'Not the host';
  end if;

  perform public.init_boss_combat(p_session_id);

  select gi.id, coalesce(gi.boss_state, '{}'::jsonb), coalesce((gi.boss_state->>'max_hp')::int, 400)
    into v_instance, v_state, v_max
  from public.game_instances gi
  where gi.quiz_session_id = p_session_id and gi.deleted_at is null
  limit 1;

  if p_victory then
    update public.game_instances
    set
      boss_hp_current = 0,
      boss_phase = 3,
      boss_state = v_state || jsonb_build_object('outcome', 'victory'),
      updated_at = now()
    where id = v_instance;
  else
    update public.game_instances
    set
      party_hp_current = 0,
      boss_state = v_state || jsonb_build_object('outcome', 'defeat', 'defeat_reason', 'party_hp_zero'),
      updated_at = now()
    where id = v_instance;
  end if;
end;
$$;

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
    if v_mode = 'boss_battle' then
      perform public.apply_boss_combat(p_session_id, p_question_id);
    end if;
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

  if v_mode = 'boss_battle' then
    perform public.apply_boss_combat(p_session_id, p_question_id);
    return;
  end if;

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

create or replace function public.get_boss_combat(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_instance public.game_instances%rowtype;
  v_boss public.bosses%rowtype;
  v_state jsonb;
begin
  select * into v_instance
  from public.game_instances
  where quiz_session_id = p_session_id and deleted_at is null
  limit 1;
  if v_instance.id is null then
    return null;
  end if;
  v_state := coalesce(v_instance.boss_state, '{}'::jsonb);
  select * into v_boss
  from public.bosses
  where id = coalesce((v_state->>'boss_id')::uuid, (
    select gt.boss_id from public.game_templates gt where gt.id = v_instance.template_id
  ))
    and deleted_at is null;
  return jsonb_build_object(
    'boss_hp', v_instance.boss_hp_current,
    'boss_max_hp', coalesce((v_state->>'max_hp')::int, v_boss.max_hp, 400),
    'party_hp', v_instance.party_hp_current,
    'party_max_hp', coalesce((v_state->>'party_max_hp')::int, 300),
    'phase', coalesce(v_instance.boss_phase, 1),
    'play_mode', coalesce(v_state->>'play_mode', 'co-op'),
    'outcome', coalesce(v_state->>'outcome', 'ongoing'),
    'defeat_reason', v_state->>'defeat_reason',
    'taunt', v_state->>'last_taunt',
    'log', coalesce(v_state->'log', '[]'::jsonb),
    'boss', case when v_boss.id is null then null else jsonb_build_object(
      'id', v_boss.id,
      'slug', v_boss.slug,
      'name', v_boss.name,
      'subtitle', v_boss.subtitle,
      'portrait_emoji', v_boss.portrait_emoji,
      'portrait_url', v_boss.portrait_url,
      'max_hp', v_boss.max_hp,
      'standard_id', v_boss.standard_id,
      'phase_1_taunts', to_jsonb(v_boss.phase_1_taunts),
      'phase_2_taunts', to_jsonb(v_boss.phase_2_taunts),
      'phase_3_taunts', to_jsonb(v_boss.phase_3_taunts),
      'victory_line', v_boss.victory_line,
      'defeat_line', v_boss.defeat_line,
      'palette_json', v_boss.palette_json
    ) end
  );
end;
$$;

create or replace function public.finalize_boss_combat(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_instance public.game_instances%rowtype;
  v_state jsonb;
  v_outcome text;
begin
  perform public.init_boss_combat(p_session_id);
  select * into v_instance
  from public.game_instances
  where quiz_session_id = p_session_id and deleted_at is null
  limit 1;
  if v_instance.id is null then
    return null;
  end if;
  v_state := coalesce(v_instance.boss_state, '{}'::jsonb);
  v_outcome := coalesce(v_state->>'outcome', 'ongoing');
  if v_outcome = 'ongoing' then
    if coalesce(v_instance.boss_hp_current, 1) <= 0 then
      v_outcome := 'victory';
    else
      v_outcome := 'defeat';
      v_state := v_state || jsonb_build_object('defeat_reason', 'questions_exhausted');
    end if;
    update public.game_instances
    set boss_state = v_state || jsonb_build_object('outcome', v_outcome), updated_at = now()
    where id = v_instance.id;
  end if;
  return public.get_boss_combat(p_session_id);
end;
$$;

grant select, insert, update, delete on public.bosses to authenticated, service_role;
grant select on public.bosses to anon;

revoke all on function public.init_boss_combat(uuid) from public;
grant execute on function public.init_boss_combat(uuid) to authenticated, service_role;
revoke all on function public.apply_boss_combat(uuid, uuid) from public;
grant execute on function public.apply_boss_combat(uuid, uuid) to authenticated, service_role;
revoke all on function public.force_boss_outcome(uuid, boolean) from public;
grant execute on function public.force_boss_outcome(uuid, boolean) to authenticated, service_role;
revoke all on function public.get_boss_combat(uuid) from public;
grant execute on function public.get_boss_combat(uuid) to anon, authenticated, service_role;
revoke all on function public.finalize_boss_combat(uuid) from public;
grant execute on function public.finalize_boss_combat(uuid) to authenticated, service_role;
revoke all on function public.quiz_apply_reveal(uuid, uuid, text) from public;
grant execute on function public.quiz_apply_reveal(uuid, uuid, text) to authenticated, service_role;

do $$
begin
  begin
    alter publication supabase_realtime add table public.game_instances;
  exception
    when duplicate_object then null;
  end;
end;
$$;
