-- Krümel, stage 2 (E2-5a): remove the other person, leave the household, delete one's account.
--
-- - `remove_member`: a member removes the other person (both are equal, there is no owner). The
--   place is free again and can be invited anew. Removing a place that is free already changes
--   nothing (a second click, or both devices at once); removing oneself is refused (that is
--   leaving).
-- - `leave_household`: a member leaves. The tasks, completions and names stay in the household for
--   the other person; whoever is invited next takes over the free place with its name. The last
--   person to leave takes the household with them: it is deleted with all its data (the app says
--   so before and downloads a backup).
-- - `delete_account`: leaves the household as above and deletes the caller's own account
--   (`auth.users`; sessions and sign-in data go with it by the cascades of Supabase). New accounts
--   are only made by the operator, so there is no way back in by oneself (the app says so).
--
-- Each runs in one transaction under the lock on the household (`lock_household`), so nothing is
-- left half done and two calls at the same time queue up. Nobody needs a secret key: the functions
-- in `private` run with the owner's rights and only ever touch the caller (`auth.uid()`) and the
-- caller's household. Security as before: thin wrappers in `public` with the caller's rights, only
-- for `authenticated`. The rules are those of `src/sync/fakeAccounts.ts` (`removeMember`, `leave`,
-- `deleteAccount`), which the fake server follows too.

/** Takes the caller out of the (locked) household; the last one out deletes it. */
create function private.leave(p_household uuid) returns void
language plpgsql set search_path = '' as $$
begin
  delete from public.household_members m
    where m.household_id = p_household and m.user_id = auth.uid();
  if not exists (select 1 from public.household_members m where m.household_id = p_household) then
    -- Tasks, completions, invites and the remembered answers go with it (cascades).
    delete from public.households h where h.id = p_household;
  end if;
end;
$$;

/** Removes the person in the other place (`personA` or `personB`) from the caller's household. */
create function private.remove_member(p_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_household uuid := private.lock_household();
  v_own text;
begin
  select m.role into v_own from public.household_members m where m.user_id = auth.uid();
  if p_role is null or p_role not in ('personA', 'personB') or p_role = v_own then
    raise exception 'invalid_member';
  end if;
  delete from public.household_members m
    where m.household_id = v_household and m.role = p_role;
end;
$$;

create function private.leave_household() returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.leave(private.lock_household());
end;
$$;

/** Deletes the caller's own account; a second call (with the old session) changes nothing. */
create function private.delete_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not_signed_in';
  end if;
  if exists (select 1 from public.household_members m where m.user_id = auth.uid()) then
    perform private.leave(private.lock_household());
  end if;
  delete from auth.users u where u.id = auth.uid();
end;
$$;

-- The API --------------------------------------------------------------------------------------

create function public.remove_member(p_role text) returns void
language sql security invoker set search_path = '' as $$
  select private.remove_member(p_role);
$$;

create function public.leave_household() returns void
language sql security invoker set search_path = '' as $$
  select private.leave_household();
$$;

create function public.delete_account() returns void
language sql security invoker set search_path = '' as $$
  select private.delete_account();
$$;

-- Who may call what ----------------------------------------------------------------------------

revoke execute on function
  private.leave(uuid),
  private.remove_member(text),
  private.leave_household(),
  private.delete_account(),
  public.remove_member(text),
  public.leave_household(),
  public.delete_account()
from public, anon, authenticated;

grant execute on function
  private.remove_member(text),
  private.leave_household(),
  private.delete_account()
to authenticated;

grant execute on function
  public.remove_member(text),
  public.leave_household(),
  public.delete_account()
to authenticated;
