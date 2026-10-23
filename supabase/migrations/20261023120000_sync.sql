-- Krümel, stage 2 (E2-3a): version protection and taking over the data of stage 1.
--
-- Version protection: a household remembers the newest `schemaVersion` that ever wrote to it
-- (`households.schema_version`). A write with an older version is refused with the reason
-- `outdated`, so a device that was offline for long and still runs an older app cannot overwrite
-- data in a newer format; it has to load the new version first. The refusal is not remembered as
-- the answer to the change, so the same change goes through once the device runs the new app.
-- `pull_changes` tells the household's version (`schemaVersion`), so a device can see that it is
-- behind.
--
-- Taking over (`add_household_data`): the tasks and completions a device kept before the household
-- existed, in one transaction. It only adds what is not there yet: a task whose id the household
-- knows (also deleted ones) or whose title it already has (ignoring case and spaces) is left out,
-- together with its completions. Both devices may take over at the same time; the lock on the
-- household makes the second one see what the first one added.
--
-- The rules are those of `src/sync/changes.ts` (`applyChange`, `titleKey`) and
-- `src/sync/fakeHousehold.ts` (version), which the fake server of the tests follows too. Security
-- as before: the logic in `private`, thin wrappers in `public` with the caller's rights.

-- Helpers --------------------------------------------------------------------------------------

/**
 * Whether the household takes a write of an app with `p_schema_version`; a newer version becomes
 * the household's version. The caller holds the lock on the household.
 */
create function private.accept_version(p_household uuid, p_schema_version integer)
returns boolean
language plpgsql set search_path = '' as $$
declare
  v_current integer;
begin
  perform private.check_version(p_schema_version);
  select h.schema_version into v_current from public.households h where h.id = p_household;
  if p_schema_version < v_current then
    return false;
  end if;
  if p_schema_version > v_current then
    update public.households h set schema_version = p_schema_version where h.id = p_household;
  end if;
  return true;
end;
$$;

/** A title for comparing: without case, outer spaces and repeated inner spaces. */
create function private.title_key(p_title text) returns text
language sql immutable set search_path = '' as $$
  select lower(btrim(regexp_replace(coalesce(p_title, ''), '\s+', ' ', 'g')));
$$;

-- Changes, now with the version protection --------------------------------------------------------

create or replace function private.set_names(p_change_id text, p_schema_version integer, p_names jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_household uuid := private.lock_household();
  v_answer jsonb := private.known_answer(v_household, p_change_id);
begin
  if v_answer is not null then
    return v_answer;
  end if;
  if not private.accept_version(v_household, p_schema_version) then
    return private.rejected('outdated');
  end if;
  perform private.check_object(p_names);
  update public.households h
    set person_a_name = p_names ->> 'personA',
        person_b_name = p_names ->> 'personB'
    where h.id = v_household;
  return private.remember(v_household, p_change_id, private.applied());
end;
$$;

create or replace function private.save_task(
  p_change_id text, p_schema_version integer, p_task_id text, p_set jsonb, p_unset text[],
  p_create jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_household uuid := private.lock_household();
  v_answer jsonb := private.known_answer(v_household, p_change_id);
  v_task public.tasks;
begin
  if v_answer is not null then
    return v_answer;
  end if;
  if not private.accept_version(v_household, p_schema_version) then
    return private.rejected('outdated');
  end if;
  select * into v_task from public.tasks t
    where t.household_id = v_household and t.id = p_task_id;
  if found and v_task.deleted_at is null then
    perform private.patch_task(v_household, p_task_id, p_set, p_unset, p_schema_version);
  elsif found or p_create is null then
    -- Deleted meanwhile (deleting wins), or an edit of a task the server never had.
    return private.remember(v_household, p_change_id, private.rejected('taskGone'));
  else
    perform private.check_object(p_create);
    if p_create ->> 'id' is distinct from p_task_id then
      raise exception 'invalid_change';
    end if;
    insert into public.tasks (household_id, id, data, schema_version)
      values (v_household, p_task_id, p_create, p_schema_version);
  end if;
  return private.remember(v_household, p_change_id, private.applied());
end;
$$;

create or replace function private.delete_task(
  p_change_id text, p_schema_version integer, p_task_id text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_household uuid := private.lock_household();
  v_answer jsonb := private.known_answer(v_household, p_change_id);
begin
  if v_answer is not null then
    return v_answer;
  end if;
  if not private.accept_version(v_household, p_schema_version) then
    return private.rejected('outdated');
  end if;
  update public.tasks t set data = null, deleted_at = now()
    where t.household_id = v_household and t.id = p_task_id and t.deleted_at is null;
  update public.completions c set data = null, deleted_at = now()
    where c.household_id = v_household and c.task_id = p_task_id and c.deleted_at is null;
  return private.remember(v_household, p_change_id, private.applied());
end;
$$;

create or replace function private.complete_task(
  p_change_id text, p_schema_version integer, p_completion jsonb, p_set jsonb, p_unset text[]
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_household uuid := private.lock_household();
  v_answer jsonb := private.known_answer(v_household, p_change_id);
  v_id text;
  v_task_id text;
  v_pass date;
  v_by text;
begin
  if v_answer is not null then
    return v_answer;
  end if;
  if not private.accept_version(v_household, p_schema_version) then
    return private.rejected('outdated');
  end if;
  perform private.check_object(p_completion);
  v_id := p_completion ->> 'id';
  v_task_id := p_completion ->> 'taskId';
  v_pass := (p_completion ->> 'previousDueDate')::date;
  if v_id is null or v_task_id is null or v_pass is null then
    raise exception 'invalid_change';
  end if;

  if not exists (
    select 1 from public.tasks t
    where t.household_id = v_household and t.id = v_task_id and t.deleted_at is null
  ) then
    return private.remember(v_household, p_change_id, private.rejected('taskGone'));
  end if;
  if exists (
    select 1 from public.completions c
    where c.household_id = v_household and c.id = v_id and c.deleted_at is null
  ) then
    return private.remember(v_household, p_change_id, private.applied());
  end if;
  select c.data ->> 'completedBy' into v_by from public.completions c
    where c.household_id = v_household and c.task_id = v_task_id
      and c.previous_due_date = v_pass and c.deleted_at is null;
  if found then
    return private.remember(
      v_household, p_change_id, private.rejected('alreadyDone') || jsonb_build_object('by', v_by)
    );
  end if;

  insert into public.completions (household_id, id, task_id, previous_due_date, data, schema_version)
    values (v_household, v_id, v_task_id, v_pass, p_completion, p_schema_version)
    on conflict (household_id, id) do update
      set task_id = excluded.task_id, previous_due_date = excluded.previous_due_date,
          data = excluded.data, schema_version = excluded.schema_version,
          arrived = excluded.arrived, deleted_at = null;
  perform private.patch_task(v_household, v_task_id, p_set, p_unset, p_schema_version);
  return private.remember(v_household, p_change_id, private.applied());
end;
$$;

create or replace function private.undo_completion(
  p_change_id text, p_schema_version integer, p_completion_id text, p_set jsonb, p_unset text[]
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_household uuid := private.lock_household();
  v_answer jsonb := private.known_answer(v_household, p_change_id);
  v_task_id text;
  v_last text;
begin
  if v_answer is not null then
    return v_answer;
  end if;
  if not private.accept_version(v_household, p_schema_version) then
    return private.rejected('outdated');
  end if;
  select c.task_id into v_task_id from public.completions c
    where c.household_id = v_household and c.id = p_completion_id and c.deleted_at is null;
  if not found then
    return private.remember(v_household, p_change_id, private.rejected('completionGone'));
  end if;
  select c.id into v_last from public.completions c
    where c.household_id = v_household and c.task_id = v_task_id and c.deleted_at is null
    order by c.arrived desc
    limit 1;
  if v_last <> p_completion_id then
    return private.remember(v_household, p_change_id, private.rejected('notLast'));
  end if;
  update public.completions c set data = null, deleted_at = now()
    where c.household_id = v_household and c.id = p_completion_id;
  perform private.patch_task(v_household, v_task_id, p_set, p_unset, p_schema_version);
  return private.remember(v_household, p_change_id, private.applied());
end;
$$;

/** Replaces all data of the household (restoring a backup, F7); the version is the backup's. */
create or replace function private.replace_household_data(p_change_id text, p_data jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_household uuid := private.lock_household();
  v_answer jsonb := private.known_answer(v_household, p_change_id);
  v_version integer;
  v_names jsonb;
begin
  if v_answer is not null then
    return v_answer;
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object'
    or jsonb_typeof(p_data -> 'tasks') is distinct from 'array'
    or jsonb_typeof(p_data -> 'completions') is distinct from 'array'
    or exists (
      select 1 from jsonb_array_elements(p_data -> 'tasks') t
      where jsonb_typeof(t -> 'id') is distinct from 'string'
    )
    or exists (
      select 1 from jsonb_array_elements(p_data -> 'completions') c
      where jsonb_typeof(c -> 'id') is distinct from 'string'
        or jsonb_typeof(c -> 'taskId') is distinct from 'string'
        or jsonb_typeof(c -> 'previousDueDate') is distinct from 'string'
    )
    or jsonb_typeof(p_data -> 'schemaVersion') is distinct from 'number'
  then
    raise exception 'invalid_change';
  end if;
  v_version := (p_data ->> 'schemaVersion')::integer;
  if not private.accept_version(v_household, v_version) then
    return private.rejected('outdated');
  end if;

  v_names := p_data -> 'settings' -> 'personNames';
  update public.households h
    set person_a_name = v_names ->> 'personA',
        person_b_name = v_names ->> 'personB'
    where h.id = v_household
      and (h.person_a_name, h.person_b_name)
        is distinct from (v_names ->> 'personA', v_names ->> 'personB');

  -- Rows that are not in the new data become tombstones; the others are written in the order of
  -- the data (only those that differ, so a pull hands out only what changed).
  update public.completions c set data = null, deleted_at = now()
    where c.household_id = v_household and c.deleted_at is null
      and c.id not in (select e ->> 'id' from jsonb_array_elements(p_data -> 'completions') e);
  update public.tasks t set data = null, deleted_at = now()
    where t.household_id = v_household and t.deleted_at is null
      and t.id not in (select e ->> 'id' from jsonb_array_elements(p_data -> 'tasks') e);

  insert into public.tasks as t (household_id, id, data, schema_version)
    select v_household, e.value ->> 'id', e.value, v_version
      from jsonb_array_elements(p_data -> 'tasks') with ordinality as e (value, n)
      order by e.n
    on conflict (household_id, id) do update
      set data = excluded.data, schema_version = excluded.schema_version,
          arrived = excluded.arrived, deleted_at = null
      where t.deleted_at is not null or t.data is distinct from excluded.data;

  insert into public.completions as c
      (household_id, id, task_id, previous_due_date, data, schema_version)
    select v_household, e.value ->> 'id', e.value ->> 'taskId',
        (e.value ->> 'previousDueDate')::date, e.value, v_version
      from jsonb_array_elements(p_data -> 'completions') with ordinality as e (value, n)
      order by e.n
    on conflict (household_id, id) do update
      set task_id = excluded.task_id, previous_due_date = excluded.previous_due_date,
          data = excluded.data, schema_version = excluded.schema_version,
          arrived = excluded.arrived, deleted_at = null
      where c.deleted_at is not null or c.data is distinct from excluded.data;

  return private.remember(v_household, p_change_id, private.applied());
end;
$$;

-- Taking over ----------------------------------------------------------------------------------

/**
 * Adds the tasks and completions of `p_data` (`{tasks, completions}`) that the household does not
 * have yet, in the order of the data. Left out: tasks whose id the household knows (also deleted
 * ones), tasks with a title the household already has, repeated ids, and completions that do not
 * belong to an added task or tick off a pass that is already ticked off.
 */
create function private.add_household_data(
  p_change_id text, p_schema_version integer, p_data jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_household uuid := private.lock_household();
  v_answer jsonb := private.known_answer(v_household, p_change_id);
  v_added text[];
begin
  if v_answer is not null then
    return v_answer;
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object'
    or jsonb_typeof(p_data -> 'tasks') is distinct from 'array'
    or jsonb_typeof(p_data -> 'completions') is distinct from 'array'
    or exists (
      select 1 from jsonb_array_elements(p_data -> 'tasks') t
      where jsonb_typeof(t) <> 'object' or octet_length(t::text) > 65536
        or jsonb_typeof(t -> 'id') is distinct from 'string'
        or char_length(t ->> 'id') not between 1 and 100
        or jsonb_typeof(t -> 'title') is distinct from 'string'
    )
    or exists (
      select 1 from jsonb_array_elements(p_data -> 'completions') c
      where jsonb_typeof(c) <> 'object' or octet_length(c::text) > 65536
        or jsonb_typeof(c -> 'id') is distinct from 'string'
        or char_length(c ->> 'id') not between 1 and 100
        or jsonb_typeof(c -> 'taskId') is distinct from 'string'
        or jsonb_typeof(c -> 'previousDueDate') is distinct from 'string'
    )
  then
    raise exception 'invalid_change';
  end if;
  if not private.accept_version(v_household, p_schema_version) then
    return private.rejected('outdated');
  end if;

  -- The comparison sees the household as it was before this call: tasks of the same data with the
  -- same title are all added (the device had them like that).
  with incoming as (
    select e.value as task, e.n
      from jsonb_array_elements(p_data -> 'tasks') with ordinality as e (value, n)
  ), fresh as (
    select i.task, i.n from incoming i
      where not exists (
        select 1 from public.tasks t
        where t.household_id = v_household and t.id = i.task ->> 'id'
      )
      and not exists (
        select 1 from public.tasks t
        where t.household_id = v_household and t.deleted_at is null
          and private.title_key(t.data ->> 'title') = private.title_key(i.task ->> 'title')
      )
  ), inserted as (
    insert into public.tasks (household_id, id, data, schema_version)
      select v_household, f.task ->> 'id', f.task, p_schema_version
        from fresh f
        order by f.n
      on conflict (household_id, id) do nothing
      returning id
  )
  select coalesce(array_agg(inserted.id), '{}') into v_added from inserted;

  -- `do nothing` covers a repeated id and a pass that is ticked off already
  -- (`completions_once_per_pass`).
  insert into public.completions (household_id, id, task_id, previous_due_date, data, schema_version)
    select v_household, e.value ->> 'id', e.value ->> 'taskId',
        (e.value ->> 'previousDueDate')::date, e.value, p_schema_version
      from jsonb_array_elements(p_data -> 'completions') with ordinality as e (value, n)
      where e.value ->> 'taskId' = any (v_added)
      order by e.n
    on conflict do nothing;

  return private.remember(v_household, p_change_id, private.applied());
end;
$$;

-- Reading the changes, now with the household's version ---------------------------------------------

create or replace function private.pull_changes(p_cursor text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_household uuid;
  v_since xid8;
  v_household_row public.households;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in';
  end if;
  select m.household_id into v_household
    from public.household_members m where m.user_id = auth.uid();
  if v_household is null then
    raise exception 'no_household';
  end if;
  v_since := p_cursor::xid8;
  select * into v_household_row from public.households h where h.id = v_household;

  select jsonb_build_object(
    'cursor', pg_snapshot_xmin(pg_current_snapshot())::text,
    'schemaVersion', v_household_row.schema_version,
    'tasks', coalesce((
      select jsonb_agg(
          jsonb_build_object(
            'id', t.id, 'schemaVersion', t.schema_version, 'deleted', t.deleted_at is not null
          ) || case when t.data is null then '{}'::jsonb else jsonb_build_object('task', t.data) end
          order by t.deleted_at is not null, t.arrived)
        from public.tasks t
        where t.household_id = v_household
          and (case when v_since is null then t.deleted_at is null else t.changed_xid >= v_since end)
    ), '[]'::jsonb),
    'completions', coalesce((
      select jsonb_agg(
          jsonb_build_object(
            'id', c.id, 'taskId', c.task_id, 'schemaVersion', c.schema_version,
            'deleted', c.deleted_at is not null
          ) || case when c.data is null then '{}'::jsonb
            else jsonb_build_object('completion', c.data) end
          order by c.deleted_at is not null, c.arrived)
        from public.completions c
        where c.household_id = v_household
          and (case when v_since is null then c.deleted_at is null else c.changed_xid >= v_since end)
    ), '[]'::jsonb)
  ) into v_result;

  if (v_since is null and v_household_row.person_a_name is not null)
    or v_household_row.changed_xid >= v_since
  then
    v_result := v_result || jsonb_build_object('settings',
      case when v_household_row.person_a_name is null then '{}'::jsonb
      else jsonb_build_object('personNames', jsonb_build_object(
        'personA', v_household_row.person_a_name, 'personB', v_household_row.person_b_name))
      end);
  end if;
  return v_result;
end;
$$;

-- The API --------------------------------------------------------------------------------------

create function public.add_household_data(
  p_change_id text, p_schema_version integer, p_data jsonb
) returns jsonb
language sql security invoker set search_path = '' as $$
  select private.add_household_data(p_change_id, p_schema_version, p_data);
$$;

-- Who may call what (the replaced functions keep their rights) ---------------------------------------

revoke execute on function
  private.accept_version(uuid, integer),
  private.title_key(text),
  private.add_household_data(text, integer, jsonb),
  public.add_household_data(text, integer, jsonb)
from public, anon, authenticated;

grant execute on function private.add_household_data(text, integer, jsonb) to authenticated;
grant execute on function public.add_household_data(text, integer, jsonb) to authenticated;
