-- Krümel, notifications (NT-b): the settings of a device.
--
-- Each device (a row of `push_devices`) chooses for itself which notifications it gets and when:
-- the daily overview (on/off, time of day, weekdays), a message when the other person did or took
-- over something for me, a message when somebody joins the household, and quiet hours. Nothing
-- here sends anything yet (the schedule is NT-c, the messages about the other person NT-d); the
-- settings are only kept so those can follow them.
--
-- - New columns with the defaults of docs/BENACHRICHTIGUNGEN.md (1.2): everything on, overview at
--   07:30 on every weekday, quiet hours 21:00 to 07:00. `daily_days` is a bit mask of the weekdays
--   (Monday = 1 … Sunday = 64). Times are local to the device (its `time_zone`).
-- - `update_push_settings` changes the settings of one device of the caller. The values are checked
--   twice, as `pushSettingsProblems` in supabase/functions/push/rules.ts does: here (the function
--   and a table check) and in the app. `register_push_device` keeps the settings when a device
--   registers again (a new address, a new time zone, the app started).
-- - Reading: a person sees the settings of their own devices (like the other columns, not the push
--   address). Writing only through the function.
--
-- Security as before: logic in `private` with the owner's rights and `search_path = ''`, a thin
-- wrapper in `public` with the caller's rights, only for `authenticated`.

alter table public.push_devices
  add column daily_enabled boolean not null default true,
  add column daily_time time not null default '07:30',
  add column daily_days smallint not null default 127,
  add column partner_enabled boolean not null default true,
  add column household_enabled boolean not null default true,
  add column quiet_enabled boolean not null default true,
  add column quiet_from time not null default '21:00',
  add column quiet_to time not null default '07:00',
  add constraint push_devices_settings check (
    daily_days between 0 and 127
    and (not daily_enabled or daily_days > 0)
    and extract(second from daily_time) = 0
    and extract(second from quiet_from) = 0
    and extract(second from quiet_to) = 0
    and (not quiet_enabled or quiet_from <> quiet_to)
  );

grant select (
  daily_enabled, daily_time, daily_days, partner_enabled, household_enabled,
  quiet_enabled, quiet_from, quiet_to
) on public.push_devices to authenticated;

/** Changes the settings of one device of the caller; anything invalid changes nothing. */
create function private.update_push_settings(
  p_device_id uuid, p_daily_enabled boolean, p_daily_time text, p_daily_days integer,
  p_partner_enabled boolean, p_household_enabled boolean,
  p_quiet_enabled boolean, p_quiet_from text, p_quiet_to text
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
      quiet_to = p_quiet_to::time
    where d.user_id = v_user and d.device_id = p_device_id;
  if not found then
    raise exception 'push_device_unknown';
  end if;
end;
$$;

create function public.update_push_settings(
  p_device_id uuid, p_daily_enabled boolean, p_daily_time text, p_daily_days integer,
  p_partner_enabled boolean, p_household_enabled boolean,
  p_quiet_enabled boolean, p_quiet_from text, p_quiet_to text
) returns void
language sql security invoker set search_path = '' as $$
  select private.update_push_settings(
    p_device_id, p_daily_enabled, p_daily_time, p_daily_days,
    p_partner_enabled, p_household_enabled, p_quiet_enabled, p_quiet_from, p_quiet_to);
$$;

revoke execute on function
  private.update_push_settings(uuid, boolean, text, integer, boolean, boolean, boolean, text, text),
  public.update_push_settings(uuid, boolean, text, integer, boolean, boolean, boolean, text, text)
from public, anon, authenticated;

grant execute on function
  private.update_push_settings(uuid, boolean, text, integer, boolean, boolean, boolean, text, text),
  public.update_push_settings(uuid, boolean, text, integer, boolean, boolean, boolean, text, text)
to authenticated;
