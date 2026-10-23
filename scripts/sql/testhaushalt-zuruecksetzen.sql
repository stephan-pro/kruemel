-- Krümel: Haushalte im echten Projekt ansehen und einen Test-Haushalt zurücksetzen.
-- Nur für den PO, im Supabase-Dashboard → SQL Editor. Nie von Claude oder CI ausgeführt.
--
-- Teil 1 nur lesen: einfach ausführen.
-- Teil 2 löscht: erst lesen, Platzhalter ersetzen, die Zeilen einzeln wieder einkommentieren
-- (die "-- " am Zeilenanfang entfernen) und ausführen. Löschen lässt sich nicht rückgängig machen.

-- Teil 1a: alle Haushalte mit ihren Mitgliedern (Rolle, E-Mail, seit wann).
select
  h.id as haushalt,
  h.person_a_name,
  h.person_b_name,
  m.role as rolle,
  u.email,
  m.joined_at as dabei_seit,
  u.last_sign_in_at as zuletzt_angemeldet
from public.households h
left join public.household_members m on m.household_id = h.id
left join auth.users u on u.id = m.user_id
order by h.created_at, m.role;

-- Teil 1b: Einladungen (wer hat welche wann angenommen).
select
  i.household_id as haushalt,
  i.created_at as erzeugt,
  i.expires_at as gueltig_bis,
  i.used_at as angenommen,
  u.email as angenommen_von
from public.invites i
left join auth.users u on u.id = i.used_by
order by i.created_at;

-- Teil 1c: alle Konten und wie viele Aufgaben und Erledigungen ihr Haushalt hat.
select
  u.email,
  u.created_at as konto_seit,
  m.household_id as haushalt,
  (select count(*) from public.tasks t where t.household_id = m.household_id) as aufgaben,
  (select count(*) from public.completions c where c.household_id = m.household_id) as erledigungen
from auth.users u
left join public.household_members m on m.user_id = u.id
order by u.created_at;

-- Teil 2 (auskommentiert): den Test-Haushalt ganz entfernen.
-- 'HAUSHALT-ID' durch die Spalte "haushalt" aus Teil 1a ersetzen. Mitglieder, Einladungen,
-- Aufgaben und Erledigungen dieses Haushalts verschwinden mit (on delete cascade); die Konten
-- bleiben. Danach zeigt die App beim nächsten Öffnen "Haushalt anlegen".
--
-- delete from public.households where id = 'HAUSHALT-ID';

-- Teil 2b (auskommentiert, nur wenn nötig): ein reines Testkonto ganz löschen.
-- 'TEST-ADRESSE' durch die E-Mail des Testkontos ersetzen, nie die eigene oder die der zweiten
-- Person. Es fällt damit auch aus jedem Haushalt heraus.
--
-- delete from auth.users where email = 'TEST-ADRESSE';
