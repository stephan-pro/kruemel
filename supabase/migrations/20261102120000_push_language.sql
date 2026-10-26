-- Krümel, notifications (EN-c): the language of a device.
--
-- Each device (a row of `push_devices`) has a language, `locale`: "de" or "en". The app tells it when
-- the device registers (`register_push_device`), when it saves its settings (`update_push_settings`,
-- new last argument `p_locale`) and when the person switches the language (the app registers
-- again). The Edge Function `push` puts it into every message it sends (`"l":"en"` for English,
-- nothing for German), and the device writes the text in that language. So `request_test_push` and
-- `claim_push_jobs` now hand out the language with the push address.
--
-- - `locale` was `^[a-z]{2}$` since NT-a; now only "de" and "en" are allowed (rows with another
--   value become "de"). A value the server does not know counts as "de"
--   (`private.push_language`), in every function that takes one.
-- - Reading and writing as before: a person sees the language of their own devices (the column was
--   granted in NT-a), writes it only through the functions. Row level security is unchanged.
-- - `update_push_settings` keeps the old call working: without `p_locale` (null) the language of the
--   device stays as it is. Its old signature goes, so there is only one function of that name.
--
-- Security as before: logic in `private` with the owner's rights and `search_path = ''`, thin
-- wrappers in `public` with the caller's rights, only for `authenticated` (and `claim_push_jobs`
-- only for `service_role`).

update public.push_devices set locale = 'de' where locale not in ('de', 'en');

alter table public.push_devices drop constraint push_devices_locale_check;
alter table public.push_devices
  add constraint push_devices_locale check (locale in ('de', 'en'));

/** The language of a message for what a device says: "en", else "de". */
create function private.push_language(p_locale text) returns text
language sql immutable set search_path = '' as $$
  select case when p_locale = 'en' then 'en' else 'de' end;
$$;

revoke execute on function private.push_language(text) from public, anon, authenticated;

-- Registering ----------------------------------------------------------------------------------

/** Switches notifications on for one device of the caller, or brings its row up to date. */
create or replace function private.register_push_device(
  p_device_id uuid, p_endpoint text, p_p256dh text, p_auth text, p_key_id text,
  p_time_zone text, p_locale text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_time_zone text := 'Europe/Berlin';
begin
  if v_user is null then
    raise exception 'not_signed_in';
  end if;
  if p_device_id is null or not private.is_push_endpoint(p_endpoint) then
    raise exception 'push_endpoint_invalid';
  end if;
  if coalesce(p_p256dh !~ '^[A-Za-z0-9_-]{87}$', true)
    or coalesce(p_auth !~ '^[A-Za-z0-9_-]{22}$', true)
    or coalesce(p_key_id !~ '^[A-Za-z0-9_-]{1,32}$', true) then
    raise exception 'push_keys_invalid';
  end if;
  -- Unknown time zones become Berlin (docs/BENACHRICHTIGUNGEN.md, 4.2).
  if char_length(p_time_zone) <= 64
    and exists (select 1 from pg_catalog.pg_timezone_names z where z.name = p_time_zone) then
    v_time_zone := p_time_zone;
  end if;
  -- One at a time per person, so two taps at once cannot pass the limit together.
  perform pg_advisory_xact_lock(hashtextextended('push_devices:' || v_user::text, 0));
  -- The address belongs to one account and one device: an older row of it goes.
  delete from public.push_devices d
    where d.endpoint = p_endpoint and (d.user_id <> v_user or d.device_id <> p_device_id);
  insert into public.push_devices as d
      (user_id, device_id, endpoint, p256dh, auth, key_id, time_zone, locale)
    values (
      v_user, p_device_id, p_endpoint, p_p256dh, p_auth, p_key_id, v_time_zone,
      private.push_language(p_locale))
    on conflict (user_id, device_id) do update set
      endpoint = excluded.endpoint, p256dh = excluded.p256dh, auth = excluded.auth,
      key_id = excluded.key_id, time_zone = excluded.time_zone, locale = excluded.locale,
      last_seen_at = now();
  -- At most 10 devices: the ones seen longest ago go.
  delete from public.push_devices d
    where d.id in (
      select o.id from public.push_devices o where o.user_id = v_user
        order by o.last_seen_at desc, o.created_at desc offset 10);
end;
$$;

-- The settings ---------------------------------------------------------------------------------

drop function public.update_push_settings(
  uuid, boolean, text, integer, boolean, boolean, boolean, text, text);
drop function private.update_push_settings(
  uuid, boolean, text, integer, boolean, boolean, boolean, text, text);

/**
 * Changes the settings of one device of the caller; anything invalid changes nothing. With
 * `p_locale` the language of the device is set too (an unknown one becomes "de"); without, it stays.
 */
create function private.update_push_settings(
  p_device_id uuid, p_daily_enabled boolean, p_daily_time text, p_daily_days integer,
  p_partner_enabled boolean, p_household_enabled boolean,
  p_quiet_enabled boolean, p_quiet_from text, p_quiet_to text, p_locale text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  c_time constant text := '^([01][0-9]|2[0-3]):[0-5][0-9]$';
begin
  if v_user is null then
    raise exception 'not_signed_in';
  end if;
  if p_daily_enabled is null or p_partner_enabled is null or p_household_enabled is null
    or p_quiet_enabled is null or p_daily_days is null
    or coalesce(p_daily_time !~ c_time, true)
    or coalesce(p_quiet_from !~ c_time, true)
    or coalesce(p_quiet_to !~ c_time, true)
    or p_daily_days not between 0 and 127
    or (p_daily_enabled and p_daily_days = 0)
    or (p_quiet_enabled and p_quiet_from = p_quiet_to) then
    raise exception 'push_settings_invalid';
  end if;
  update public.push_devices d set
      daily_enabled = p_daily_enabled,
      daily_time = p_daily_time::time,
      daily_days = p_daily_days,
      partner_enabled = p_partner_enabled,
      household_enabled = p_household_enabled,
      quiet_enabled = p_quiet_enabled,
      quiet_from = p_quiet_from::time,
      quiet_to = p_quiet_to::time,
      locale = case when p_locale is null then d.locale else private.push_language(p_locale) end
    where d.user_id = v_user and d.device_id = p_device_id;
  if not found then
    raise exception 'push_device_unknown';
  end if;
end;
$$;

create function public.update_push_settings(
  p_device_id uuid, p_daily_enabled boolean, p_daily_time text, p_daily_days integer,
  p_partner_enabled boolean, p_household_enabled boolean,
  p_quiet_enabled boolean, p_quiet_from text, p_quiet_to text, p_locale text default null
) returns void
language sql security invoker set search_path = '' as $$
  select private.update_push_settings(
    p_device_id, p_daily_enabled, p_daily_time, p_daily_days,
    p_partner_enabled, p_household_enabled, p_quiet_enabled, p_quiet_from, p_quiet_to, p_locale);
$$;

revoke execute on function
  private.update_push_settings(
    uuid, boolean, text, integer, boolean, boolean, boolean, text, text, text),
  public.update_push_settings(
    uuid, boolean, text, integer, boolean, boolean, boolean, text, text, text)
from public, anon, authenticated;

grant execute on function
  private.update_push_settings(
    uuid, boolean, text, integer, boolean, boolean, boolean, text, text, text),
  public.update_push_settings(
    uuid, boolean, text, integer, boolean, boolean, boolean, text, text, text)
to authenticated;

-- What the Edge Function gets ------------------------------------------------------------------

/**
 * A test notification for one device of the caller, within the limits: the push address, its keys
 * and the device's language for the Edge Function, which sends it at once.
 */
create or replace function private.request_test_push(p_device_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_device public.push_devices;
begin
  if v_user is null then
    raise exception 'not_signed_in';
  end if;
  select * into v_device from public.push_devices d
    where d.user_id = v_user and d.device_id = p_device_id;
  if not found then
    raise exception 'push_device_unknown';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('push_tests:' || v_user::text, 0));
  delete from private.push_tests t where t.requested_at < now() - interval '1 day';
  if exists (
    select 1 from private.push_tests t
    where t.user_id = v_user and t.device_id = p_device_id
      and t.requested_at > now() - interval '1 minute'
  ) then
    raise exception 'push_test_wait';
  end if;
  if (select count(*) from private.push_tests t where t.user_id = v_user) >= 10 then
    raise exception 'push_test_today';
  end if;
  insert into private.push_tests (user_id, device_id) values (v_user, p_device_id);
  return jsonb_build_object(
    'endpoint', v_device.endpoint,
    'p256dh', v_device.p256dh,
    'auth', v_device.auth,
    'keyId', v_device.key_id,
    'locale', v_device.locale);
end;
$$;

/**
 * Hands out up to `p_limit` (at most 100) due messages with the device's push address, its
 * language and what to tell, and keeps them for this run for 3 minutes. Counted only now, for the
 * owner's household; messages about the other person in the device's quiet hours wait for their
 * end.
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
        d.locale, d.partner_enabled, d.household_enabled, d.quiet_enabled, d.quiet_from, d.quiet_to
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
          'keyId', v_job.key_id,
          'locale', v_job.locale)
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
