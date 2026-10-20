-- Krümel, stage 2 (E2-1): the shared data of a household.
--
-- One household per person, at most two people (personA = who created it, personB = who accepted
-- the invite). Tasks and completions are kept as the app's own JSON (`data`), one row each. A
-- deleted row stays as a tombstone (`deleted_at`, no data), so devices that were offline learn
-- about it.
--
-- Security (S5): row level security on every table; members only read their own household. Nobody
-- writes to the tables directly: all writes go through the functions below, each in one
-- transaction. The functions that need the owner's rights live in the schema `private`, which the
-- API does not expose; the API sees thin wrappers in `public` that run with the caller's rights.
-- `anon` (no sign-in) may only call `ping`.
--
-- The rules are those of `src/sync/changes.ts` (`applyChange`), which the fake server of the tests
-- follows too:
-- - Editing sets and removes single fields; for the same field the change that reaches the server
--   last wins (all writes of a household queue up behind a lock on its row). The checklist is one
--   field.
-- - Ticking off the same pass of a task twice counts once (the second is rejected and says by whom).
-- - Undo only works for the last completion of a task.
-- - Deleting wins against editing: a deleted task is never brought back by an edit.
-- - A change delivered twice (same id) counts once: the first answer is kept and repeated.
--
-- `pull_changes` hands out what changed since a cursor. The cursor is the oldest transaction that
-- was still running when the last pull looked (`pg_snapshot_xmin`), and every row notes the
-- transaction that last wrote it (`changed_xid`). So a write that commits late is never missed,
-- and nothing is handed out twice once all writers have finished.

create extension if not exists pgcrypto with schema extensions;

-- New tables, sequences and functions in `public` get no rights for `anon` and `authenticated`
-- automatically (the real project was prepared with "expose new tables" on). Every migration grants
-- what is needed explicitly, as this one does below.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- Order of arrival of tasks and completions ("oldest first").
create sequence private.arrival;

-- Tables ---------------------------------------------------------------------------------------

create table public.households (
  id uuid primary key default gen_random_uuid(),
  -- Both missing until the names were set (like `settings.personNames` in the app).
  person_a_name text check (char_length(person_a_name) between 1 and 30),
  person_b_name text check (char_length(person_b_name) between 1 and 30),
  schema_version integer not null default 3 check (schema_version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  changed_xid xid8 not null default pg_current_xact_id(),
  check ((person_a_name is null) = (person_b_name is null))
);

create table public.household_members (
  -- The primary key makes it one household per person.
  user_id uuid primary key references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  role text not null check (role in ('personA', 'personB')),
  joined_at timestamptz not null default now(),
  -- Each role once per household, so at most two members.
  unique (household_id, role)
);

create table public.invites (
  token text primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users (id) on delete set null
);
create index invites_household on public.invites (household_id);

create table public.tasks (
  household_id uuid not null references public.households (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 100),
  -- The task as in the app's data model; missing when deleted.
  data jsonb check (jsonb_typeof(data) = 'object'),
  -- The `schemaVersion` of the app that wrote the row (version protection, E2-3).
  schema_version integer not null check (schema_version >= 1),
  arrived bigint not null default nextval('private.arrival'),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  changed_xid xid8 not null default pg_current_xact_id(),
  primary key (household_id, id),
  check ((deleted_at is null) = (data is not null))
);

create table public.completions (
  household_id uuid not null references public.households (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 100),
  task_id text not null,
  previous_due_date date not null,
  data jsonb check (jsonb_typeof(data) = 'object'),
  schema_version integer not null check (schema_version >= 1),
  arrived bigint not null default nextval('private.arrival'),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  changed_xid xid8 not null default pg_current_xact_id(),
  primary key (household_id, id),
  check ((deleted_at is null) = (data is not null))
);
-- "Ticking off the same pass twice counts once", also if two transactions try at the same time.
create unique index completions_once_per_pass
  on public.completions (household_id, task_id, previous_due_date)
  where deleted_at is null;
create index completions_task on public.completions (household_id, task_id);

-- The answers to changes already carried out, so a repeated delivery gets the same answer.
create table private.applied_changes (
  household_id uuid not null references public.households (id) on delete cascade,
  change_id text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (household_id, change_id)
);

-- Notes when and in which transaction a row last changed.
create function private.touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.changed_xid := pg_current_xact_id();
  return new;
end;
$$;

create trigger touch before update on public.households
  for each row execute function private.touch();
create trigger touch before update on public.tasks
  for each row execute function private.touch();
create trigger touch before update on public.completions
  for each row execute function private.touch();

-- Reading: row level security ------------------------------------------------------------------

create function private.is_member(p_household uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = p_household and m.user_id = (select auth.uid())
  );
$$;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.invites enable row level security;
alter table public.tasks enable row level security;
alter table public.completions enable row level security;

create policy "Mitglieder lesen ihren Haushalt" on public.households
  for select to authenticated using (private.is_member(id));
create policy "Mitglieder sehen, wer zum Haushalt gehört" on public.household_members
  for select to authenticated using (private.is_member(household_id));
create policy "Mitglieder sehen die Einladungen ihres Haushalts" on public.invites
  for select to authenticated using (private.is_member(household_id));
create policy "Mitglieder lesen die Aufgaben ihres Haushalts" on public.tasks
  for select to authenticated using (private.is_member(household_id));
create policy "Mitglieder lesen die Erledigungen ihres Haushalts" on public.completions
  for select to authenticated using (private.is_member(household_id));

revoke all on public.households, public.household_members, public.invites, public.tasks,
  public.completions from anon, authenticated;
grant select on public.households, public.household_members, public.invites, public.tasks,
  public.completions to authenticated;

-- Helpers of the write functions (run with the rights of the function that calls them) ----------

/** The caller's household, locked until the end of the transaction: writes queue up. */
create function private.lock_household() returns uuid
language plpgsql set search_path = '' as $$
declare
  v_household uuid;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in';
  end if;
  select m.household_id into v_household
    from public.household_members m where m.user_id = auth.uid();
  if v_household is null then
    raise exception 'no_household';
  end if;
  perform 1 from public.households h where h.id = v_household for update;
  return v_household;
end;
$$;

create function private.known_answer(p_household uuid, p_change_id text) returns jsonb
language plpgsql set search_path = '' as $$
begin
  if p_change_id is null or char_length(p_change_id) not between 1 and 200 then
    raise exception 'invalid_change';
  end if;
  return (
    select a.result from private.applied_changes a
    where a.household_id = p_household and a.change_id = p_change_id
  );
end;
$$;

/** Keeps the answer for a repeated delivery (for 60 days) and returns it. */
create function private.remember(p_household uuid, p_change_id text, p_result jsonb) returns jsonb
language plpgsql set search_path = '' as $$
begin
  insert into private.applied_changes (household_id, change_id, result)
    values (p_household, p_change_id, p_result);
  delete from private.applied_changes a
    where a.household_id = p_household and a.created_at < now() - interval '60 days';
  return p_result;
end;
$$;

create function private.applied() returns jsonb
language sql immutable set search_path = '' as $$
  select '{"status":"applied"}'::jsonb;
$$;

create function private.rejected(p_reason text) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('status', 'rejected', 'reason', p_reason);
$$;

/** A JSON object of reasonable size (a task, a patch, a completion). */
create function private.check_object(p_value jsonb) returns void
language plpgsql set search_path = '' as $$
begin
  if p_value is null or jsonb_typeof(p_value) <> 'object' or octet_length(p_value::text) > 65536 then
    raise exception 'invalid_change';
  end if;
end;
$$;

create function private.check_version(p_schema_version integer) returns void
language plpgsql set search_path = '' as $$
begin
  if p_schema_version is null or p_schema_version not between 1 and 1000 then
    raise exception 'invalid_change';
  end if;
end;
$$;

/** Applies a patch to the task, if it is still there: set fields, then remove fields. */
create function private.patch_task(
  p_household uuid, p_task_id text, p_set jsonb, p_unset text[], p_schema_version integer
) returns void
language plpgsql set search_path = '' as $$
begin
  perform private.check_object(p_set);
  if p_set = '{}'::jsonb and coalesce(cardinality(p_unset), 0) = 0 then
    return;
  end if;
  update public.tasks t
    set data = (t.data || (p_set - 'id')) - array_remove(coalesce(p_unset, '{}'), 'id'),
        schema_version = greatest(t.schema_version, p_schema_version)
    where t.household_id = p_household and t.id = p_task_id and t.deleted_at is null;
end;
$$;

-- Household and invite -------------------------------------------------------------------------

create function private.create_household(p_person_a text, p_person_b text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_household uuid;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in';
  end if;
  if exists (select 1 from public.household_members m where m.user_id = auth.uid()) then
    raise exception 'already_member';
  end if;
  insert into public.households (person_a_name, person_b_name)
    values (nullif(trim(p_person_a), ''), nullif(trim(p_person_b), ''))
    returning id into v_household;
  insert into public.household_members (user_id, household_id, role)
    values (auth.uid(), v_household, 'personA');
  return v_household;
end;
$$;

/** A new invite (7 days, once); it makes the earlier unused invites of the household invalid. */
create function private.create_invite() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_household uuid := private.lock_household();
  v_token text;
  v_expires timestamptz := now() + interval '7 days';
begin
  if (select count(*) from public.household_members m where m.household_id = v_household) >= 2 then
    raise exception 'household_full';
  end if;
  delete from public.invites i where i.household_id = v_household and i.used_at is null;
  -- 24 random bytes as URL-safe text (it goes into the link after #/einladung/).
  v_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
  insert into public.invites (token, household_id, created_by, expires_at)
    values (v_token, v_household, auth.uid(), v_expires);
  return jsonb_build_object('token', v_token, 'expiresAt', v_expires);
end;
$$;

create function private.accept_invite(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_invite public.invites;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in';
  end if;
  select * into v_invite from public.invites i where i.token = p_token for update;
  if not found then
    raise exception 'invite_unknown';
  end if;
  if v_invite.used_at is not null then
    raise exception 'invite_used';
  end if;
  if v_invite.expires_at <= now() then
    raise exception 'invite_expired';
  end if;
  if exists (select 1 from public.household_members m where m.user_id = auth.uid()) then
    raise exception 'already_member';
  end if;
  perform 1 from public.households h where h.id = v_invite.household_id for update;
  select r.role into v_role
    from (values ('personA'), ('personB')) as r (role)
    where not exists (
      select 1 from public.household_members m
      where m.household_id = v_invite.household_id and m.role = r.role
    )
    order by r.role
    limit 1;
  if v_role is null then
    raise exception 'household_full';
  end if;
  insert into public.household_members (user_id, household_id, role)
    values (auth.uid(), v_invite.household_id, v_role);
  update public.invites i set used_at = now(), used_by = auth.uid() where i.token = p_token;
  return v_invite.household_id;
end;
$$;

-- Changes (one per change of `src/sync/changes.ts`) --------------------------------------------

create function private.set_names(p_change_id text, p_schema_version integer, p_names jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_household uuid := private.lock_household();
  v_answer jsonb := private.known_answer(v_household, p_change_id);
begin
  if v_answer is not null then
    return v_answer;
  end if;
  perform private.check_version(p_schema_version);
  perform private.check_object(p_names);
  update public.households h
    set person_a_name = p_names ->> 'personA',
        person_b_name = p_names ->> 'personB',
        schema_version = greatest(h.schema_version, p_schema_version)
    where h.id = v_household;
  return private.remember(v_household, p_change_id, private.applied());
end;
$$;

create function private.save_task(
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
  perform private.check_version(p_schema_version);
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

/** Deletes the task and its completions (tombstones). */
create function private.delete_task(p_change_id text, p_schema_version integer, p_task_id text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_household uuid := private.lock_household();
  v_answer jsonb := private.known_answer(v_household, p_change_id);
begin
  if v_answer is not null then
    return v_answer;
  end if;
  perform private.check_version(p_schema_version);
  update public.tasks t set data = null, deleted_at = now()
    where t.household_id = v_household and t.id = p_task_id and t.deleted_at is null;
  update public.completions c set data = null, deleted_at = now()
    where c.household_id = v_household and c.task_id = p_task_id and c.deleted_at is null;
  return private.remember(v_household, p_change_id, private.applied());
end;
$$;

/** Ticks off: the new completion plus what happens to the task (next due date, checklist, …). */
create function private.complete_task(
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
  perform private.check_version(p_schema_version);
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

/** Takes back the last completion of a task and gives the task its earlier state back. */
create function private.undo_completion(
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
  perform private.check_version(p_schema_version);
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

/** Replaces all data of the household (restoring a backup, F7), in one transaction. */
create function private.replace_household_data(p_change_id text, p_data jsonb) returns jsonb
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
  then
    raise exception 'invalid_change';
  end if;
  v_version := (p_data ->> 'schemaVersion')::integer;
  perform private.check_version(v_version);

  v_names := p_data -> 'settings' -> 'personNames';
  update public.households h
    set person_a_name = v_names ->> 'personA',
        person_b_name = v_names ->> 'personB',
        schema_version = greatest(h.schema_version, v_version)
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

-- Reading the changes --------------------------------------------------------------------------

/**
 * What changed since `p_cursor` (everything without tombstones when it is null), in the shape of
 * `PullResult` in `src/sync/remote.ts`: live rows first, each oldest first.
 */
create function private.pull_changes(p_cursor text) returns jsonb
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

  select jsonb_build_object(
    'cursor', pg_snapshot_xmin(pg_current_snapshot())::text,
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

  select * into v_household_row from public.households h where h.id = v_household;
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

-- The API: wrappers with the caller's rights ---------------------------------------------------

create function public.create_household(p_person_a text, p_person_b text) returns uuid
language sql security invoker set search_path = '' as $$
  select private.create_household(p_person_a, p_person_b);
$$;

create function public.create_invite() returns jsonb
language sql security invoker set search_path = '' as $$
  select private.create_invite();
$$;

create function public.accept_invite(p_token text) returns uuid
language sql security invoker set search_path = '' as $$
  select private.accept_invite(p_token);
$$;

create function public.set_names(p_change_id text, p_schema_version integer, p_names jsonb)
returns jsonb
language sql security invoker set search_path = '' as $$
  select private.set_names(p_change_id, p_schema_version, p_names);
$$;

create function public.save_task(
  p_change_id text, p_schema_version integer, p_task_id text, p_set jsonb, p_unset text[],
  p_create jsonb default null
) returns jsonb
language sql security invoker set search_path = '' as $$
  select private.save_task(p_change_id, p_schema_version, p_task_id, p_set, p_unset, p_create);
$$;

create function public.delete_task(p_change_id text, p_schema_version integer, p_task_id text)
returns jsonb
language sql security invoker set search_path = '' as $$
  select private.delete_task(p_change_id, p_schema_version, p_task_id);
$$;

create function public.complete_task(
  p_change_id text, p_schema_version integer, p_completion jsonb, p_set jsonb, p_unset text[]
) returns jsonb
language sql security invoker set search_path = '' as $$
  select private.complete_task(p_change_id, p_schema_version, p_completion, p_set, p_unset);
$$;

create function public.undo_completion(
  p_change_id text, p_schema_version integer, p_completion_id text, p_set jsonb, p_unset text[]
) returns jsonb
language sql security invoker set search_path = '' as $$
  select private.undo_completion(p_change_id, p_schema_version, p_completion_id, p_set, p_unset);
$$;

create function public.replace_household_data(p_change_id text, p_data jsonb) returns jsonb
language sql security invoker set search_path = '' as $$
  select private.replace_household_data(p_change_id, p_data);
$$;

create function public.pull_changes(p_cursor text default null) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select private.pull_changes(p_cursor);
$$;

/** The daily wake-up call of the workflow `keepalive` (no sign-in, no data). */
create function public.ping() returns boolean
language sql stable security invoker set search_path = '' as $$
  select true;
$$;

-- Who may call what ----------------------------------------------------------------------------

revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  private.is_member(uuid),
  private.create_household(text, text),
  private.create_invite(),
  private.accept_invite(text),
  private.set_names(text, integer, jsonb),
  private.save_task(text, integer, text, jsonb, text[], jsonb),
  private.delete_task(text, integer, text),
  private.complete_task(text, integer, jsonb, jsonb, text[]),
  private.undo_completion(text, integer, text, jsonb, text[]),
  private.replace_household_data(text, jsonb),
  private.pull_changes(text)
to authenticated;

grant execute on function
  public.create_household(text, text),
  public.create_invite(),
  public.accept_invite(text),
  public.set_names(text, integer, jsonb),
  public.save_task(text, integer, text, jsonb, text[], jsonb),
  public.delete_task(text, integer, text),
  public.complete_task(text, integer, jsonb, jsonb, text[]),
  public.undo_completion(text, integer, text, jsonb, text[]),
  public.replace_household_data(text, jsonb),
  public.pull_changes(text)
to authenticated;

grant execute on function public.ping() to anon, authenticated;

-- Realtime: changes are announced to the members (row level security applies); the app then pulls.
alter publication supabase_realtime
  add table public.households, public.household_members, public.tasks, public.completions;
