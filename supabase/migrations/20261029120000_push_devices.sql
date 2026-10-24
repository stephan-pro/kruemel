-- Krümel, notifications (NT-a): the push addresses of the devices and the test notification.
--
-- - `push_devices`: one row per device and account. A device switches notifications on with
--   `register_push_device` (its own id from the device, the push address its browser made, the two
--   keys of that address, the short name of the public VAPID key, time zone and language) and off
--   with `unregister_push_device`. At most 10 devices per account; an 11th replaces the one seen
--   longest ago. A push address belongs to one account: registered by another account (another
--   person signed in on the same browser) it moves there. The rows go with the account
--   (`on delete cascade`, also through `delete_account`).
-- - Only push services of the allow list are stored (`private.is_push_endpoint`, the same list as
--   `supabase/functions/push/rules.ts`): otherwise the Edge Function could be made to call any
--   address (SSRF). The Edge Function checks it again before every request.
-- - `request_test_push`: the Edge Function `push` (route `test`) calls it with the person's sign-in
--   and gets the push address of that person's device, within the limits: one test per minute and
--   device, ten per day and account (`private.push_tests` remembers the requests of the last day).
--   Another person's device is "unknown", whatever its id.
-- - Reading: a person sees only their own devices and not the push address or its keys (the address
--   is a secret of the device); writing only through the functions. The table is not in the list of
--   Realtime (`supabase/tests/realtime.test.ts` checks the list).
--
-- Security as before: row level security, logic in `private` with the owner's rights and
-- `search_path = ''`, thin wrappers in `public` with the caller's rights, only for `authenticated`.

create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Made by the device (`kruemel:push-device`).
  device_id uuid not null,
  endpoint text not null unique,
  p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{87}$'),
  auth text not null check (auth ~ '^[A-Za-z0-9_-]{22}$'),
  -- Short name of the public VAPID key the address was made with (`keyIdOf` in rules.ts).
  key_id text not null check (key_id ~ '^[A-Za-z0-9_-]{1,32}$'),
  time_zone text not null check (char_length(time_zone) between 1 and 64),
  locale text not null default 'de' check (locale ~ '^[a-z]{2}$'),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, device_id)
);
create index push_devices_user on public.push_devices (user_id, last_seen_at);

-- The test notifications asked for in the last day (limits of `request_test_push`).
create table private.push_tests (
  user_id uuid not null references auth.users (id) on delete cascade,
  device_id uuid not null,
  requested_at timestamptz not null default now()
);
create index push_tests_user on private.push_tests (user_id, requested_at);

alter table public.push_devices enable row level security;
alter table private.push_tests enable row level security;
create policy "Jede Person sieht ihre eigenen Geräte" on public.push_devices
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.push_devices from public, anon, authenticated;
revoke all on private.push_tests from public, anon, authenticated;
-- Without the push address and its keys.
grant select (id, user_id, device_id, key_id, time_zone, locale, created_at, last_seen_at)
  on public.push_devices to authenticated;

/** The allow list of push services (as `isPushEndpoint` in supabase/functions/push/rules.ts). */
create function private.is_push_endpoint(p_endpoint text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(
    char_length(p_endpoint) <= 1024
      and p_endpoint ~ ('^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com'
        || '|web\.push\.apple\.com|([a-z0-9-]+\.)+push\.apple\.com'
        || '|([a-z0-9-]+\.)+notify\.windows\.com)(:443)?/\S*$'),
    false);
$$;

alter table public.push_devices
  add constraint push_devices_endpoint check (private.is_push_endpoint(endpoint));

-- Devices --------------------------------------------------------------------------------------

/** Switches notifications on for one device of the caller, or brings its row up to date. */
create function private.register_push_device(
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
      case when coalesce(p_locale ~ '^[a-z]{2}$', false) then p_locale else 'de' end)
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

/** Switches notifications off for one device of the caller; anything else changes nothing. */
create function private.unregister_push_device(p_device_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not_signed_in';
  end if;
  delete from public.push_devices d where d.user_id = auth.uid() and d.device_id = p_device_id;
end;
$$;

/**
 * A test notification for one device of the caller, within the limits: the push address and its
 * keys for the Edge Function, which sends it at once.
 */
create function private.request_test_push(p_device_id uuid) returns jsonb
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
    'keyId', v_device.key_id);
end;
$$;

-- The API --------------------------------------------------------------------------------------

create function public.register_push_device(
  p_device_id uuid, p_endpoint text, p_p256dh text, p_auth text, p_key_id text,
  p_time_zone text, p_locale text
) returns void
language sql security invoker set search_path = '' as $$
  select private.register_push_device(
    p_device_id, p_endpoint, p_p256dh, p_auth, p_key_id, p_time_zone, p_locale);
$$;

create function public.unregister_push_device(p_device_id uuid) returns void
language sql security invoker set search_path = '' as $$
  select private.unregister_push_device(p_device_id);
$$;

create function public.request_test_push(p_device_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$
  select private.request_test_push(p_device_id);
$$;

-- Who may call what ----------------------------------------------------------------------------

revoke execute on function
  private.is_push_endpoint(text),
  private.register_push_device(uuid, text, text, text, text, text, text),
  private.unregister_push_device(uuid),
  private.request_test_push(uuid),
  public.register_push_device(uuid, text, text, text, text, text, text),
  public.unregister_push_device(uuid),
  public.request_test_push(uuid)
from public, anon, authenticated;

grant execute on function
  private.register_push_device(uuid, text, text, text, text, text, text),
  private.unregister_push_device(uuid),
  private.request_test_push(uuid),
  public.register_push_device(uuid, text, text, text, text, text, text),
  public.unregister_push_device(uuid),
  public.request_test_push(uuid)
to authenticated;
