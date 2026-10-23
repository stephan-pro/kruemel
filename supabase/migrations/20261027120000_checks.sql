-- Krümel, K2b (Prüfbericht E2-5d): the server checks what it stores, and a household has limits.
--
-- Until now the functions only looked at a task or completion as "a JSON object of at most
-- 64 KB". A member who calls the functions directly (not through the app) could store rows the
-- app cannot read, and fill the database (one database for all households, 500 MB in the free
-- plan). Now:
--
-- - Every task and completion row is checked when it is written, whichever function writes it
--   (triggers on the tables, so `save_task`, `complete_task`, `replace_household_data` and
--   `add_household_data` are all covered): the fields the app needs, with their types, and a size
--   far above what the app writes (title 200 instead of 80 characters, note 2000 instead of 500,
--   100 checklist entries instead of 50; a task at most 16 KB, a completion at most 8 KB). The
--   rules are a part of the app's own check (`src/storage/validate.ts`), so nothing the app
--   writes is refused; the app checks every row it pulls as well (`mergeDelta`). Tombstones (no
--   data) are not checked. A refused row raises `invalid_change`, like the checks before.
-- - A household has at most 500 tasks and 50 000 completions that are not deleted
--   (`too_many_tasks`, `too_many_completions`). Checked once per statement, so taking over a
--   backup with many rows stays fast.
--
-- Rows already stored are not checked again until they are written. The app shows a refused
-- change like any other change the server refused for good ("nicht gespeichert").

/** A calendar day "YYYY-MM-DD" as JSON text. */
create function private.is_day(p_value jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(
    jsonb_typeof(p_value) = 'string' and (p_value #>> '{}') ~ '^\d{4}-\d{2}-\d{2}$',
    false
  )
$$;

/** A JSON text of `p_min` to `p_max` characters. */
create function private.is_text(p_value jsonb, p_min integer, p_max integer) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(
    jsonb_typeof(p_value) = 'string' and char_length(p_value #>> '{}') between p_min and p_max,
    false
  )
$$;

/** A JSON list of at most `p_max` entries (`case`: the length only of a list, never of others). */
create function private.is_list(p_value jsonb, p_max integer) returns boolean
language sql immutable set search_path = '' as $$
  select case
    when jsonb_typeof(p_value) = 'array' then jsonb_array_length(p_value) <= p_max
    else false
  end
$$;

/** Whether `p_data` is a task the app can read, with the id of its row. */
create function private.task_ok(p_id text, p_data jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text) > 16384 then
    return false;
  end if;
  return coalesce(
    p_data -> 'id' = to_jsonb(p_id)
      and private.is_text(p_data -> 'title', 1, 200)
      and private.is_text(p_data -> 'symbol', 1, 40)
      and p_data ->> 'kind' in ('recurring', 'oneOff')
      and p_data ->> 'assignee' in ('personA', 'personB', 'both')
      and private.is_day(p_data -> 'dueDate')
      and private.is_list(p_data -> 'checklist', 100)
      and (not (p_data ? 'note') or private.is_text(p_data -> 'note', 0, 2000)),
    false
  );
end;
$$;

/** Whether `p_data` is a completion the app can read, with the id and task of its row. */
create function private.completion_ok(p_id text, p_task_id text, p_data jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text) > 8192 then
    return false;
  end if;
  return coalesce(
    p_data -> 'id' = to_jsonb(p_id)
      and p_data -> 'taskId' = to_jsonb(p_task_id)
      and private.is_day(p_data -> 'completedOn')
      and private.is_day(p_data -> 'previousDueDate')
      and p_data ->> 'completedBy' in ('personA', 'personB')
      and private.is_list(p_data -> 'checkedItemIds', 100),
    false
  );
end;
$$;

create function private.check_task_row() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.data is not null and not private.task_ok(new.id, new.data) then
    raise exception 'invalid_change';
  end if;
  return new;
end;
$$;

create function private.check_completion_row() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.data is not null and not private.completion_ok(new.id, new.task_id, new.data) then
    raise exception 'invalid_change';
  end if;
  return new;
end;
$$;

create trigger check_row before insert or update on public.tasks
  for each row execute function private.check_task_row();
create trigger check_row before insert or update on public.completions
  for each row execute function private.check_completion_row();

/** At most 500 tasks per household that are not deleted; `changed` are the rows just written. */
create function private.check_task_count() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_household uuid;
begin
  for v_household in select distinct c.household_id from changed c loop
    if (
      select count(*) from public.tasks t
      where t.household_id = v_household and t.deleted_at is null
    ) > 500 then
      raise exception 'too_many_tasks';
    end if;
  end loop;
  return null;
end;
$$;

/** At most 50 000 completions per household that are not deleted. */
create function private.check_completion_count() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_household uuid;
begin
  for v_household in select distinct c.household_id from changed c loop
    if (
      select count(*) from public.completions c
      where c.household_id = v_household and c.deleted_at is null
    ) > 50000 then
      raise exception 'too_many_completions';
    end if;
  end loop;
  return null;
end;
$$;

-- One trigger per event: a trigger with a table of the changed rows takes only one event.
create trigger count_inserted after insert on public.tasks
  referencing new table as changed
  for each statement execute function private.check_task_count();
create trigger count_updated after update on public.tasks
  referencing new table as changed
  for each statement execute function private.check_task_count();
create trigger count_inserted after insert on public.completions
  referencing new table as changed
  for each statement execute function private.check_completion_count();
create trigger count_updated after update on public.completions
  referencing new table as changed
  for each statement execute function private.check_completion_count();

-- Who may call what: nobody directly; the triggers run them while the write functions write.

revoke execute on function
  private.is_day(jsonb),
  private.is_text(jsonb, integer, integer),
  private.is_list(jsonb, integer),
  private.task_ok(text, jsonb),
  private.completion_ok(text, text, jsonb),
  private.check_task_row(),
  private.check_completion_row(),
  private.check_task_count(),
  private.check_completion_count()
from public, anon, authenticated;
