-- Krümel, K2c (Prüfbericht E2-5d): `household_members` is no longer announced by Realtime.
--
-- The app listens to `households`, `tasks` and `completions` only (`supabaseRemote.ts`), never to
-- the members. Realtime sends delete events without applying row level security, so the (random)
-- ids of removed rows would reach every signed-in person. Nothing needs them, so the table leaves
-- the publication. Reading the table stays as it was (row level security, members only).

alter publication supabase_realtime drop table public.household_members;
