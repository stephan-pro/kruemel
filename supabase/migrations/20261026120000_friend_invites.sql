-- Krümel, stage 2 (E2-5b): new accounts only with an invite.
--
-- - Friend invites (`friend_invites`): a member makes a link with which somebody else gets an
--   account and then creates a household of their own. Like the household invite it works for
--   7 days and once. A person has at most 5 open friend invites at a time and makes at most 10 in
--   24 hours (withdrawn ones count too), so a member cannot flood the mail sender with it.
-- - The gate (`before_user_created`): Supabase Auth calls this function before it creates an
--   account and before it sends the mail with the code (Auth hook "Before User Created", set up in
--   the dashboard, see docs/SUPABASE.md; locally in `supabase/config.toml`). The app hands the key
--   of the opened link to the code request (`signInWithOtp`, `options.data.invite`); the function
--   checks it here in the database, the metadata alone count for nothing. A valid friend invite is
--   used up by it, a valid household invite is marked (`invites.signed_up_at`) and can bring in
--   only one new account; joining with it (`accept_invite`) stays as before. Anything else is
--   refused with 403: `invite_required` (no key), `invite_invalid` (unknown, used, expired,
--   withdrawn). Then Supabase creates nothing and sends no mail.
-- - Existing accounts sign in as before (the hook only runs for new accounts), and so do accounts
--   the operator makes in the dashboard ("Add user" → "Create new user" does not call the hook).
--
-- Security as before: row level security, writing only through functions (logic in `private`
-- with the owner's rights, thin wrappers in `public` with the caller's rights, only for
-- `authenticated`); the hook may only be called by Supabase Auth (`supabase_auth_admin`). The rules
-- are those of `src/sync/fakeAccounts.ts` (`createFriendInvite`, `admit`), which the fake server
-- follows too.

create table public.friend_invites (
  token text primary key,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  -- When an account was made with it (no address is kept).
  used_at timestamptz,
  -- When its creator withdrew it.
  cancelled_at timestamptz
);
create index friend_invites_creator on public.friend_invites (created_by, created_at);

alter table public.friend_invites enable row level security;
create policy "Jede Person sieht ihre eigenen Freundes-Einladungen" on public.friend_invites
  for select to authenticated using (created_by = (select auth.uid()));
revoke all on public.friend_invites from anon, authenticated;
grant select on public.friend_invites to authenticated;

-- When a new account was made with the household invite (one account per invite).
alter table public.invites add column signed_up_at timestamptz;

-- Friend invites -------------------------------------------------------------------------------

/** A new friend invite (7 days, once); only for members, within the limits above. */
create function private.create_friend_invite() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_token text;
  v_expires timestamptz := now() + interval '7 days';
begin
  if auth.uid() is null then
    raise exception 'not_signed_in';
  end if;
  if not exists (select 1 from public.household_members m where m.user_id = auth.uid()) then
    raise exception 'no_household';
  end if;
  -- One at a time per person, so two taps at once cannot pass the limits together.
  perform pg_advisory_xact_lock(hashtextextended('friend_invites:' || auth.uid()::text, 0));
  delete from public.friend_invites f
    where f.created_by = auth.uid() and f.created_at < now() - interval '30 days';
  if (
    select count(*) from public.friend_invites f
    where f.created_by = auth.uid() and f.used_at is null and f.cancelled_at is null
      and f.expires_at > now()
  ) >= 5 then
    raise exception 'friend_invites_open';
  end if;
  if (
    select count(*) from public.friend_invites f
    where f.created_by = auth.uid() and f.created_at > now() - interval '1 day'
  ) >= 10 then
    raise exception 'friend_invites_today';
  end if;
  -- 24 random bytes as URL-safe text (it goes into the link after #/freunde/).
  v_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
  insert into public.friend_invites (token, created_by, expires_at)
    values (v_token, auth.uid(), v_expires);
  return jsonb_build_object('token', v_token, 'expiresAt', v_expires);
end;
$$;

/** The caller's open friend invites (not used, not withdrawn, not expired), oldest first. */
create function private.open_friend_invites() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not_signed_in';
  end if;
  return coalesce((
    select jsonb_agg(
        jsonb_build_object('token', f.token, 'expiresAt', f.expires_at) order by f.created_at)
      from public.friend_invites f
      where f.created_by = auth.uid() and f.used_at is null and f.cancelled_at is null
        and f.expires_at > now()
  ), '[]'::jsonb);
end;
$$;

/** Withdraws one of the caller's open friend invites; anything else changes nothing. */
create function private.cancel_friend_invite(p_token text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not_signed_in';
  end if;
  update public.friend_invites f set cancelled_at = now()
    where f.token = p_token and f.created_by = auth.uid() and f.used_at is null
      and f.cancelled_at is null;
end;
$$;

-- The gate for new accounts (Auth hook "Before User Created") -----------------------------------

create function public.before_user_created(event jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_token text := event -> 'user' -> 'user_metadata' ->> 'invite';
begin
  if v_token is null or v_token = '' then
    return jsonb_build_object(
      'error', jsonb_build_object('http_code', 403, 'message', 'invite_required'));
  end if;
  update public.friend_invites f set used_at = now()
    where f.token = v_token and f.used_at is null and f.cancelled_at is null
      and f.expires_at > now();
  if found then
    return '{}'::jsonb;
  end if;
  update public.invites i set signed_up_at = now()
    where i.token = v_token and i.used_at is null and i.signed_up_at is null
      and i.expires_at > now();
  if found then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object(
    'error', jsonb_build_object('http_code', 403, 'message', 'invite_invalid'));
end;
$$;

-- The API --------------------------------------------------------------------------------------

create function public.create_friend_invite() returns jsonb
language sql security invoker set search_path = '' as $$
  select private.create_friend_invite();
$$;

create function public.open_friend_invites() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select private.open_friend_invites();
$$;

create function public.cancel_friend_invite(p_token text) returns void
language sql security invoker set search_path = '' as $$
  select private.cancel_friend_invite(p_token);
$$;

-- Who may call what ----------------------------------------------------------------------------

revoke execute on function
  private.create_friend_invite(),
  private.open_friend_invites(),
  private.cancel_friend_invite(text),
  public.create_friend_invite(),
  public.open_friend_invites(),
  public.cancel_friend_invite(text),
  public.before_user_created(jsonb)
from public, anon, authenticated;

grant execute on function
  private.create_friend_invite(),
  private.open_friend_invites(),
  private.cancel_friend_invite(text),
  public.create_friend_invite(),
  public.open_friend_invites(),
  public.cancel_friend_invite(text)
to authenticated;

grant execute on function public.before_user_created(jsonb) to supabase_auth_admin;
