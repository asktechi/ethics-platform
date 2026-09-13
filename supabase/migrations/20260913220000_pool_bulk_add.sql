create or replace function public.add_questions_to_pool(p_pool_id uuid, p_question_ids uuid[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  added int := 0;
  start_order int;
  restored int := 0;
begin
  if not public.owns_question_pool(p_pool_id) then
    raise exception 'not authorized';
  end if;
  if p_question_ids is null or array_length(p_question_ids, 1) is null then
    return 0;
  end if;

  update public.question_pool_items
    set deleted_at = null,
        updated_at = now()
    where pool_id = p_pool_id
      and deleted_at is not null
      and question_id = any(p_question_ids);
  get diagnostics restored = row_count;

  select coalesce(max("order"), -1) + 1 into start_order
  from public.question_pool_items
  where pool_id = p_pool_id
    and deleted_at is null;

  insert into public.question_pool_items (pool_id, question_id, "order")
  select p_pool_id, src.qid, start_order + src.ord - 1
  from (
    select qid, row_number() over () as ord
    from unnest(p_question_ids) as qid
  ) src
  where not exists (
    select 1
    from public.question_pool_items existing
    where existing.pool_id = p_pool_id
      and existing.question_id = src.qid
  );
  get diagnostics added = row_count;
  return added + restored;
end;
$$;

grant execute on function public.add_questions_to_pool(uuid, uuid[]) to authenticated, service_role;

create or replace function public.create_pool_with_questions(
  p_class_id uuid,
  p_name text,
  p_shuffle_on_play boolean,
  p_time_per_q int,
  p_question_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_pool public.question_pools;
  added int;
begin
  if not public.owns_class(p_class_id) then
    raise exception 'not authorized';
  end if;

  insert into public.question_pools (class_id, name, shuffle_on_play, time_per_q)
  values (p_class_id, coalesce(nullif(trim(p_name), ''), 'Untitled pool'), coalesce(p_shuffle_on_play, true), p_time_per_q)
  returning * into new_pool;

  added := public.add_questions_to_pool(new_pool.id, p_question_ids);
  return jsonb_build_object(
    'id', new_pool.id,
    'class_id', new_pool.class_id,
    'name', new_pool.name,
    'shuffle_on_play', new_pool.shuffle_on_play,
    'time_per_q', new_pool.time_per_q,
    'created_at', new_pool.created_at,
    'updated_at', new_pool.updated_at,
    'deleted_at', new_pool.deleted_at,
    'added', added
  );
end;
$$;

grant execute on function public.create_pool_with_questions(uuid, text, boolean, int, uuid[]) to authenticated, service_role;
