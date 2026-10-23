-- Krümel, stage 2 (E2-3g): a name for the household.
--
-- The household may have a name (e.g. "WG Sonnenweg"), shown in the tile "Haushalt". It is not
-- part of the shared data (`AppData`), so it changes only online, through `rename_household`.
-- Without a name the column stays empty (an empty name removes it). The names of the two people
-- are unchanged: they are part of the shared data and change through `set_names`.
--
-- Security as before: the logic in `private`, a thin wrapper in `public` with the caller's rights;
-- members change only their own household (`lock_household`), nobody writes to the table directly.
-- The rules are those of `src/sync/fakeAccounts.ts` (`rename`), which the fake server follows too.

alter table public.households
  add column name text check (char_length(name) between 1 and 30);

/** Sets or (with an empty name) removes the name of the caller's household. */
create function private.rename_household(p_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_household uuid := private.lock_household();
  v_name text := nullif(trim(coalesce(p_name, '')), '');
begin
  if char_length(v_name) > 30 then
    raise exception 'invalid_household_name';
  end if;
  update public.households h set name = v_name where h.id = v_household;
end;
$$;

-- The API --------------------------------------------------------------------------------------

create function public.rename_household(p_name text) returns void
language sql security invoker set search_path = '' as $$
  select private.rename_household(p_name);
$$;

-- Who may call what ----------------------------------------------------------------------------

revoke execute on function
  private.rename_household(text),
  public.rename_household(text)
from public, anon, authenticated;

grant execute on function private.rename_household(text) to authenticated;
grant execute on function public.rename_household(text) to authenticated;
