-- Krümel, notifications (NT-c): the schedule and the daily overview.
--
-- Every minute `pg_cron` runs `private.push_tick()`:
-- 1. It reads the address of the project and the token of the Edge Function from the Vault (names
--    `project_url` and `push_cron_token`, set by the PO, docs/BENACHRICHTIGUNGEN.md 7.4). Without
--    them (the local test instance) it does nothing at all. This file holds no value of either.
-- 2. It plans the daily overviews that are due (`plan_daily_pushes`): a device with the overview
--    switched on, whose owner is in a household, whose local time (its `time_zone`) has reached its
--    `daily_time` on one of its `daily_days`, at most two hours ago (a missed minute is caught up,
--    a device switched on later that day waits for the next one), and that had none on this local
--    day (`last_daily_on`). One row in `push_jobs` per device and local day (`dedupe_key`), so the
--    change of daylight saving time neither skips nor doubles it (forward: it comes at the first
--    minute after; back: the day is noted). The quiet hours do not hold it back (1.2: the time was
--    chosen on purpose).
-- 3. Only if a message is due and not being sent it calls the Edge Function `push` (route `flush`)
--    through `pg_net`, with the token in the header `x-kruemel-cron` and `x-region: eu-west-3`.
--    Otherwise nothing leaves the database.
--
-- The Edge Function (with the secret key, `service_role` only) fetches up to 25 messages at a time
-- with `claim_push_jobs`: locked against a second run (`for update skip locked`, then
-- `claimed_until` for 3 minutes), and only now counted (`daily_counts`: the open tasks of the
-- owner's own household due on the device's local day or earlier that are theirs, as `isMine` in
-- src/domain/assignment.ts). An overview with nothing to do goes without a message, and so does
-- everything for somebody without a household. It reports back with `finish_push_jobs`: `sent`
-- (counted in `push_counters`: at most 8 a day per device), `retry` (after 5 min, 15 min, 1 h, 1 h,
-- `Retry-After` of the push service if longer; the fifth failure gives up), `gone` (404/410: the
-- device row goes) or `dropped`. A message not sent within 6 hours is given up as well.
--
-- Once a day `push_cleanup` deletes devices not seen for 90 days, messages past their time, old
-- counters and test requests, and the log of `pg_cron` older than 7 days.
--
-- The rules of time and counting are those of src/domain/notificationPlan.ts;
-- src/domain/notificationPlan.cases.ts holds the cases both are tested with. `is_quiet_time` is
-- for the messages about the other person (NT-d).
--
-- Security: the new tables live in `private` without any rights for `anon` and `authenticated`.
-- `push_tick`, `plan_daily_pushes` and `push_cleanup` are granted to nobody (only `pg_cron` runs
-- them, as the owner); `claim_push_jobs` and `finish_push_jobs` only to `service_role`. Nothing new
-- for the app's users.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- When a device last had its daily overview (its local day) and last got a message at all.
alter table public.push_devices
  add column last_daily_on date,
  add column last_sent_at timestamptz;

-- The messages planned for a device and not sent yet.
create table private.push_jobs (
  id bigint generated always as identity primary key,
  device uuid not null references public.push_devices (id) on delete cascade,
  kind text not null check (kind in ('daily')),
  -- `daily:<device>:<local day>`: the database takes each only once.
  dedupe_key text not null unique check (char_length(dedupe_key) <= 200),
  not_before timestamptz not null,
  expires_at timestamptz not null,
  -- Being sent by a run of the Edge Function until then.
  claimed_until timestamptz,
  attempts smallint not null default 0,
  created_at timestamptz not null default now()
);
create index push_jobs_due on private.push_jobs (not_before);
create index push_jobs_device on private.push_jobs (device);

-- The messages sent per device and local day (limit of 8).
create table private.push_counters (
  device uuid not null references public.push_devices (id) on delete cascade,
  day date not null,
  sent smallint not null default 0,
  primary key (device, day)
);

alter table private.push_jobs enable row level security;
alter table private.push_counters enable row level security;
revoke all on private.push_jobs, private.push_counters from public, anon, authenticated;

-- Time and counting (the rules of src/domain/notificationPlan.ts) ------------------------------

/** The local time of a moment in a time zone; an unknown zone counts as Berlin. */
create function private.local_time(p_now timestamptz, p_time_zone text) returns timestamp
language plpgsql stable set search_path = '' as $$
begin
  return p_now at time zone coalesce(p_time_zone, 'Europe/Berlin');
exception when others then
  return p_now at time zone 'Europe/Berlin';
end;
$$;

/** The local day a device is due for its daily overview at `p_now`, or null (`dailyOverviewDay`). */
create function private.daily_overview_day(
  p_now timestamptz, p_time_zone text, p_enabled boolean, p_time time, p_days integer,
  p_last date
) returns date
language plpgsql stable set search_path = '' as $$
declare
  v_local timestamp := date_trunc('minute', private.local_time(p_now, p_time_zone));
  v_late integer := ((extract(epoch from v_local::time) - extract(epoch from p_time)) / 60)::integer;
begin
  if coalesce(p_enabled, false)
    -- Monday = 1 … Sunday = 64.
    and coalesce(p_days, 0) & (1 << (extract(isodow from v_local)::integer - 1)) <> 0
    and v_late between 0 and 119
    and (p_last is null or p_last < v_local::date) then
    return v_local::date;
  end if;
  return null;
end;
$$;

/** Whether a local time lies in the quiet hours `from` (included) to `to`, also over midnight. */
create function private.is_quiet_time(p_time time, p_from time, p_to time) returns boolean
language sql immutable set search_path = '' as $$
  select case
    when p_from < p_to then p_time >= p_from and p_time < p_to
    when p_from > p_to then p_time >= p_from or p_time < p_to
    else false
  end;
$$;

/**
 * What the daily overview of the person in place `p_role` tells (`myDueCounts`): the open tasks of
 * the household that are theirs (taken over by them, or without a takeover theirs or both
 * people's), due on `p_day` or earlier; overdue those due before. Deleted tasks and done one-off
 * tasks do not count. Only this one household: nobody else's tasks can get in.
 */
create function private.daily_counts(p_household uuid, p_role text, p_day date) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'due', count(*) filter (where t.data ->> 'dueDate' <= to_char(p_day, 'YYYY-MM-DD')),
    'overdue', count(*) filter (where t.data ->> 'dueDate' < to_char(p_day, 'YYYY-MM-DD')))
  from public.tasks t
  where t.household_id = p_household
    and t.deleted_at is null
    and (t.data ->> 'kind' = 'recurring' or t.data -> 'done' is distinct from 'true'::jsonb)
    and case
      when t.data ->> 'kind' = 'recurring' and t.data ->> 'takenOverBy' in ('personA', 'personB')
        then t.data ->> 'takenOverBy' = p_role
      else t.data ->> 'assignee' in (p_role, 'both')
    end;
$$;

-- The schedule -----------------------------------------------------------------------------------

/** Plans the daily overviews due at `p_now`, one per device and local day; returns how many. */
create function private.plan_daily_pushes(p_now timestamptz) returns integer
language plpgsql set search_path = '' as $$
declare
  v_planned integer;
begin
  with due as (
    select d.id, private.daily_overview_day(
        p_now, d.time_zone, d.daily_enabled, d.daily_time, d.daily_days, d.last_daily_on) as day
      from public.push_devices d
      where d.daily_enabled
        and exists (select 1 from public.household_members m where m.user_id = d.user_id)
  ), noted as (
    update public.push_devices d set last_daily_on = due.day
      from due
      where d.id = due.id and due.day is not null
      returning d.id, due.day
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
 * Every minute (`pg_cron`): plans what is due and, if a message waits, calls the Edge Function.
 * Without the two Vault entries it does nothing and says so (`notConfigured`).
 */
create function private.push_tick(p_now timestamptz default now()) returns jsonb
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
 * Hands out up to `p_limit` (at most 100) due messages with the device's push address and what to
 * tell, and keeps them for this run for 3 minutes. Counted only now, for the owner's household.
 */
create function private.claim_push_jobs(p_limit integer, p_now timestamptz default now())
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_job record;
  v_household uuid;
  v_role text;
  v_day date;
  v_counts jsonb;
  v_jobs jsonb := '[]'::jsonb;
  v_empty integer := 0;
  v_dropped integer := 0;
begin
  for v_job in
    select j.id, j.device, d.user_id, d.endpoint, d.p256dh, d.auth, d.key_id, d.time_zone
      from private.push_jobs j
      join public.push_devices d on d.id = j.device
      where j.kind = 'daily' and j.not_before <= p_now and j.expires_at > p_now
        and (j.claimed_until is null or j.claimed_until <= p_now)
      order by j.not_before, j.id
      limit least(greatest(coalesce(p_limit, 0), 0), 100)
      for update of j skip locked
  loop
    v_day := private.local_time(p_now, v_job.time_zone)::date;
    v_household := null;
    select m.household_id, m.role into v_household, v_role
      from public.household_members m where m.user_id = v_job.user_id;
    v_counts := case when v_household is null then null
      else private.daily_counts(v_household, v_role, v_day) end;
    if v_counts is null or (v_counts ->> 'due')::integer = 0 then
      -- Nothing to tell (or no household any more): no message.
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
      v_jobs := v_jobs || jsonb_build_array(jsonb_build_object(
        'id', v_job.id,
        'kind', 'daily',
        'endpoint', v_job.endpoint,
        'p256dh', v_job.p256dh,
        'auth', v_job.auth,
        'keyId', v_job.key_id,
        'due', (v_counts ->> 'due')::integer,
        'overdue', (v_counts ->> 'overdue')::integer));
    end if;
  end loop;
  return jsonb_build_object('jobs', v_jobs, 'empty', v_empty, 'dropped', v_dropped);
end;
$$;

/**
 * What became of the messages of a run: `[{ "id", "outcome": "sent" | "retry" | "gone" |
 * "dropped", "retryAfter"? }]` (at most 100). Unknown ids change nothing.
 */
create function private.finish_push_jobs(p_results jsonb, p_now timestamptz default now())
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_result record;
  v_job private.push_jobs;
  v_zone text;
  v_sent integer := 0;
  v_retry integer := 0;
  v_gone integer := 0;
  v_dropped integer := 0;
begin
  if jsonb_typeof(p_results) is distinct from 'array' or jsonb_array_length(p_results) > 100 then
    raise exception 'invalid_results';
  end if;
  for v_result in
    select r.id, r.outcome, r."retryAfter" as retry_after
      from jsonb_to_recordset(p_results) as r(id bigint, outcome text, "retryAfter" integer)
  loop
    select * into v_job from private.push_jobs j where j.id = v_result.id for update;
    if not found then
      continue;
    end if;
    if v_result.outcome = 'sent' then
      delete from private.push_jobs j where j.id = v_job.id;
      update public.push_devices d set last_sent_at = p_now
        where d.id = v_job.device returning d.time_zone into v_zone;
      insert into private.push_counters as c (device, day, sent)
        values (v_job.device, private.local_time(p_now, v_zone)::date, 1)
        on conflict (device, day) do update set sent = c.sent + 1;
      v_sent := v_sent + 1;
    elsif v_result.outcome = 'gone' then
      -- The push service no longer knows the address: the device goes, with its messages.
      delete from public.push_devices d where d.id = v_job.device;
      v_gone := v_gone + 1;
    elsif v_result.outcome = 'retry' and v_job.attempts < 5 then
      update private.push_jobs j
        set claimed_until = null,
          not_before = p_now + greatest(
            case v_job.attempts
              when 1 then interval '5 minutes'
              when 2 then interval '15 minutes'
              else interval '1 hour'
            end,
            make_interval(secs => least(greatest(coalesce(v_result.retry_after, 0), 0), 3600)))
        where j.id = v_job.id;
      v_retry := v_retry + 1;
    else
      delete from private.push_jobs j where j.id = v_job.id;
      v_dropped := v_dropped + 1;
    end if;
  end loop;
  return jsonb_build_object('sent', v_sent, 'retry', v_retry, 'gone', v_gone, 'dropped', v_dropped);
end;
$$;

-- Once a day -------------------------------------------------------------------------------------

/** Deletes what is no longer needed (docs/BENACHRICHTIGUNGEN.md, 4.4 and 8.5). */
create function private.push_cleanup(p_now timestamptz default now()) returns jsonb
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
  begin
    -- `pg_cron` notes every run (1440 a day); only the last week is kept.
    delete from cron.job_run_details r where r.end_time < p_now - interval '7 days';
  exception when others then
    null;
  end;
  return jsonb_build_object('devices', v_devices, 'jobs', v_jobs);
end;
$$;

-- The API (only for the Edge Function) -----------------------------------------------------------

create function public.claim_push_jobs(p_limit integer) returns jsonb
language sql security invoker set search_path = '' as $$
  select private.claim_push_jobs(p_limit, now());
$$;

create function public.finish_push_jobs(p_results jsonb) returns jsonb
language sql security invoker set search_path = '' as $$
  select private.finish_push_jobs(p_results, now());
$$;

-- Who may call what ----------------------------------------------------------------------------

revoke execute on function
  private.local_time(timestamptz, text),
  private.daily_overview_day(timestamptz, text, boolean, time, integer, date),
  private.is_quiet_time(time, time, time),
  private.daily_counts(uuid, text, date),
  private.plan_daily_pushes(timestamptz),
  private.push_tick(timestamptz),
  private.claim_push_jobs(integer, timestamptz),
  private.finish_push_jobs(jsonb, timestamptz),
  private.push_cleanup(timestamptz),
  public.claim_push_jobs(integer),
  public.finish_push_jobs(jsonb)
from public, anon, authenticated;

grant usage on schema private to service_role;
grant execute on function
  private.claim_push_jobs(integer, timestamptz),
  private.finish_push_jobs(jsonb, timestamptz),
  public.claim_push_jobs(integer),
  public.finish_push_jobs(jsonb)
to service_role;

-- The schedule (UTC): every minute, and the cleanup at 03:23.
select cron.schedule('kruemel-push-tick', '* * * * *', 'select private.push_tick()');
select cron.schedule('kruemel-push-cleanup', '23 3 * * *', 'select private.push_cleanup()');
