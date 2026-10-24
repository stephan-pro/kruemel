-- Krümel, notifications (NT-d): messages about the other person and about joining the household.
--
-- Events (`private.push_events`) arise in the database, by triggers on the household's own data,
-- never from a request that names a recipient:
-- - `done`: a completion written by `complete_task` that the signed-in person ticked off themself
--   (`completedBy` is their place), that was the other person's or both people's
--   (`assigneeAtCompletion`), and that was ticked off at most 24 hours before it arrived
--   (`is_partner_completion`, as `isPartnerCompletion` in src/domain/notificationPlan.ts).
-- - `tookOver`: a change by `save_task` that makes a task of the other person (or of both) the
--   signed-in person's, once or for good (`is_takeover`, as `isTakeOver`).
-- - `joined`: a new member of the household (`accept_invite`); the other member is told.
-- Only these two functions count for the first two: their wrappers in `public` mark the
-- transaction (`kruemel.push_events`), so restoring a backup or taking over old data
-- (`replace_household_data`, `add_household_data`) and the changes a completion or its undo makes
-- to the task tell nobody anything. A repeated change is answered from `applied_changes` and writes
-- nothing; a completion that is there already is not written again; and each completion makes at
-- most one event per recipient (unique index). Undoing a completion, deleting a task or completion
-- removes its events (also when that happens otherwise, e.g. by a restore).
--
-- Messages: every new event goes to each device of the recipient that wants it
-- (`partner_enabled`, `household_enabled`) and joins the one message of that kind waiting there,
-- or starts one (`push_jobs` of kind `partner`, 5 minutes later, or `joined`, at once;
-- `push_job_events` links them). The schedule (`push_tick`) holds back messages whose moment falls
-- in the device's quiet hours until they end (`defer_quiet_pushes`, `quiet_end`); everything that
-- arrives meanwhile joins them, so the night brings one message in the morning. The daily overview
-- keeps coming at its time (1.2). `claim_push_jobs` counts only when a message goes, and only what
-- still holds: the completion and its task still there, the task still the other person's, both
-- people still in the same household, the setting still on. Nothing left: no message. The
-- payload names only numbers and the other person's name from the household (at most 30
-- characters), never a task.
--
-- Leaving, being removed, deleting the account: a trigger on `household_members` deletes the
-- events of and about that person in that household, all waiting messages of their devices, and
-- the other person's messages that are left with nothing. Their devices stay with their account
-- (4.4: for a later household); deleting the account deletes them (cascade), switching a device
-- off or signing out deletes it (`unregister_push_device`), each with its messages.
--
-- The daily overview (NT-c) is now noted per account and device (`push_daily_marks`, the id the
-- device keeps also when switched off), not per row of `push_devices`: switching off and on again
-- on the same day does not bring a second one.
--
-- Security: the new tables live in `private` without any rights for `anon` and `authenticated`;
-- the new functions are granted to nobody (triggers and `pg_cron` run them). The API stays as it
-- was; `save_task` and `complete_task` only mark their transaction.

-- Messages of three kinds now.
alter table private.push_jobs drop constraint push_jobs_kind_check;
alter table private.push_jobs
  add constraint push_jobs_kind_check check (kind in ('daily', 'partner', 'joined'));

-- What happened that the other person is told about.
create table private.push_events (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  recipient_user uuid not null references auth.users (id) on delete cascade,
  actor_user uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('done', 'tookOver', 'joined')),
  task_id text,
  completion_id text,
  created_at timestamptz not null default now(),
  check ((kind = 'done') = (completion_id is not null)),
  check ((kind = 'joined') = (task_id is null))
);
create unique index push_events_done_once
  on private.push_events (household_id, recipient_user, completion_id) where kind = 'done';
create index push_events_task on private.push_events (household_id, task_id);
create index push_events_people on private.push_events (household_id, recipient_user, actor_user);

-- Which events a waiting message tells about.
create table private.push_job_events (
  job bigint not null references private.push_jobs (id) on delete cascade,
  event bigint not null references private.push_events (id) on delete cascade,
  primary key (job, event)
);
create index push_job_events_event on private.push_job_events (event);

-- The local day of the last daily overview per account and device.
create table private.push_daily_marks (
  user_id uuid not null references auth.users (id) on delete cascade,
  device_id uuid not null,
  day date not null,
  primary key (user_id, device_id)
);
insert into private.push_daily_marks (user_id, device_id, day)
  select d.user_id, d.device_id, d.last_daily_on from public.push_devices d
  where d.last_daily_on is not null;

alter table private.push_events enable row level security;
alter table private.push_job_events enable row level security;
alter table private.push_daily_marks enable row level security;
revoke all on private.push_events, private.push_job_events, private.push_daily_marks
  from public, anon, authenticated;

-- The rules (those of src/domain/notificationPlan.ts) --------------------------------------------

/** Who has to do a task right now (`effectiveAssignee`): a one-time takeover wins. */
create function private.task_owner(p_data jsonb) returns text
language sql immutable set search_path = '' as $$
  select case
    when p_data ->> 'kind' = 'recurring' and p_data ->> 'takenOverBy' in ('personA', 'personB')
      then p_data ->> 'takenOverBy'
    else p_data ->> 'assignee'
  end;
$$;

/** Whether a completion tells `p_recipient` that `p_actor` did it for them (`isPartnerCompletion`). */
create function private.is_partner_completion(
  p_data jsonb, p_actor text, p_recipient text, p_arrived timestamptz
) returns boolean
language plpgsql stable set search_path = '' as $$
declare
  v_at timestamptz;
begin
  if p_actor is null or p_recipient is null or p_actor = p_recipient
    or p_data ->> 'completedBy' is distinct from p_actor
    or coalesce(p_data ->> 'assigneeAtCompletion', '') not in (p_recipient, 'both') then
    return false;
  end if;
  begin
    v_at := (p_data ->> 'completedAt')::timestamptz;
  exception when others then
    return false;
  end;
  return v_at is not null and v_at >= p_arrived - interval '24 hours';
end;
$$;

/** Whether a change of a task is `p_actor` taking it over from `p_recipient` (`isTakeOver`). */
create function private.is_takeover(
  p_before jsonb, p_after jsonb, p_actor text, p_recipient text
) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(
    p_actor <> p_recipient
      and private.task_owner(p_before) in (p_recipient, 'both')
      and private.task_owner(p_after) = p_actor,
    false);
$$;

/**
 * When the quiet hours a moment lies in end for a device (the next time its clock shows
 * `p_to`), or null if the moment is not in them (`quietEnd`).
 */
create function private.quiet_end(
  p_now timestamptz, p_time_zone text, p_enabled boolean, p_from time, p_to time
) returns timestamptz
language plpgsql stable set search_path = '' as $$
declare
  v_local timestamp := date_trunc('minute', private.local_time(p_now, p_time_zone));
  v_end timestamp;
begin
  if not coalesce(p_enabled, false)
    or not private.is_quiet_time(v_local::time, p_from, p_to) then
    return null;
  end if;
  v_end := v_local::date + p_to;
  if v_end <= v_local then
    v_end := v_end + interval '1 day';
  end if;
  begin
    return v_end at time zone coalesce(p_time_zone, 'Europe/Berlin');
  exception when others then
    return v_end at time zone 'Europe/Berlin';
  end;
end;
$$;

-- Events ---------------------------------------------------------------------------------------

/** The place (`personA`, `personB`) of a person in a household, or null. */
create function private.role_in(p_household uuid, p_user uuid) returns text
language sql stable set search_path = '' as $$
  select m.role from public.household_members m
    where m.household_id = p_household and m.user_id = p_user;
$$;

/** A completion arrived (`complete_task`) or was undone or deleted (any way). */
create function private.note_completion_event() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_other record;
begin
  if new.deleted_at is not null then
    delete from private.push_events e
      where e.household_id = new.household_id and e.completion_id = new.id;
    return null;
  end if;
  if current_setting('kruemel.push_events', true) is distinct from 'complete'
    or v_actor is null
    or (tg_op = 'UPDATE' and old.deleted_at is null) then
    return null;
  end if;
  v_role := private.role_in(new.household_id, v_actor);
  for v_other in
    select m.user_id, m.role from public.household_members m
      where m.household_id = new.household_id and m.user_id <> v_actor
  loop
    if private.is_partner_completion(new.data, v_role, v_other.role, now()) then
      insert into private.push_events
          (household_id, recipient_user, actor_user, kind, task_id, completion_id)
        values (new.household_id, v_other.user_id, v_actor, 'done', new.task_id, new.id)
        on conflict do nothing;
    end if;
  end loop;
  return null;
end;
$$;

/** A task changed by `save_task` (a takeover?) or was deleted (any way). */
create function private.note_task_event() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_other record;
begin
  if new.deleted_at is not null then
    delete from private.push_events e
      where e.household_id = new.household_id and e.task_id = new.id;
    return null;
  end if;
  if current_setting('kruemel.push_events', true) is distinct from 'save'
    or v_actor is null or old.data is null then
    return null;
  end if;
  v_role := private.role_in(new.household_id, v_actor);
  for v_other in
    select m.user_id, m.role from public.household_members m
      where m.household_id = new.household_id and m.user_id <> v_actor
  loop
    if private.is_takeover(old.data, new.data, v_role, v_other.role) then
      insert into private.push_events (household_id, recipient_user, actor_user, kind, task_id)
        values (new.household_id, v_other.user_id, v_actor, 'tookOver', new.id);
    end if;
  end loop;
  return null;
end;
$$;

/** Somebody joined: the other member is told. */
create function private.note_joined_event() returns trigger
language plpgsql set search_path = '' as $$
begin
  insert into private.push_events (household_id, recipient_user, actor_user, kind)
    select new.household_id, m.user_id, new.user_id, 'joined'
      from public.household_members m
      where m.household_id = new.household_id and m.user_id <> new.user_id;
  return null;
end;
$$;

/**
 * Somebody left the household or was removed (also when their account goes): nothing of or about
 * them waits any more there, and the other person's messages that are left empty go.
 */
create function private.forget_member_events() returns trigger
language plpgsql set search_path = '' as $$
begin
  delete from private.push_events e
    where e.household_id = old.household_id
      and (e.recipient_user = old.user_id or e.actor_user = old.user_id);
  delete from private.push_jobs j
    using public.push_devices d
    where j.device = d.id and d.user_id = old.user_id;
  delete from private.push_jobs j
    where j.kind in ('partner', 'joined')
      and j.device in (
        select d.id from public.push_devices d
          join public.household_members m on m.user_id = d.user_id
          where m.household_id = old.household_id)
      and not exists (select 1 from private.push_job_events l where l.job = j.id);
  return null;
end;
$$;

/**
 * A new event joins the waiting message of its kind on each device of the recipient that wants
 * it, or starts one: about the other person 5 minutes later, about joining at once.
 */
create function private.queue_push_event() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_kind text := case when new.kind = 'joined' then 'joined' else 'partner' end;
  v_device uuid;
  v_job bigint;
  v_at timestamptz;
begin
  v_at := new.created_at + case when v_kind = 'partner' then interval '5 minutes' else interval '0' end;
  for v_device in
    select d.id from public.push_devices d
      where d.user_id = new.recipient_user
        and case when v_kind = 'joined' then d.household_enabled else d.partner_enabled end
  loop
    -- Not one being sent right now: what it tells is counted already.
    select j.id into v_job from private.push_jobs j
      where j.device = v_device and j.kind = v_kind
        and (j.claimed_until is null or j.claimed_until <= now())
      order by j.id
      limit 1
      for update;
    if v_job is null then
      insert into private.push_jobs (device, kind, dedupe_key, not_before, expires_at)
        values (
          v_device, v_kind,
          v_kind || ':' || v_device || ':'
            || case when v_kind = 'joined' then new.actor_user::text else new.id::text end,
          v_at,
          v_at + case when v_kind = 'joined' then interval '24 hours' else interval '12 hours' end)
        on conflict (dedupe_key) do nothing
        returning id into v_job;
      if v_job is null then
        select j.id into v_job from private.push_jobs j
          where j.dedupe_key = v_kind || ':' || v_device || ':' || new.actor_user::text;
      end if;
    end if;
    if v_job is not null then
      insert into private.push_job_events (job, event) values (v_job, new.id)
        on conflict do nothing;
    end if;
  end loop;
  return null;
end;
$$;

create trigger push_events after insert or update of deleted_at on public.completions
  for each row execute function private.note_completion_event();
create trigger push_events after update on public.tasks
  for each row execute function private.note_task_event();
create trigger push_joined after insert on public.household_members
  for each row execute function private.note_joined_event();
create trigger push_forget after delete on public.household_members
  for each row execute function private.forget_member_events();
create trigger push_queue after insert on private.push_events
  for each row execute function private.queue_push_event();

-- Only `save_task` and `complete_task` tell the other person (see above).

create or replace function public.save_task(
  p_change_id text, p_schema_version integer, p_task_id text, p_set jsonb, p_unset text[],
  p_create jsonb default null
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
begin
  perform set_config('kruemel.push_events', 'save', true);
  return private.save_task(p_change_id, p_schema_version, p_task_id, p_set, p_unset, p_create);
end;
$$;

create or replace function public.complete_task(
  p_change_id text, p_schema_version integer, p_completion jsonb, p_set jsonb, p_unset text[]
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
begin
  perform set_config('kruemel.push_events', 'complete', true);
  return private.complete_task(p_change_id, p_schema_version, p_completion, p_set, p_unset);
end;
$$;

-- The schedule ---------------------------------------------------------------------------------

/** Plans the daily overviews due at `p_now`, one per account, device and local day. */
create or replace function private.plan_daily_pushes(p_now timestamptz) returns integer
language plpgsql set search_path = '' as $$
declare
  v_planned integer;
begin
  with due as (
    select d.id, d.user_id, d.device_id, private.daily_overview_day(
        p_now, d.time_zone, d.daily_enabled, d.daily_time, d.daily_days,
        greatest(d.last_daily_on, (
          select k.day from private.push_daily_marks k
            where k.user_id = d.user_id and k.device_id = d.device_id))) as day
      from public.push_devices d
      where d.daily_enabled
        and exists (select 1 from public.household_members m where m.user_id = d.user_id)
  ), noted as (
    update public.push_devices d set last_daily_on = due.day
      from due
      where d.id = due.id and due.day is not null
      returning d.id, d.user_id, d.device_id, due.day
  ), marked as (
    insert into private.push_daily_marks as k (user_id, device_id, day)
      select n.user_id, n.device_id, n.day from noted n
      on conflict (user_id, device_id) do update set day = greatest(k.day, excluded.day)
  )
  insert into private.push_jobs (device, kind, dedupe_key, not_before, expires_at)
    select n.id, 'daily', 'daily:' || n.id || ':' || to_char(n.day, 'YYYY-MM-DD'), p_now,
        p_now + interval '6 hours'
      from noted n
    on conflict (dedupe_key) do nothing;
  get diagnostics v_planned = row_count;
  return v_planned;
end;
$$;

/**
 * Moves the messages about the other person and about joining that are due at `p_now` but fall in
 * their device's quiet hours to the end of them (and their time to give up with them).
 */
create function private.defer_quiet_pushes(p_now timestamptz) returns integer
language plpgsql set search_path = '' as $$
declare
  v_deferred integer;
begin
  with quiet as (
    select j.id, j.kind,
        private.quiet_end(p_now, d.time_zone, d.quiet_enabled, d.quiet_from, d.quiet_to) as until
      from private.push_jobs j
      join public.push_devices d on d.id = j.device
      where j.kind in ('partner', 'joined') and j.not_before <= p_now
        and (j.claimed_until is null or j.claimed_until <= p_now)
      for update of j skip locked
  )
  update private.push_jobs j
    set not_before = q.until,
        expires_at = q.until
          + case when q.kind = 'joined' then interval '24 hours' else interval '12 hours' end
    from quiet q
    where j.id = q.id and q.until is not null;
  get diagnostics v_deferred = row_count;
  return v_deferred;
end;
$$;

create or replace function private.push_tick(p_now timestamptz default now()) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_url text;
  v_token text;
  v_planned integer;
  v_waiting boolean;
begin
  -- Two runs at once (a slow one and the next minute): the second leaves it to the first.
  if not pg_try_advisory_xact_lock(hashtextextended('kruemel:push_tick', 0)) then
    return jsonb_build_object('status', 'busy');
  end if;
  begin
    -- Pasted values may end in a line break.
    select btrim(s.decrypted_secret, E' \t\r\n') into v_url
      from vault.decrypted_secrets s where s.name = 'project_url';
    select btrim(s.decrypted_secret, E' \t\r\n') into v_token
      from vault.decrypted_secrets s where s.name = 'push_cron_token';
  exception when others then
    v_url := null;
  end;
  if v_url is null or v_url !~ '^https?://[^\s/]+/?$'
    or v_token is null or char_length(v_token) < 32 or v_token ~ '\s' then
    return jsonb_build_object('status', 'notConfigured');
  end if;

  v_planned := private.plan_daily_pushes(p_now);
  perform private.defer_quiet_pushes(p_now);
  select exists (
    select 1 from private.push_jobs j
    where j.not_before <= p_now and j.expires_at > p_now
      and (j.claimed_until is null or j.claimed_until <= p_now)
  ) into v_waiting;
  if v_waiting then
    perform net.http_post(
      url := rtrim(v_url, '/') || '/functions/v1/push/flush',
      body := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-kruemel-cron', v_token,
        'x-region', 'eu-west-3'),
      timeout_milliseconds := 120000);
  end if;
  return jsonb_build_object('status', 'ok', 'planned', v_planned, 'called', v_waiting);
end;
$$;

-- For the Edge Function (`service_role`) ----------------------------------------------------------

/**
 * What a waiting message about the other person or about joining tells now, for the device's
 * owner in their household: the other person's name and how many tasks they did and took over,
 * or null if nothing of it holds any more.
 */
create function private.partner_counts(p_job bigint, p_household uuid, p_user uuid)
returns jsonb
language sql stable set search_path = '' as $$
  with valid as (
    select e.kind, e.actor_user, e.task_id, e.completion_id, e.id
      from private.push_job_events l
      join private.push_events e on e.id = l.event
      join public.household_members actor
        on actor.user_id = e.actor_user and actor.household_id = p_household
      where l.job = p_job
        and e.household_id = p_household
        and e.recipient_user = p_user
        and e.actor_user <> p_user
        and case e.kind
          when 'done' then exists (
            select 1 from public.completions c
              join public.tasks t on t.household_id = c.household_id and t.id = c.task_id
              where c.household_id = p_household and c.id = e.completion_id
                and c.deleted_at is null and t.deleted_at is null)
          when 'tookOver' then exists (
            select 1 from public.tasks t
              where t.household_id = p_household and t.id = e.task_id and t.deleted_at is null
                and private.task_owner(t.data) = actor.role)
          else true
        end
  ), latest as (
    select v.actor_user from valid v order by v.id desc limit 1
  )
  select case when not exists (select 1 from valid) then null else jsonb_build_object(
      'name', (
        select case m.role when 'personA' then h.person_a_name else h.person_b_name end
          from latest
          join public.household_members m on m.user_id = latest.actor_user
          join public.households h on h.id = m.household_id),
      'done', (select count(distinct v.completion_id) from valid v where v.kind = 'done'),
      'took', (select count(distinct v.task_id) from valid v where v.kind = 'tookOver'))
  end;
$$;

/**
 * Hands out up to `p_limit` (at most 100) due messages with the device's push address and what to
 * tell, and keeps them for this run for 3 minutes. Counted only now, for the owner's household;
 * messages about the other person in the device's quiet hours wait for their end.
 */
create or replace function private.claim_push_jobs(p_limit integer, p_now timestamptz default now())
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_job record;
  v_household uuid;
  v_role text;
  v_day date;
  v_counts jsonb;
  v_until timestamptz;
  v_wanted boolean;
  v_jobs jsonb := '[]'::jsonb;
  v_empty integer := 0;
  v_dropped integer := 0;
begin
  for v_job in
    select j.id, j.kind, j.device, d.user_id, d.endpoint, d.p256dh, d.auth, d.key_id, d.time_zone,
        d.partner_enabled, d.household_enabled, d.quiet_enabled, d.quiet_from, d.quiet_to
      from private.push_jobs j
      join public.push_devices d on d.id = j.device
      where j.not_before <= p_now and j.expires_at > p_now
        and (j.claimed_until is null or j.claimed_until <= p_now)
      order by j.not_before, j.id
      limit least(greatest(coalesce(p_limit, 0), 0), 100)
      for update of j skip locked
  loop
    v_day := private.local_time(p_now, v_job.time_zone)::date;
    v_household := null;
    v_role := null;
    select m.household_id, m.role into v_household, v_role
      from public.household_members m where m.user_id = v_job.user_id;

    if v_job.kind <> 'daily' then
      v_until := private.quiet_end(
        p_now, v_job.time_zone, v_job.quiet_enabled, v_job.quiet_from, v_job.quiet_to);
      if v_until is not null then
        -- In the quiet hours: it waits for their end (and is not handed out now).
        update private.push_jobs j
          set not_before = v_until,
            expires_at = v_until
              + case when v_job.kind = 'joined' then interval '24 hours' else interval '12 hours' end
          where j.id = v_job.id;
        continue;
      end if;
      v_wanted := case when v_job.kind = 'joined' then v_job.household_enabled
        else v_job.partner_enabled end;
      v_counts := case when v_household is null or not v_wanted then null
        else private.partner_counts(v_job.id, v_household, v_job.user_id) end;
      if v_counts is not null and v_job.kind = 'partner'
        and (v_counts ->> 'done')::integer + (v_counts ->> 'took')::integer = 0 then
        v_counts := null;
      end if;
    else
      v_counts := case when v_household is null then null
        else private.daily_counts(v_household, v_role, v_day) end;
      if v_counts is not null and (v_counts ->> 'due')::integer = 0 then
        v_counts := null;
      end if;
    end if;

    if v_counts is null then
      -- Nothing to tell (or no household any more, or switched off): no message.
      delete from private.push_jobs j where j.id = v_job.id;
      v_empty := v_empty + 1;
    elsif coalesce((select c.sent from private.push_counters c
        where c.device = v_job.device and c.day = v_day), 0) >= 8 then
      delete from private.push_jobs j where j.id = v_job.id;
      v_dropped := v_dropped + 1;
    else
      update private.push_jobs j
        set claimed_until = p_now + interval '3 minutes', attempts = j.attempts + 1
        where j.id = v_job.id;
      v_jobs := v_jobs || jsonb_build_array(
        jsonb_build_object(
          'id', v_job.id,
          'kind', v_job.kind,
          'endpoint', v_job.endpoint,
          'p256dh', v_job.p256dh,
          'auth', v_job.auth,
          'keyId', v_job.key_id)
        || case v_job.kind
          when 'daily' then jsonb_build_object(
            'due', (v_counts ->> 'due')::integer, 'overdue', (v_counts ->> 'overdue')::integer)
          when 'partner' then jsonb_build_object(
            'done', (v_counts ->> 'done')::integer, 'took', (v_counts ->> 'took')::integer)
          else '{}'::jsonb
        end
        || case when v_job.kind <> 'daily' and v_counts ->> 'name' is not null
          then jsonb_build_object('name', v_counts ->> 'name') else '{}'::jsonb end);
    end if;
  end loop;
  return jsonb_build_object('jobs', v_jobs, 'empty', v_empty, 'dropped', v_dropped);
end;
$$;

-- Once a day -------------------------------------------------------------------------------------

create or replace function private.push_cleanup(p_now timestamptz default now()) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_devices integer;
  v_jobs integer;
begin
  delete from public.push_devices d where d.last_seen_at < p_now - interval '90 days';
  get diagnostics v_devices = row_count;
  delete from private.push_jobs j where j.expires_at <= p_now;
  get diagnostics v_jobs = row_count;
  delete from private.push_counters c where c.day < (p_now - interval '8 days')::date;
  delete from private.push_tests t where t.requested_at < p_now - interval '1 day';
  -- Events are kept a week after they arrived (planned messages last at most a day and a half).
  delete from private.push_events e where e.created_at < p_now - interval '7 days';
  delete from private.push_daily_marks k where k.day < (p_now - interval '8 days')::date;
  begin
    -- `pg_cron` notes every run (1440 a day); only the last week is kept.
    delete from cron.job_run_details r where r.end_time < p_now - interval '7 days';
  exception when others then
    null;
  end;
  return jsonb_build_object('devices', v_devices, 'jobs', v_jobs);
end;
$$;

-- Who may call what: nobody new (triggers and the schedule run them; the replaced functions keep
-- their rights).

revoke execute on function
  private.task_owner(jsonb),
  private.is_partner_completion(jsonb, text, text, timestamptz),
  private.is_takeover(jsonb, jsonb, text, text),
  private.quiet_end(timestamptz, text, boolean, time, time),
  private.role_in(uuid, uuid),
  private.note_completion_event(),
  private.note_task_event(),
  private.note_joined_event(),
  private.forget_member_events(),
  private.queue_push_event(),
  private.defer_quiet_pushes(timestamptz),
  private.partner_counts(bigint, uuid, uuid)
from public, anon, authenticated;
