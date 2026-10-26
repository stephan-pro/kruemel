# Krümel – Benachrichtigungen (Paket NT)

Stand: 25.10.2026 · Paket NT-e abgeschlossen als Dokumentationspaket; Durchstich getestet, NT-d-Test und Redmi-Hintergrund offen (Gerätetest-Protokoll Abschnitt 12, Nutzer-Anleitung Abschnitt 13); Abschnitte 1–11 sind der Plan von NT-0 (24.10.2026) mit den tatsächlichen Namen in 10.1–10.4 · Grundlage: `ANFORDERUNGEN.md` (S1–S6, N2, N3), `PLAN.md`, `ETAPPE2.md`, `SUPABASE.md`, `PRUEFBERICHT-E2.md` (Datenliste), `src/ui/legalTexts.ts`, `src/sw.ts`, `src/csp.ts`, `supabase/migrations/`, `.github/workflows/`.

Krümel soll Benachrichtigungen schicken, auch wenn die App geschlossen ist. Dieses Dokument enthält Entscheidungen, Fakten mit Quellen, Varianten, Fachregeln, Datenmodell, Sicherheit, Tests und die Bau-Pakete NT-a bis NT-e. Spätere Sitzungen lesen nur dieses Dokument, `CLAUDE.md` und das jeweilige Paket.

## 0. Kurzfassung

- **Empfehlung: Variante A, Web-Push über Supabase.** Jedes Gerät meldet seine Push-Adresse an die Datenbank. Ein Zeitplan in der Datenbank (`pg_cron`, jede Minute) legt fällige Meldungen in eine Warteschlange, eine Edge Function `push` verschlüsselt sie und schickt sie über den Push-Dienst des Browsers (Google, Mozilla, Apple, Microsoft) an das Gerät. Der Service Worker zeigt die Meldung, auch bei geschlossener App.
- **Kosten:** 0 € (alles im kostenlosen Tarif, siehe Abschnitt 2.4). **Aufwand:** 5 Bau-Pakete, etwa 6–8 Sitzungen; zuerst ein Durchstich (Testbenachrichtigung vom Server auf alle drei Geräte; getestet 24.10.2026, siehe Abschnitt 12), dann die Fachlogik.
- **Größtes Risiko:** iPhone (nur als App vom Home-Bildschirm, ab iOS 16.4, Erlaubnis nur per Tippen) und das Redmi (Akku-Verwaltung von HyperOS kann Firefox im Hintergrund bremsen). Deshalb zuerst der Durchstich auf echten Geräten.

## 1. Entscheidungen

### 1.1 Entscheidungen des PO (24.10.2026, jeweils Empfehlung)

| Frage | Entscheidung |
|---|---|
| Ereignisse | **Tagesüberblick** (morgens, nur wenn es etwas gibt) **und Partner-Meldung** (die andere Person hat eine Aufgabe für dich erledigt oder übernommen); dazu selten **Haushaltsereignis** „ist jetzt dabei“. Keine Abend-Erinnerung (später möglich). |
| Uhrzeit Tagesüberblick | **07:30 Uhr** als Standard, pro Gerät änderbar. |
| Zeitzone | **Pro Gerät, automatisch** (`Intl.DateTimeFormat().resolvedOptions().timeZone`, z. B. `Europe/Berlin`), beim Einschalten gemeldet und bei jedem Start der App aktualisiert. |
| Umfang | **Variante A in Etappen**: Durchstich zuerst, dann Einstellungen, Zeitplan, Partner-Meldungen, Gerätetest. |

### 1.2 Standardwerte (von Claude festgelegt, im Bau-Paket änderbar)

- **Ruhezeiten:** an, 21:00–07:00 Uhr Ortszeit des Geräts. Gelten für Partner- und Haushaltsmeldungen; was in die Ruhezeit fällt, wird gesammelt und am Ende der Ruhezeit als **eine** Meldung geschickt. Der Tagesüberblick kommt zur gewählten Uhrzeit, auch wenn sie in der Ruhezeit liegt (man hat sie bewusst gewählt). Die Testbenachrichtigung kommt immer sofort.
- **Wochentage des Tagesüberblicks:** Mo–So (alle an), pro Gerät abwählbar.
- **Tagesüberblick nur, wenn es etwas gibt:** keine Meldung bei 0 fälligen und 0 überfälligen Aufgaben.
- **Bündeln statt Flut:** Partner-Meldungen warten 5 Minuten und fassen alles in dieser Zeit zusammen („Robin hat 3 Aufgaben für dich erledigt.“). Wird in diesen 5 Minuten „Rückgängig“ gedrückt, entfällt die Meldung.
- **Keine Aufgabentitel auf dem Sperrbildschirm:** Meldungen nennen nur Zahlen und den Namen der anderen Person (aus dem Haushalt, höchstens 30 Zeichen).
- **Einstellungen pro Gerät** (nicht pro Konto): jedes Gerät hat eigenen Schalter, eigene Uhrzeit, eigene Ruhezeit. Begründung: Handy und PC sollen sich unterschiedlich verhalten können; die Zeitzone ist ohnehin eine Geräteangabe.
- **Speichern der Einstellungen** mit Knopf „Speichern“ und nur online (sie liegen auf dem Server); ohne Internet eine klare Meldung.
- **Ungenutzte Geräte:** Eine Push-Adresse, die 90 Tage nicht mehr von der App bestätigt wurde, löscht der Server (Datensparsamkeit). Die App bestätigt sie bei jedem Start.
- **Grenzen:** höchstens 10 Geräte je Konto; Testbenachrichtigung höchstens 1 pro Minute und Gerät, 10 pro Tag und Konto; je Gerät höchstens 8 Meldungen am Tag (Sicherheitsnetz, Test ausgenommen).
- **Bibliothek für das Verschlüsseln** (Edge Function): `@block65/webcrypto-web-push` (MIT), Ausweichlösung `web-push` (MPL-2.0); Entscheidung mit einem Test in NT-a (Abschnitt 2.5).
- **Region:** Die Edge Function wird mit `x-region: eu-west-3` (Paris, wie die Datenbank) aufgerufen.

## 2. Fakten aus der Recherche (Stand Oktober 2026)

### 2.1 Der Standard

- **Web Push** besteht aus Push API, Notifications API und Service Worker im Browser sowie drei IETF-Standards: Zustellung (RFC 8030), Verschlüsselung der Nachricht (RFC 8291, `aes128gcm`) und Absenderkennung VAPID (RFC 8292). Die Push API ist seit März 2023 in allen großen Browsern verfügbar („Baseline“). [MDN Push API]
- **Ablauf:** Die Seite ruft `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` mit dem **öffentlichen** VAPID-Schlüssel auf. Der Browser liefert eine *Push-Adresse* (`endpoint`, eine geheime URL beim Push-Dienst des Browsers) und zwei Schlüssel (`p256dh`, `auth`). Der Server verschlüsselt jede Nachricht mit diesen Schlüsseln und signiert die Anfrage mit dem **privaten** VAPID-Schlüssel. [RFC 8291, MDN]
- **Die Push-Adresse ist eine „Capability-URL“:** Wer sie kennt, kann (mit passendem Schlüssel) Nachrichten an das Gerät senden. Sie ist also geheim zu halten und personenbezogen. [MDN Push API]
- **Jeder Push muss eine sichtbare Meldung zeigen** (`userVisibleOnly: true`); stille Pushes erlauben die Browser nicht dauerhaft. Firefox begrenzt Pushes ohne Meldung. [MDN Push API]
- **`pushsubscriptionchange`:** Der Browser kann eine Push-Adresse ersetzen; der Service Worker bekommt dann dieses Ereignis. [MDN Push API]
- **Optionen beim Senden:** `TTL` (wie lange der Push-Dienst die Nachricht für ein ausgeschaltetes Gerät aufhebt), `Urgency` und `Topic` (eine neuere Nachricht mit gleichem Topic ersetzt eine noch nicht zugestellte). [web-push README]
- **Ohne Server geht es nicht:** Die „Notification Triggers“ (Erinnerung zu einer Uhrzeit ohne Server) sind über eine Testphase in Chrome nie hinausgekommen; „Periodic Background Sync“ gibt es nur in Chromium für installierte Apps, nicht in Safari und Firefox, und der Browser bestimmt den Takt. [web.dev Notification Triggers, MDN Periodic Background Sync]

### 2.2 Geräte und Browser

| Gerät | Unterstützung | Einschränkungen |
|---|---|---|
| **iPhone/iPad** (Dilan, Safari, App vom Home-Bildschirm) | Ab **iOS/iPadOS 16.4**, nur für eine **zum Home-Bildschirm hinzugefügte Web-App** (Manifest `display: standalone`, haben wir). Push-Dienst: Apple (APNs, Adressen `*.push.apple.com`). | Im normalen Safari-Tab gibt es keine Push API. Die Erlaubnis darf **nur nach einem Tippen** (z. B. Knopf) erfragt werden. Mitteilungen lassen sich unter Einstellungen → Mitteilungen → Krümel verwalten; Fokus-Modi gelten. Die App auf dem Home-Bildschirm hat eigene Daten (eigene Anmeldung, bekannt aus Etappe 1). Löscht man sie vom Home-Bildschirm, ist die Push-Adresse weg. **EU:** Apple wollte Home-Bildschirm-Web-Apps in der EU mit iOS 17.4 abschalten und hat das im März 2024 zurückgenommen; sie laufen weiter mit WebKit. Seit iOS 18.4 gibt es zusätzlich „Declarative Web Push“ (Meldung kommt auch ohne Service Worker an), nur für Home-Bildschirm-Apps. [WebKit 16.4, WebKit Declarative Web Push, 9to5Mac, Silicon] |
| **Redmi, Android, Firefox** (Stephan) | Firefox für Android unterstützt Web Push über den Mozilla-Dienst (autopush), der für die Zustellung ans Handy Googles FCM nutzt; Meldungen kommen laut Mozilla/Drittquellen auch bei geschlossenem Browser. | Die „App“ ist in Firefox eine Verknüpfung; Meldungen erscheinen unter „Firefox“. Zwei Erlaubnisse: die der Website in Firefox und die Android-Erlaubnis „Benachrichtigungen“ für Firefox (Android 13+). **HyperOS/MIUI** beendet Hintergrund-Apps zum Akkusparen; empfohlen: Firefox → Akku „Keine Einschränkungen“, Autostart an. Für installierte Web-Apps in Firefox Android fand sich keine aktuelle offizielle Doku → **im Durchstich NT-a prüfen.** [Mozilla Wiki, Mozilla Support, pushpad, Xiaomi-Hinweise] |
| **Android, Chrome** (falls genutzt) | Volle Unterstützung, Push-Dienst Google FCM (`fcm.googleapis.com`). | Akku-Verwaltung des Herstellers wie oben. |
| **Windows-PC** (Chrome, Edge oder Firefox) | Unterstützt; Chrome nutzt FCM, Edge den Windows-Dienst (`*.notify.windows.com`), Firefox Mozilla. | **Meldungen kommen nur, solange der Browser läuft.** Edge läuft nach dem Schließen standardmäßig im Hintergrund weiter (Einstellung „Erweiterungen und Apps im Hintergrund weiter ausführen“); bei Chrome berichten Nutzer, dass ohne offenes Fenster oder offene installierte App nichts ankommt; Firefox nur bei offenem Firefox. Windows „Nicht stören“ unterdrückt Meldungen. [Edge-Blog, 3CX, Mozilla Support] |

### 2.3 Push-Dienste und Datenschutz

- Jeder Browser schickt Pushes über **seinen** Dienst: Chrome → Google (FCM), Firefox → Mozilla (autopush, auf Android zusätzlich FCM), Safari/iPhone → Apple (APNs), Edge → Microsoft (WNS). Man kann den Dienst nicht wählen.
- Der **Inhalt ist Ende-zu-Ende verschlüsselt** (RFC 8291): Der Push-Dienst kann ihn weder lesen noch ändern. [RFC 8291]
- **Der Push-Dienst sieht trotzdem:** die Push-Adresse (Gerätekennung bei ihm), Zeitpunkt und Größe jeder Nachricht, TTL/Topic/Urgency, die IP-Adresse des Absenders (Supabase) und die Absenderkennung (VAPID-Schlüssel, darin die Kontaktadresse `VAPID_SUBJECT`). Er kann also erkennen, *dass* und *wann* Krümel ein Gerät benachrichtigt.
- **Folge:** Die Anbieter sind Empfänger personenbezogener Daten, teils in den USA. Das kommt in die Datenschutzerklärung (Abschnitt 8.4). Wir halten den Inhalt klein (nur Zahlen und ein Vorname) und schicken nicht häufiger als nötig.

### 2.4 Supabase im kostenlosen Tarif

- **Edge Functions:** 500 000 Aufrufe im Monat inklusive; je Aufruf höchstens 2 s CPU-Zeit (Warten auf Netz zählt nicht), 150 s Laufzeit, 256 MB Speicher; 100 Funktionen je Projekt; ausgehende Verbindungen nur nicht auf Port 25/587. Wir rechnen mit unter 2 000 Aufrufen im Monat. [Supabase Limits, Pricing]
- **Zeitplan:** `pg_cron` (Zeitplan in der Datenbank) und `pg_net` (HTTP-Aufruf aus der Datenbank) sind im gehosteten Supabase verfügbar; Supabase empfiehlt genau diese Kombination, um Edge Functions regelmäßig aufzurufen, und Geheimnisse dafür im **Vault** abzulegen. **Achtung (Doku):** `pg_net` legt den entschlüsselten Schlüssel kurz in `net.http_request_queue` ab, bis die Anfrage raus ist. Deshalb nehmen wir für diesen Aufruf ein **eigenes Token** (`PUSH_CRON_TOKEN`) statt des Secret Keys des Projekts. [Supabase Scheduling Edge Functions]
- **Secrets der Edge Functions:** im Dashboard unter Edge Functions → Secrets (`…/project/<ref>/functions/secrets`) oder per CLI `supabase secrets set`; wirken sofort ohne neues Bereitstellen; Namen dürfen nicht mit `SUPABASE_` beginnen. Jede Funktion hat von selbst `SUPABASE_URL`, `SUPABASE_SECRET_KEYS` (umgeht den Zeilenschutz), `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_JWKS` u. a. Nur Owner/Administratoren setzen Secrets. [Supabase Secrets]
- **Region:** Edge Functions laufen sonst nahe am Aufrufer; mit Header `x-region: eu-west-3` (oder `forceFunctionRegion`) laufen sie in Paris. Bei Ausfall dieser Region wird dann nicht umgeleitet. [Supabase Regional Invocations]
- **Pausierung:** Ein kostenloses Projekt pausiert nach 7 Tagen ohne genug Datenbank-Aktivität; der Workflow `keepalive` ruft täglich `ping` auf. Während einer Pause kommen **keine** Benachrichtigungen. Ob `pg_cron`-Läufe als Aktivität zählen, sagt nur ein Forumsbeitrag (ja) – wir verlassen uns weiter auf `keepalive`. [Supabase Project Pausing]
- **Kosten:** keine zusätzlichen. Die Push-Dienste der Browser sind kostenlos.

### 2.5 Bibliotheken (nur für die Edge Function; der Browser braucht keine)

Selbst verschlüsseln ist ausgeschlossen (S4: keine eigene Kryptografie). Geprüft:

| Paket | Lizenz | Laufzeit | Bewertung |
|---|---|---|---|
| `@block65/webcrypto-web-push` | MIT | Nur WebCrypto; laut Projekt Node, Deno, Bun, Cloudflare Workers. `aes128gcm` (ab Version 2; Apple verlangt das). Schlüssel als base64url-Zeichenketten (`subject`, `publicKey`, `privateKey`), passend zu `web-push generate-vapid-keys`. Nutzlast bis 3 993 Byte. | **Erste Wahl.** Klein, für Edge-Laufzeiten gebaut, 2026 gepflegt. Nicht von Kryptografie-Fachleuten geprüft (wie alle Alternativen außer `web-push`). |
| `web-push` (npm) | MPL-2.0 (Datei-Copyleft, unverändert nutzbar) | Für Node.js (Node-`crypto`); unter Deno nur über die Node-Kompatibilität, für Supabase nicht belegt. | **Ausweichlösung**, falls block65 im Durchstich scheitert. Referenz-Umsetzung, sehr verbreitet. Wird ohnehin einmalig per `npx` zum Erzeugen der Schlüssel genutzt (keine Projekt-Abhängigkeit). |
| `@negrel/webpush` (JSR) | MIT | Deno, WebCrypto | Verworfen: sehr klein (36 Sterne), Autor schreibt selbst „nicht von Kryptografie-Fachleuten geprüft“, Schlüssel im JWK-Format (Umwandlung nötig). |

NT-a legt die Version fest (exakte Version im Import der Edge Function und als Entwicklungsabhängigkeit für die Vitest-Tests), prüft die Lizenz-Datei und begründet die Abhängigkeit in `PLAN.md` (N7). Ein Test verschlüsselt mit der Bibliothek und entschlüsselt mit WebCrypto gegen ein im Test erzeugtes Schlüsselpaar (Abschnitt 9.1).

## 3. Varianten

| | A) Web-Push mit Edge Function und Zeitplan in der Datenbank | B) Ohne Server: Hinweise bei geöffneter App | C) Fremder Push-Anbieter (z. B. OneSignal, Firebase-SDK) |
|---|---|---|---|
| Was | Gerät meldet Push-Adresse; `pg_cron` plant, Edge Function `push` sendet über den Push-Dienst des Browsers | Beim Öffnen „Heute: 3 Aufgaben“ als Hinweis bzw. Meldung über den Service Worker, App-Symbol mit Zahl (`setAppBadge`) | SDK des Anbieters im Browser, Anbieter plant und sendet |
| Bei geschlossener App | **ja** | nein (Ziel verfehlt) | ja |
| Datenschutz | Push-Dienste der Browser (unvermeidbar), sonst nur Supabase Paris | am besten | zusätzlicher Anbieter (USA), fremdes Skript, Tracking-Funktionen, AVV nötig; verletzt S6 und die CSP |
| Aufwand | 5 Pakete, 6–8 Sitzungen | 1 Paket, klein | mittel, aber fremde Abhängigkeit |
| Kosten | 0 € | 0 € | Gratis-Stufen, Bindung an Anbieter |
| PO muss | Schlüssel erzeugen, 4 Secrets setzen, 1 Variable, Migrationen, Funktion bereitstellen | nichts | Konto beim Anbieter |

**Empfehlung A.** Nur A erfüllt „auch bei geschlossener App“ ohne neuen Anbieter; alles läuft im vorhandenen Supabase-Projekt, Regeln und Tests folgen dem Muster der Etappe 2 (Logik in SQL unter Zeilenschutz, Vertrags- und S5-Tests im Job `db`). B ist als Ergänzung nicht nötig: Die App zeigt beim Öffnen ohnehin „Heute“. Ebenfalls verworfen: **GitHub Actions als Zeitplan** statt `pg_cron` (geplante Läufe kommen oft deutlich verspätet, schalten sich nach 60 Tagen ohne Commit ab und bräuchten ein Geheimnis in GitHub, was ETAPPE2.md ausschließt).

## 4. Fachliches

### 4.1 Ereignisse

| Art (Code) | Wann | Wer bekommt sie | Inhalt (deutsch, kurz) |
|---|---|---|---|
| `daily` Tagesüberblick | zur gewählten Uhrzeit (Standard 07:30) an den gewählten Wochentagen, Ortszeit des Geräts | jedes Gerät mit eingeschaltetem Tagesüberblick | „Heute 3 Aufgaben für dich, davon 1 überfällig.“ – nichts, wenn 0 |
| `partner` Partner-Meldung | 5 Minuten nach einer Erledigung oder Übernahme durch die andere Person, gebündelt | Geräte der Person, deren Aufgabe es war | „Robin hat 2 Aufgaben für dich erledigt.“ / „Robin hat eine Aufgabe von dir übernommen.“ / beides in einem Satz |
| `joined` Haushaltsereignis | eine Person tritt dem Haushalt bei (Einladung angenommen) | Geräte der anderen Person | „Robin ist jetzt im Haushalt dabei.“ |
| `test` Testbenachrichtigung | Knopf „Testbenachrichtigung senden“ | nur dieses Gerät | „Benachrichtigungen kommen auf diesem Gerät an.“ |

**Wann ist eine Partner-Meldung fällig?** Eine Erledigung (Zeile in `completions`), deren `completedBy` die *andere* Person ist und deren `assigneeAtCompletion` die empfangende Person oder `both` ist. Bei `both` bekommt die andere Person die Meldung (die Aufgabe gehörte beiden; ein Abhaken reicht, F5). Übernahme: Eine Änderung einer Aufgabe, die `takenOverBy` auf die andere Person setzt oder `assignee` von der empfangenden Person auf die andere ändert. Sich selbst benachrichtigt niemand. Haushaltsereignisse beim Entfernen oder Verlassen schicken wir bewusst nicht (heikel, die betroffene Person sieht es in der App).

### 4.2 „Fällig“ und Zeitzone

- Termine sind Kalendertage ohne Uhrzeit (`dueDate` = `"YYYY-MM-DD"`, PLAN.md Abschnitt 1). **„Heute“ ist der Kalendertag in der Zeitzone des Geräts** zum Zeitpunkt des Versands: `(p_now at time zone time_zone)::date`.
- **Für dich fällig** = offene Aufgabe (wiederkehrend, oder einmalig und nicht `done`, nicht gelöscht), `dueDate` ≤ heute, und „meine“ nach derselben Regel wie `isMine` in `src/domain/assignment.ts`: `takenOverBy` = ich, oder ohne Übernahme `assignee` = ich oder `both`. **Überfällig** = `dueDate` < heute.
- Die Regel steht damit zweimal: in TypeScript (Fachlogik, für Tests und Vorschau) und in SQL (Server). Damit beide nicht auseinanderlaufen, gibt es **eine gemeinsame Fall-Tabelle** `src/domain/notificationPlan.cases.ts` (reine Daten), die Vitest gegen die TS-Funktion und der Job `db` gegen die SQL-Funktion prüft – wie `describeRemoteContract` für Fake und Supabase.
- **Uhrzeit:** Der Tagesüberblick ist fällig, sobald die Ortszeit die gewählte Uhrzeit erreicht oder überschritten hat und für diesen Ortstag noch keiner verschickt wurde. Bei der Zeitumstellung fällt er so nie aus und kommt nie doppelt (Sprung vor: kommt zur ersten gültigen Minute; Sprung zurück: Ortstag schon vermerkt). Genauigkeit: innerhalb einer Minute (Zeitplan jede Minute).
- **Zeitzone ungültig/unbekannt:** Der Server prüft gegen `pg_timezone_names`; sonst `Europe/Berlin`.
- **Reisen:** Die App meldet bei jedem Start die aktuelle Zeitzone; ein Gerät, das in New York geöffnet wurde, bekommt den Überblick um 07:30 New Yorker Zeit.

### 4.3 Doppelte vermeiden, Ruhezeiten, Bündeln

- **Doppelte:** Jede geplante Meldung hat einen eindeutigen Schlüssel (`daily:<Gerät>:<Ortstag>`, `partner:<Gerät>:<laufende Nummer>`, `joined:<Gerät>:<Person>`), die Datenbank lässt keinen zweiten zu. Die Edge Function holt Meldungen mit einer Sperre ab (`for update skip locked`, „in Arbeit bis“), damit zwei überlappende Läufe nichts doppelt senden. Zusätzlich `Topic` beim Push-Dienst (`daily`, `partner`): Ein Gerät, das lange aus war, bekommt nur die neueste Meldung einer Art. Auf dem Gerät ersetzt eine neue Meldung mit gleichem `tag` die alte.
- **Ruhezeiten (pro Gerät, Standard 21:00–07:00):** Partner- und Haushaltsmeldungen, deren Sendezeit in die Ruhezeit fällt, werden auf das Ende der Ruhezeit verschoben und dabei gebündelt. Über Mitternacht gehende Ruhezeiten sind erlaubt (von > bis).
- **Bündeln:** Pro Gerät gibt es höchstens eine wartende Partner-Meldung. Neue Ereignisse innerhalb der 5 Minuten hängen sich an; gezählt wird erst beim Versand (dann zählen nur Ereignisse, die noch gelten).
- **Obergrenze:** höchstens 8 Meldungen je Gerät und Tag (Test ausgenommen); was darüber geht, wird verworfen und protokolliert (Zahl, keine Inhalte).

### 4.4 Lebenszyklus der Push-Adresse

| Fall | Verhalten |
|---|---|
| **Abgelaufen/ungültig** | Der Push-Dienst antwortet 404 oder 410 → die Edge Function löscht die Zeile des Geräts. 429 und 5xx → später erneut (5 Min., 15 Min., 1 Std., höchstens 5 Versuche, `Retry-After` beachten). 400/403/413 → Meldung verwerfen, Code protokollieren (Programmfehler oder falscher Schlüssel). |
| **Browser ersetzt die Adresse** (`pushsubscriptionchange`) | Der Service Worker hat keine Anmeldung (die liegt im Seiten-Speicher). Er meldet sich deshalb nicht selbst am Server, sondern die App vergleicht **bei jedem Start** die aktuelle Push-Adresse mit der gemerkten und meldet eine neue an (`register_push_device`, aktualisiert auch Zeitzone und „zuletzt gesehen“). |
| **Ungenutzt** | 90 Tage ohne Start der App auf dem Gerät → Zeile wird gelöscht (Aufräumlauf täglich). Die App zeigt danach „aus“ und bietet Einschalten an. |
| **Ausschalten** in den Einstellungen | `unregister_push_device`, dann `subscription.unsubscribe()` im Browser. |
| **Abmelden** | Vor dem Abmelden wie „Ausschalten“. Ohne Internet: lokal `unsubscribe()` (der Push-Dienst antwortet dann 410 und der Server räumt beim nächsten Versand auf) und Merker `kruemel:push-unregister` → beim nächsten Start mit Netz nachholen. Meldet sich auf demselben Browser eine andere Person an und schaltet ein, übernimmt ihre Anmeldung die Zeile (die Push-Adresse ist eindeutig). |
| **Konto löschen** | `delete_account` löscht die Zeile in `auth.users`; Geräte und wartende Meldungen gehen per `on delete cascade` mit. |
| **Haushalt verlassen / entfernt werden** | Geräte gehören zum Konto, nicht zum Haushalt; sie bleiben für einen späteren Haushalt. Wartende Meldungen und Partner-Ereignisse der Person für den alten Haushalt löscht ein Trigger an `household_members`. Beim Versand prüft der Server zusätzlich, dass Absender und Empfänger noch im selben Haushalt sind. Ohne Haushalt gibt es keinen Tagesüberblick. |
| **Haushalt gelöscht** | Ereignisse hängen am Haushalt (`on delete cascade`). |
| **Schlüssel rotiert** | Abschnitt 7.6. |

### 4.5 Offline und Abgleich: Wann gilt eine Aufgabe als erledigt?

- **Maßgeblich ist der Server.** Eine Aufgabe gilt für Benachrichtigungen als erledigt, sobald die Erledigung **beim Server angekommen** ist. Ein Häkchen auf einem Gerät ohne Internet kennt der Server erst nach dem Abgleich (beim nächsten Öffnen, Wiederverbinden oder Speichern; die App gleicht im Hintergrund nicht ab).
- **Folge für den Tagesüberblick:** Wer offline abhakt und die App bis 07:30 nicht mit Netz öffnet, kann eine Aufgabe noch im Überblick sehen. Abgemildert: Gezählt wird erst beim Versand (nicht beim Planen); der Überblick nennt nur Zahlen; ein Tipp öffnet „Heute“, die App gleicht dann ab und zeigt den richtigen Stand. Ein Abgleich im Service Worker ist verworfen (Warteschlange und Anmeldung liegen im `localStorage`, den der Service Worker nicht lesen kann; Aufwand groß).
- **Partner-Meldungen nach langem Offline-Sein:** Das Ereignis entsteht beim Eintreffen am Server. Erledigungen mit `completedAt` älter als 24 Stunden lösen keine Meldung mehr aus (sonst käme nach dem Urlaub eine Flut), die übrigen werden wie immer gebündelt.
- **Rückgängig:** Wird eine Erledigung zurückgenommen (Grabstein in `completions`), entfernt ein Trigger das Ereignis; ist die Meldung noch nicht verschickt, zählt es nicht mehr. War sie schon verschickt, gibt es keine Korrektur-Meldung.
- **Gleichzeitig abgehakt:** Der Server nimmt nur die erste Erledigung an (Konfliktregel), also entsteht nur ein Ereignis. Aufgabe gelöscht, bevor die Meldung rausgeht → Ereignis zählt nicht.

## 5. Ablauf

1. **Einschalten (Gerät):** Knopf „Auf diesem Gerät einschalten“ → `Notification.requestPermission()` (im Klick) → `pushManager.subscribe` mit dem öffentlichen Schlüssel (`VITE_VAPID_PUBLIC_KEY`) → RPC `register_push_device(Gerät, Adresse, Schlüssel, Zeitzone, Einstellungen)` → Status „aktiv“. Die Geräte-ID (`crypto.randomUUID()`) liegt unter `kruemel:push-device` im Gerätespeicher.
2. **Jede Minute (Datenbank):** `pg_cron` ruft `private.push_tick()`: plant fällige Tagesüberblicke (eine Zeile je Gerät und Ortstag), gibt wartende Partner-Meldungen frei, deren 5 Minuten (und Ruhezeit) vorbei sind, und ruft **nur wenn etwas fällig ist** per `pg_net` die Edge Function `push` (Route `flush`, Header `x-kruemel-cron: <Token aus dem Vault>`, `x-region: eu-west-3`).
3. **Senden (Edge Function `push/flush`):** prüft das Token, holt bis zu 100 fällige Meldungen über `claim_push_jobs` (Secret Key, nur für `service_role` freigegeben; die Funktion berechnet erst jetzt Zahlen und Namen und lässt leere Tagesüberblicke weg), verschlüsselt je Gerät, schickt mit TTL/Topic/Urgency an die Push-Adresse und meldet die Ergebnisse über `finish_push_jobs` zurück (gesendet, später erneut, Gerät löschen, verworfen).
4. **Anzeigen (Service Worker):** `push`-Ereignis → `notificationFor(nutzlast)` (reine Funktion, Texte aus `src/push/messages.ts`) → `showNotification(titel, { body, tag, icon, lang, data })`. Unlesbare Nutzlast → allgemeine Meldung „Neues in Krümel“ (eine Meldung muss immer kommen, sonst entziehen Browser die Erlaubnis).
5. **Antippen:** `notificationclick` → vorhandenes Fenster der App nach vorn holen und `#/heute` öffnen, sonst neues Fenster. Die App gleicht beim Sichtbarwerden ohnehin ab.
6. **Testbenachrichtigung:** Knopf → Edge Function `push/test` mit der Anmeldung der Person (JWT, in der Funktion über `SUPABASE_JWKS`/supabase-js geprüft) → RPC `request_test_push(Gerät)` als diese Person (Grenzen) → sofortiger Versand nur dieser Meldung.

**Nutzlast (verschlüsselt, klein, ohne Texte):** `{"v":1,"k":"daily","due":3,"overdue":1}`, `{"v":1,"k":"partner","name":"Robin","done":2,"took":1}`, `{"v":1,"k":"joined","name":"Robin"}`, `{"v":1,"k":"test"}`. Die Texte baut erst das Gerät. Seit EN-c steht für ein englisches Gerät zusätzlich `"l":"en"` in der Nutzlast (z. B. `{"v":1,"k":"test","l":"en"}`); für Deutsch fehlt das Feld, ebenso bei unbekannten Werten (Spalte `push_devices.locale`, `de`/`en`, Standard `de`). TTL: Test 5 Min., Tagesüberblick 6 Std., Partner 12 Std., Haushalt 24 Std.; Urgency `normal`.

## 6. Datenmodell und Sicherheit

### 6.1 Tabellen (neue Migrationen, Muster der Etappe 2)

```
public.push_devices                      -- eine Zeile je Gerät und Konto
  id            uuid primary key default gen_random_uuid()
  user_id       uuid not null references auth.users on delete cascade
  device_id     uuid not null            -- vom Gerät (kruemel:push-device)
  endpoint      text not null unique     -- https, ≤ 1024 Zeichen, Host aus der Erlaubtliste
  p256dh        text not null            -- base64url, genau 87 Zeichen
  auth          text not null            -- base64url, genau 22 Zeichen
  key_id        text not null            -- Kurzkennung des öffentlichen VAPID-Schlüssels (Rotation)
  time_zone     text not null            -- gegen pg_timezone_names geprüft
  locale        text not null default 'de'  -- EN-c: nur 'de' oder 'en'; App meldet sie beim Registrieren,
                                            --       mit den Einstellungen und beim Sprachwechsel
  daily_enabled boolean not null default true,  daily_time time not null default '07:30',
  daily_days    smallint not null default 127   -- Bitmaske Mo..So
  partner_enabled boolean not null default true, household_enabled boolean not null default true
  quiet_enabled boolean not null default true,
  quiet_from    time not null default '21:00',  quiet_to time not null default '07:00'
  last_daily_on date,  created_at, last_seen_at, last_sent_at timestamptz, failures integer default 0
  unique (user_id, device_id)

private.push_events                      -- Partner- und Haushaltsereignisse, noch nicht verschickt
  id bigint identity, household_id → households on delete cascade, recipient_user, actor_user,
  kind ('done' | 'tookOver' | 'joined'), task_id, completion_id, created_at

private.push_jobs                        -- geplante Meldungen je Gerät
  id bigint identity, device → push_devices on delete cascade, kind, dedupe_key text unique,
  not_before timestamptz, claimed_until timestamptz, attempts smallint, created_at

private.push_counters                    -- Grenzen: Tests je Tag und Konto, Meldungen je Tag und Gerät
```

NT-a legt nur `push_devices` mit Adresse, Schlüsseln, `key_id`, Zeitzone und Zeitstempeln an; NT-b ergänzt die Einstellungsspalten, NT-c `push_jobs` und `push_counters`, NT-d `push_events`.

### 6.2 Zugriff (S5)

- **Zeilenschutz an jeder Tabelle.** `push_devices`: Lesen nur eigene Zeilen (`user_id = auth.uid()`), kein direktes Schreiben. Tabellen in `private` haben keine Rechte für `anon`/`authenticated`.
- **Schreiben nur über Funktionen** (Logik `security definer` in `private` mit `search_path = ''`, in `public` nur Hüllen mit Aufruferrechten; `anon` darf nichts): `register_push_device`, `update_push_settings`, `unregister_push_device`, `request_test_push` (alle nur `authenticated`, wirken nur auf `auth.uid()`). `claim_push_jobs`, `finish_push_jobs` nur für `service_role` (Edge Function). `push_tick`, `push_cleanup` laufen nur über `pg_cron` (keine Freigabe).
- **Keine Daten anderer:** Der Name der anderen Person und die Zahlen entstehen im Server aus dem eigenen Haushalt; eine Person kann keine Meldung an fremde Geräte auslösen (Ereignisse entstehen nur durch Trigger an den eigenen Haushaltsdaten).
- **S5-Tests (Job `db`):** zweiter Haushalt sieht/ändert keine Geräte; `anon` nichts; `authenticated` kann `claim_push_jobs`/`finish_push_jobs`/`push_tick` nicht aufrufen; Realtime: `push_devices` kommt **nicht** in die Echtzeit-Liste.

### 6.3 Missbrauch, Größen, Grenzen

- **Erlaubte Push-Dienste (gegen SSRF):** Sonst könnte jemand eine beliebige Adresse (z. B. interne Dienste) als „Push-Adresse“ eintragen und die Edge Function dorthin schicken lassen. Erlaubt sind nur `fcm.googleapis.com`, `updates.push.services.mozilla.com`, `web.push.apple.com` und Unteradressen von `push.apple.com` und `notify.windows.com`, jeweils `https`. Geprüft in der Datenbank **und** noch einmal in der Edge Function vor jedem `fetch`. Kommt ein Browser mit einem neuen Dienst, zeigt die App „Dieser Browser wird nicht unterstützt“ und die Liste wird per Migration erweitert.
- **Größen:** Adresse ≤ 1024 Zeichen, Schlüssel mit fester Länge, Zeitzone ≤ 64 Zeichen, Nutzlast ≤ 200 Byte. **Verschlüsselter Body ≤ 2744 Byte** (`MAX_PUSH_BODY_BYTES`): Mozilla nimmt für Geräte, die es über FCM erreicht (Firefox auf Android), nur 2744 statt 4096 Byte an und antwortet sonst 413 [autopush-rs HTTP API]. Deshalb wird **nicht aufgefüllt** (`encrypt.ts` mit `pad: false`; `buildPushPayload` der Bibliothek füllt auf 4096 auf, das war die Ursache von „Nicht gesendet“ auf dem Redmi nach NT-a). Der Push-Dienst sieht damit die echte Größe (ohnehin in 2.3 genannt).
- **Antworten des Push-Dienstes** (`pushAnswerFailure`): 2xx gesendet (Mozilla antwortet 201 ohne Inhalt), 404/410 `deviceGone`, 429/5xx/Zeitlimit (10 s)/keine Verbindung `pushFailed` („gerade nicht erreichbar“), andere 4xx (400, 401, 403, 413) `pushRejected` („abgelehnt, Einrichtung auf dem Server“). Weiterleitungen werden nicht verfolgt (`redirect: "error"`, zählt als keine Verbindung).
- **Grenzen:** 10 Geräte je Konto (das älteste wird ersetzt), Test 1/Min./Gerät und 10/Tag/Konto (Meldung „Bitte warte kurz“), 8 Meldungen/Tag/Gerät, 100 Meldungen je Lauf der Edge Function.
- **Edge Function:** `verify_jwt = false` in `supabase/config.toml` (Supabase rät bei den neuen Schlüsseln, selbst zu prüfen); Route `flush` nur mit `PUSH_CRON_TOKEN` (Vergleich in konstanter Zeit), Route `test` nur mit gültiger Anmeldung; alle anderen Wege 404. CORS nur für `https://stephan-pro.github.io` und `http://localhost:5173`.
- **Protokolle:** nie Push-Adresse, Schlüssel, Nutzlast, Namen oder Token; nur Meldungs-ID, Art, HTTP-Status und Dauer. Route `test` (seit der Fehlersuche Firefox Android): `{"route","status","error","host","bytes","push","cause","ms"}` mit `host` = Rechnername des Dienstes aus der Erlaubtliste, `push` = Status des Dienstes, `cause` = `timeout`/`network`/`tooLarge`, wenn er keinen Status lieferte.
- **CSP:** keine Änderung nötig. Die App spricht die Edge Function unter der Projekt-Adresse an (`connect-src` enthält sie schon); die Verbindung zum Push-Dienst baut der Browser selbst auf. `swScope` bleibt: Der Service Worker fasst weiterhin nur eigene GET-Anfragen an.
- **Restrisiko (akzeptiert, niedrig):** Wer die Push-Adresse eines fremden Geräts kennt (geheime URL), könnte sie im eigenen Konto anmelden und das Gerät bekäme dann Meldungen seines Haushalts. Ohne die Adresse geht das nicht; sie verlässt Gerät und Datenbank nie.

## 7. Geheimnisse: erzeugen, setzen, rotieren

**Grundsatz:** Der **private VAPID-Schlüssel** und das **`PUSH_CRON_TOKEN`** kommen **nie** ins Repository, in den Chat, in Tests, in Logs, in GitHub oder in Screenshots. Claude erzeugt und sieht sie nicht. Öffentlich (darf in die App und ins Repo-Umfeld) ist nur der **öffentliche VAPID-Schlüssel**.

**Wichtig:** Alle Befehle unten in einem **eigenen PowerShell-Fenster** ausführen (Startmenü → „PowerShell“), **nicht** im Terminal-Bereich der Claude-App – den kann Claude mitlesen. Geheimnisse **nicht** als Teil eines Befehls eintippen (PowerShell speichert Befehle im Verlauf); deshalb setzen wir Secrets im Dashboard und nicht mit `supabase secrets set NAME=Wert`.

### 7.1 VAPID-Schlüssel erzeugen (einmalig, vor NT-a)

1. PowerShell öffnen, in einen beliebigen Ordner **außerhalb** des Projekts wechseln: `cd $env:USERPROFILE`
2. Schlüsselpaar erzeugen (lädt das Werkzeug nur vorübergehend): `npx --yes web-push generate-vapid-keys`
3. Die Ausgabe zeigt „Public Key“ und „Private Key“ (je eine lange Zeichenkette aus Buchstaben, Ziffern, `-` und `_`). Fenster offen lassen und gleich Abschnitt 7.2 erledigen. Danach `Clear-Host` und das Fenster schließen. Den privaten Schlüssel zusätzlich im Passwortmanager ablegen (Eintrag „Krümel VAPID privat“) – sonst geht er nur durch Rotation (7.4) zu ersetzen.

### 7.2 Secrets der Edge Function setzen (Dashboard)

1. Browser: `https://supabase.com/dashboard/project/sedjrghhtopgewwkmvrw/functions/secrets` (Klickpfad: linke Leiste „Edge Functions“ → „Secrets“).
2. Je Zeile „Name“ und „Value“ eintragen, dann „Save“:
   - `VAPID_PUBLIC_KEY` = Public Key aus 7.1
   - `VAPID_PRIVATE_KEY` = Private Key aus 7.1
   - `VAPID_SUBJECT` = `mailto:kruemel.haushaltsapp@gmail.com` (Kontaktadresse für die Push-Dienste; Apple verlangt `mailto:` oder `https:`)
3. Prüfen: In der Liste stehen die drei Namen; die Werte zeigt Supabase nur als Kennzeichen. Nichts davon in den Chat kopieren.

### 7.3 Öffentlichen Schlüssel für die App setzen (GitHub)

1. `https://github.com/stephan-pro/kruemel/settings/variables/actions` (Klickpfad: Repository „Settings“ → „Secrets and variables“ → „Actions“ → Reiter „Variables“).
2. „New repository variable“: Name `VITE_VAPID_PUBLIC_KEY`, Wert = Public Key aus 7.1 → „Add variable“. (Eine **Variable**, kein Secret: Der Schlüssel ist öffentlich und steht ohnehin in der App.)
3. Lokal für `npm run dev` im Modus `supabase`: in `.env.local` die Zeile `VITE_VAPID_PUBLIC_KEY=<Public Key>` ergänzen (die Datei ist von Git ausgeschlossen). NT-a nimmt den Namen in `.env.example` auf (ohne Wert).

### 7.4 Token für den Zeitplan (vor NT-c)

1. PowerShell (eigenes Fenster), Token erzeugen und direkt in die Zwischenablage legen, ohne es anzuzeigen:
   `$b = New-Object byte[] 32; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b) | Set-Clipboard`
2. Edge-Function-Secret: wie 7.2, Name `PUSH_CRON_TOKEN`, Value mit Strg+V einfügen, „Save“.
3. Vault: `https://supabase.com/dashboard/project/sedjrghhtopgewwkmvrw/integrations/vault/secrets` (Klickpfad: „Integrations“ → „Vault“ → „Secrets“; heißt der Menüpunkt anders, in der Suche des Dashboards „Vault“ eingeben) → „Add new secret“: Name `push_cron_token`, Secret mit Strg+V einfügen → speichern. Zweites Secret: Name `project_url`, Secret `https://sedjrghhtopgewwkmvrw.supabase.co`.
4. Zwischenablage leeren: `Set-Clipboard -Value " "`.
   Der Zeitplan liest beide Werte nur über ihren Namen aus dem Vault; die Migration enthält keinen Wert. Ohne die Vault-Einträge tut der Zeitplan nichts (so auch in der lokalen Test-Instanz).

### 7.5 Bereitstellen der Edge Function (NT-a, danach bei jeder Änderung)

Im Projektordner (eigenes Terminal, wie bei `db push`): `npx supabase login` (falls nötig), `npx supabase link --project-ref sedjrghhtopgewwkmvrw` (einmal pro Rechner), dann `npx supabase functions deploy push`. Prüfen: Dashboard → „Edge Functions“ → `push` steht dort mit aktuellem Datum. Docker ist dafür nicht nötig. Nicht in CI (der Zugang zum Projekt kommt nie in GitHub).

### 7.6 Rotieren (bei Verdacht auf Abfluss, sonst nicht nötig)

- **`PUSH_CRON_TOKEN`:** jederzeit: 7.4 wiederholen und beide Stellen (Edge-Secret und Vault-Eintrag `push_cron_token`, dort „Edit“) mit dem neuen Wert überschreiben. Zwischen den beiden Schritten scheitern höchstens ein paar Läufe; sie werden nachgeholt.
- **VAPID-Schlüssel:** Jede Push-Adresse ist an den öffentlichen Schlüssel gebunden, mit dem sie entstand. Ablauf: (1) neues Paar wie 7.1 erzeugen; (2) alte Werte als `VAPID_PUBLIC_KEY_OLD`/`VAPID_PRIVATE_KEY_OLD` speichern, neue unter den normalen Namen (7.2); (3) GitHub-Variable `VITE_VAPID_PUBLIC_KEY` ändern und `pages` neu laufen lassen (Actions → pages → „Run workflow“). Die Edge Function nimmt je Gerät den Schlüssel, der zu `key_id` passt. Die neue App erkennt beim Start, dass ihre Push-Adresse zu einem anderen Schlüssel gehört, und meldet sich neu an (gelingt das ohne Tippen nicht, z. B. auf dem iPhone, zeigt die Kachel „Bitte Benachrichtigungen neu einschalten“). (4) Nach 30 Tagen die `…_OLD`-Secrets löschen; Geräte, die bis dahin nicht gestartet wurden, schaltet man neu ein. Bei echtem Abfluss Schritt 4 sofort (dann alle Geräte neu einschalten).
- **Was tun bei versehentlichem Teilen** (Chat, Screenshot, Commit): sofort rotieren; ein Commit mit Schlüssel bleibt im Verlauf, der Pre-Commit-Hook (`scan-secrets`) soll das verhindern – NT-a ergänzt dort ein Muster für VAPID-Privatschlüssel nur, wenn es eindeutig erkennbar ist (32 Byte base64url sind es nicht; dann bleibt es bei der Regel oben).

## 8. Oberfläche, Texte, Datenschutz

### 8.1 Kachel „Benachrichtigungen“ (Einstellungen, nach „Darstellung“; nur in den Modi `supabase` und `fake`)

- **Status als Satz** (in einer Statuszeile, die Änderungen ansagt, wie `SyncTile`):
  - „Auf diesem Gerät aktiv.“ (mit Uhrzeit des Überblicks)
  - „Aus.“ + Knopf **„Auf diesem Gerät einschalten“**
  - „Blockiert: Dieser Browser darf Krümel keine Benachrichtigungen schicken.“ + aufklappbare Anleitung **für diesen Browser** (Erkennung wie `installWay` in `install.ts`, neue reine Funktion `notificationWay`):
    - iPhone: Einstellungen-App → Mitteilungen → Krümel → „Mitteilungen erlauben“.
    - Firefox Android: Firefox-Menü ⋮ → Einstellungen → Website-Berechtigungen → Benachrichtigungen → Krümel-Adresse → Erlauben; außerdem Android-Einstellungen → Apps → Firefox → Benachrichtigungen an; Xiaomi/Redmi/POCO: Firefox → Akku → „Keine Einschränkungen“ und Autostart an.
    - Chrome/Edge (Android und PC): Symbol links neben der Adresse → Berechtigungen/Website-Einstellungen → Benachrichtigungen → Zulassen; Windows: Einstellungen → System → Benachrichtigungen → Browser an, „Nicht stören“ aus.
  - „Am iPhone erst zum Home-Bildschirm hinzufügen. Benachrichtigungen gibt es nur in der Krümel-App vom Home-Bildschirm.“ + Knopf „Anleitung zeigen“ (vorhandene `InstallSteps`).
  - „Dieser Browser kann keine Benachrichtigungen empfangen.“
  - „Ohne Internet nicht änderbar.“ / Fehler über `ErrorAlert` und `errorText`.
- **Die Erlaubnis wird nur per Knopf erfragt, nie automatisch** (kein Aufruf beim Start, kein Hinweis-Fenster).
- **Einstellungen (sichtbar, wenn aktiv), mit `fields.tsx`:** Kästchen „Tagesüberblick“ mit Uhrzeit (`<input type="time">`, Schritt 15 Min.) und Wochentagen (sieben Kästchen in einer `FieldGroup` „Tage“), Kästchen „Wenn {Name} etwas für dich erledigt oder übernimmt“, „Neues im Haushalt“, „Ruhezeit“ mit „von“/„bis“. Knopf „Speichern“, Rückmeldung „Gespeichert.“ in der Statuszeile, Fehler am Feld (`useFieldErrorFocus`).
- **Knöpfe:** „Testbenachrichtigung senden“ (danach „Gesendet. Sie sollte in wenigen Sekunden erscheinen.“; Grenze → „Bitte warte eine Minute.“), „Auf diesem Gerät ausschalten“ (ohne Rückfrage, jederzeit wieder einschaltbar).
- **Abmelden:** Rückfrage nennt zusätzlich „Benachrichtigungen auf diesem Gerät werden ausgeschaltet.“

### 8.2 Inhalt der Meldungen

- Titel immer „Krümel“; Text höchstens eine Zeile, **ohne Aufgabentitel, Notizen oder Checklisten** (Sperrbildschirm). Beispiele: „Heute 3 Aufgaben für dich, davon 1 überfällig.“ · „Heute 1 Aufgabe für dich.“ · „2 überfällige Aufgaben warten auf dich.“ · „Robin hat 2 Aufgaben für dich erledigt.“ · „Robin hat eine Aufgabe von dir übernommen.“ · „Robin hat eine Aufgabe für dich erledigt und eine übernommen.“ · „Robin ist jetzt im Haushalt dabei.“ · „Benachrichtigungen kommen auf diesem Gerät an.“ · Ersatz: „Neues in Krümel.“
- Symbol `icon-192.png`; `lang: "de"`; `tag` je Art (ersetzt die alte Meldung derselben Art); kein Ton-Zwang, kein Vibrationsmuster.
- Mehrzahl über `Intl.PluralRules`, damit Englisch später nur eine zweite Texttabelle braucht.

### 8.3 Texte und spätere Mehrsprachigkeit

- **`src/push/messages.ts`:** Texte der Meldungen als Funktionen der Nutzlast (`{ de: … }`, nur Deutsch jetzt), genutzt vom Service Worker und von der Vorschau in der Kachel.
- **`src/ui/notificationTexts.ts`:** alle Texte der Kachel und der Anleitungen, wie `accountTexts.ts`.
- Server schickt nur Codes und Zahlen und (EN-c) die Sprache des Geräts (`l`); `src/push/messageTexts.ts` hat beide Sprachen (`messageTextsFor`), die Texte der Kachel stehen in den Wörterbüchern (`notifications` in `src/i18n/`). Unbekannte Sprache = Deutsch. Dazu Migration `20261102120000_push_language.sql`: Prüfung der Werte, `update_push_settings(…, p_locale)`, Sprache in `request_test_push` und `claim_push_jobs`. Einspielen vor dem Bereitstellen der Funktion (die neue Funktion kommt auch ohne Migration zurecht und sendet dann Deutsch).

### 8.4 Barrierefreiheit (WCAG 2.2 AA)

- Kachel mit axe hell/dunkel, Tastatur (Reihenfolge, sichtbarer Fokus), Tippflächen ≥ 44 px, 360 px Breite, Windows-Kontrastmodus; Statuswechsel nach der Erlaubnis-Abfrage wird angesagt, der Fokus bleibt auf dem Knopf bzw. springt bei verschwundenem Knopf auf die Kachel-Überschrift; keine Zeitlimits; Anleitung als `<details>` oder Knopf mit `aria-expanded`.
- Die Meldung selbst gestaltet das Betriebssystem (Screenreader lesen Titel und Text). Kurze, eindeutige Sätze ohne Symbole als Bedeutungsträger.

### 8.5 Folgen für die Datenschutzerklärung (Paket NT-b, `legalTexts.ts`, `LEGAL_DATE` ändern)

Neuer Abschnitt „Benachrichtigungen“ (nur wenn eingeschaltet):
- **Daten:** Push-Adresse des Geräts mit zwei Schlüsseln, eine zufällige Geräte-Kennung, Zeitzone, Spracheinstellung, gewählte Einstellungen, Zeitpunkte der letzten Nutzung und Zustellung; daraus berechnete Inhalte (Zahl der Aufgaben, Name der anderen Person).
- **Zweck und Grundlage:** Benachrichtigungen, die du ausdrücklich eingeschaltet hast (Art. 6 Abs. 1 Buchst. b DSGVO; die Erlaubnis im Browser holt der Browser ein); Speichern der Geräte-Kennung auf dem Gerät ist technisch erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG).
- **Empfänger:** der Push-Dienst deines Browsers – Google (Chrome, Firefox auf Android), Mozilla (Firefox), Apple (iPhone/Safari), Microsoft (Edge), teils in den USA. Sie sehen nicht den Inhalt (verschlüsselt), aber Adresse, Zeitpunkt und Größe der Nachricht.
- **Dauer und Löschen:** bis du ausschaltest, dich abmeldest, das Konto löschst oder 90 Tage nach der letzten Nutzung der App auf dem Gerät; abgelaufene Adressen löscht der Server sofort. Geplante Meldungen höchstens 7 Tage.
- Abschnitt „Welche Daten“ und „Wie lange“ um je einen Punkt ergänzen; „Keine Werbung, kein Tracking“ bleibt richtig.
- `PRUEFBERICHT-E2.md`-Datenliste: in NT-e nachführen (Datenliste ist Teil des Abschlusses).

## 9. Teststrategie

### 9.1 Automatisch (`npm run check`, ohne Netz, Docker und Zugangsdaten)

- **Fachlogik (Vitest, ≥ 90 %):** `src/domain/notificationPlan.ts` – `myDueCounts(tasks, person, today)` (fällig/überfällig, `isMine`, `both`, Übernahme, einmalig erledigt, gelöscht), `isQuietTime`, `localDayAndTime` (mit fester Uhr und Zeitzonen inkl. Sommer-/Winterzeit), `partnerSummary(events)` (bündeln, Rückgängig, älter als 24 h). Fälle aus `notificationPlan.cases.ts`, die auch der Job `db` nutzt. Benennung nach Kriterium („Tagesüberblick: keine Meldung bei 0 Aufgaben“ …).
- **`src/push/` (neu, in die 90-%-Liste):** `notificationFor` (alle Arten, Mehrzahl, unbekannte/kaputte Nutzlast → Ersatz), `notificationWay` (Browser-Erkennung), Abgleich der Push-Adresse beim Start (`syncPushRegistration` gegen ein Fake-`PushPort` und Fake-API: neue Adresse, anderer Schlüssel, Abmelde-Merker, offline).
- **Edge Function (Vitest):** Kern `supabase/functions/push/core.ts` ohne Deno-Importe (Verschlüsseln und `fetch` werden hereingereicht; nur `index.ts` importiert per `npm:`). Gegen einen **Mock-Push-Dienst** (ein `fetch`, das Anfragen aufzeichnet und 201/404/410/429/500/413 liefert): richtige Header (`TTL`, `Topic`, `Urgency`, `Authorization: vapid …`), Ergebnisse an `finish_push_jobs`, Löschen bei 404/410, Wiederholen mit Abstand, Erlaubtliste der Hosts, Token-Prüfung, keine Adressen im Protokoll. **Ein Test mit echter Kryptografie:** Schlüsselpaar des „Geräts“ und VAPID-Paar werden **im Test** mit WebCrypto erzeugt (nie gespeichert), die Bibliothek verschlüsselt, der Test entschlüsselt nach RFC 8291 und prüft die VAPID-Signatur.
- **E2E (Playwright gegen den Fake-Server, Modus `e2e`):** Der echte Push-Dienst ist im Test nicht erreichbar; der Modus `e2e` nimmt deshalb ein Fake-`PushPort` (Erlaubnis und Adresse simuliert, Zustände „blockiert“, „nicht unterstützt“, „iPhone ohne Home-Bildschirm“ über eine Test-Route). Der Fake-Server bekommt `/push/*` mit denselben Regeln (Grenzen, Erlaubtliste) und `GET /test/pushes` (aufgezeichnete Meldungen). Neue Spec `notifications.spec.ts`: Einschalten nur per Knopf, Status je Zustand mit Anleitung, Test senden (Meldung beim Fake angekommen, Grenze), Einstellungen speichern und Fehler am Feld, offline, Ausschalten, Abmelden schaltet aus; zwei Kontexte: B hakt eine Aufgabe von A ab → nach dem (im Fake verkürzten) Bündeln liegt eine Partner-Meldung für A vor, „Rückgängig“ innerhalb der Frist → keine; axe hell/dunkel, 360 px, Tastatur. Nur Chromium/Desktop (nicht in `CROSS_BROWSER_SPECS`), außer der Statusanzeige für iPhone (User-Agent, wie `install.spec.ts`).
- **Service Worker:** Ein E2E prüft, dass `sw.js` die Ereignisse `push` und `notificationclick` registriert und `notificationFor` einbindet (Zustellen echter Pushes ist in Playwright nicht möglich).

### 9.2 Datenbank (`npm run check:db`, nur CI, Job `db`)

- `supabase/tests/push.test.ts`: S5 (fremde Geräte unsichtbar und unveränderbar, `anon` nichts, Dienst-Funktionen für `authenticated` gesperrt), Erlaubtliste, Größen, 10 Geräte, Testgrenzen; `push_tick(p_now)` mit festem Zeitpunkt: Tagesüberblick zur Ortszeit in mehreren Zeitzonen, Umstellung Sommer-/Winterzeit, Wochentage, kein Doppel am selben Ortstag, leere Überblicke entfallen; Fall-Tabelle aus `notificationPlan.cases.ts`; Ruhezeit verschiebt und bündelt; Partner-Ereignis durch `complete_task` der anderen Person, keines bei eigener Erledigung, Rückgängig entfernt, älter als 24 h ignoriert, Übernahme über `save_task`, Beitritt über `accept_invite`; Verlassen/Entfernen löscht Wartendes, Konto löschen löscht Geräte; `claim_push_jobs` doppelt gleichzeitig → keine Doppelten; `finish_push_jobs` löscht bei 410; Aufräumen nach 90 Tagen. Zeit kommt als Parameter (`p_now timestamptz default now()`), nie die echte Uhr.
- Optional (NT-c, nur wenn in CI stabil): Edge Function in der lokalen Instanz (`supabase functions serve`) gegen einen Mock-Push-Dienst auf `127.0.0.1`. Die dafür nötige Ausnahme in der Erlaubtliste darf es **nur** lokal geben (Umgebungsvariable nur in `supabase/functions/.env` der CI-Instanz, im echten Projekt nicht gesetzt; die Funktion ignoriert sie, sobald `SB_REGION` gesetzt ist).

### 9.3 Nur von Hand (Gerätetest, NT-a Kurzfassung, NT-e vollständig in `GERAETETEST.md`)

Geräte: Windows-PC (Browser des PO), Redmi mit Firefox (Verknüpfung auf dem Startbildschirm), iPhone (Krümel vom Home-Bildschirm). Jeweils:

1. Kachel zeigt den richtigen Status vor dem Einschalten (iPhone in Safari: Hinweis Home-Bildschirm).
2. Einschalten nur über den Knopf; Abfrage des Systems erscheint; danach „aktiv“.
3. Testbenachrichtigung kommt an: App offen · App im Hintergrund · App geschlossen · Bildschirm gesperrt · nach Neustart des Geräts. PC: zusätzlich mit geschlossenem Browser (Ergebnis notieren).
4. Sperrbildschirm zeigt keine Aufgabentitel; Tippen öffnet „Heute“.
5. Tagesüberblick: Uhrzeit 2–3 Minuten in die Zukunft stellen → Meldung kommt einmal; mit 0 Aufgaben kommt keine; abgewählter Wochentag → keine.
6. Partner: andere Person hakt eine eigene Aufgabe ab → nach ca. 5 Min. eine Meldung; mehrere schnell nacheinander → eine gebündelte; Abhaken + „Rückgängig“ innerhalb 5 Min. → keine.
7. Ruhezeit: Ruhezeit um die aktuelle Uhrzeit legen → Partner-Meldung erst am Ende.
8. Offline abhaken, erst später online → Meldung bei der anderen Person nach dem Abgleich.
9. Blockieren in den Systemeinstellungen → Kachel zeigt „Blockiert“ mit passender Anleitung; Anleitung befolgen → wieder aktiv.
10. Ausschalten → keine Meldungen mehr; Abmelden → keine Meldungen mehr; neu anmelden und einschalten → wieder da.
11. iPhone: Krümel vom Home-Bildschirm löschen und neu hinzufügen → alte Adresse verschwindet (spätestens beim nächsten Versand), neue Anmeldung nötig; Fokus „Nicht stören“ an → Meldung wird zurückgehalten.
12. Redmi: einmal mit Akku „Standard“ und einmal „Keine Einschränkungen“ testen (Verzögerung notieren).
13. Zwei Geräte derselben Person: beide bekommen die Meldung; ein Gerät ausgeschaltet → nur das andere.

## 10. Bau-Pakete

Jedes Paket endet wie bisher mit grünem `npm run check`, Job `db`, Pages und einem Commit; Migrationen und die Edge Function spielt der PO ein (Abschnitt 7.5). Größe im Vergleich zu E2-2c (mittel). Reihenfolge: **NT-a → NT-b → NT-c → NT-d → NT-e**; NT-b und NT-c sind unabhängig voneinander und können getauscht werden, NT-d braucht NT-c.

| Paket | Inhalt | Größe | Modell / Effort | Der PO tut |
|---|---|---|---|---|
| **NT-a Durchstich: Testbenachrichtigung** | Migration `push_devices` (minimal) mit `register_push_device`/`unregister_push_device`, Zeilenschutz, Erlaubtliste, S5-Tests; Edge Function `push` mit Route `test` (Anmeldung prüfen, Grenze, sofort senden) und Kern `core.ts` mit Mock-Push-Tests und Krypto-Test; Bibliothek festlegen (block65, sonst web-push) und in `PLAN.md` begründen; Service Worker `push`/`notificationclick`; `src/push/` (`PushPort` Browser/Fake, `notificationFor`, `messages.ts`); Kachel „Benachrichtigungen“ mit Status, Einschalten, Test, Ausschalten; `VITE_VAPID_PUBLIC_KEY` in Build, `.env.example`, Workflow `pages`; Fake-Server `/push/*`; E2E Grundfälle. | mittel (≈ E2-2c) | **Opus 5.5, High** (Kryptografie-Bibliothek, Secrets, Sicherheit) | vorher 7.1–7.3; danach Migration (`npx supabase db push`), Funktion bereitstellen (7.5), Test auf PC, Redmi, iPhone (9.3 Punkte 1–4) und Ergebnis melden |
| **NT-b Geräte-Einstellungen und Status** | Migration: Einstellungsspalten, `update_push_settings`; Kachel mit Tagesüberblick (Uhrzeit, Tage), Partner, Haushalt, Ruhezeit; alle Status mit Anleitungen (`notificationWay`), iPhone-Hinweis; Abgleich der Adresse bei jedem Start (`pushsubscriptionchange`, Schlüsselwechsel), Abmelden schaltet aus (auch offline mit Merker); Datenschutzerklärung (8.5), `LEGAL_DATE`; E2E mit axe, 360 px, Tastatur. | mittel (≈ E2-2c, viele UI-Fälle) | **Sonnet 5.5, High** | Migration einspielen; Datenschutztext lesen |
| **NT-c Zeitplan und Tagesüberblick** | Migration: `pg_cron`, `pg_net`, `push_jobs`, `push_counters`, `push_tick(p_now)` (Planen nach Zeitzone, Wochentag, Ruhezeit, Doppel-Schutz), `claim_push_jobs`/`finish_push_jobs` (nur `service_role`), `push_cleanup` (404/410 sofort, 90 Tage, alte Meldungen), Cron-Jobs „jede Minute“ und „täglich“, Aufruf nur bei fälligen Meldungen mit Token aus dem Vault und `x-region`; Route `flush` mit Wiederholen; `notificationPlan.ts` + gemeinsame Fall-Tabelle; Tests `db` mit fester Zeit. | groß (größer als E2-2c) | **Opus 5.5, High** | vorher 7.4 (Token, Vault); danach Migration, Funktion neu bereitstellen, im Dashboard „Integrations“ → „Cron“ die zwei Jobs und ihre letzten Läufe ansehen (grün), Tagesüberblick auf einem Gerät ausprobieren |
| **NT-d Partner- und Haushaltsereignisse** | Migration: `push_events`, Trigger an `completions` (Erledigung, Grabstein = Rückgängig), `tasks` (Übernahme), `household_members` (Beitritt; Verlassen löscht Wartendes); Bündeln 5 Min., 24-h-Regel, Ruhezeit; Fake-Server mit denselben Regeln (verkürzte Frist per Test-Route); E2E zwei Kontexte; `db`-Tests. | mittel | **Opus 5.5, Medium** | Migration einspielen; Funktion neu bereitstellen, falls geändert; Partner-Fall mit Dilan ausprobieren |
| **NT-e Gerätetest und Abschluss** | `GERAETETEST.md` um Abschnitt 9.3 erweitern, `SUPABASE.md` (Secrets, Vault, Cron, Rotation, Prüfliste Dashboard um Edge Function und Cron), `ANFORDERUNGEN.md` (F9 Benachrichtigungen, Abschnitt 8 anpassen), README, Datenliste im Prüfbericht; Funde aus dem Gerätetest als kleine Korrekturen. | klein | **Sonnet 5.5, Medium** | Gerätetest 9.3 auf allen drei Geräten mit Dilan, Ergebnisse melden |

**Prompts** (jeweils in einer neuen Sitzung; der Skill `/paket` liest dieses Dokument mit):

- NT-a: `/paket NT-a – Durchstich Benachrichtigungen nach docs/BENACHRICHTIGUNGEN.md (Abschnitte 5, 6, 7, 9, 10). Erst prüfen, ob ich 7.1–7.3 erledigt habe (nur fragen, keine Schlüssel zeigen lassen). Bibliothek per Test entscheiden. Ende: Migration und Funktion stelle ich bereit, du nennst die Befehle.`
- NT-b: `/paket NT-b – Geräte-Einstellungen und Status der Benachrichtigungen nach docs/BENACHRICHTIGUNGEN.md (Abschnitte 1.2, 4.4, 8, 9.1). Datenschutzerklärung nach 8.5.`
- NT-c: `/paket NT-c – Zeitplan und Tagesüberblick nach docs/BENACHRICHTIGUNGEN.md (Abschnitte 4.2, 4.3, 5, 6, 7.4, 9.2). Zeit immer als Parameter p_now.`
- NT-d: `/paket NT-d – Partner- und Haushaltsereignisse nach docs/BENACHRICHTIGUNGEN.md (Abschnitte 4.1, 4.3, 4.5, 9.2).`
- NT-e: `/paket NT-e – Gerätetest und Abschluss der Benachrichtigungen nach docs/BENACHRICHTIGUNGEN.md (Abschnitte 8.5, 9.3, 10).`

Der Skill `/paket` kennt bisher die Pakete aus `PLAN.md` und `ETAPPE2-PLAN.md`; NT-a prüft beim Start, ob er NT-Pakete findet (Zeilen in `PLAN.md`, Abschnitt „Benachrichtigungen“), und ergänzt sonst den Skill um diese Datei.

### 10.1 Tatsächliche Namen nach NT-a (24.10.2026, nur Abweichungen und Ergänzungen)

Gleich wie geplant: Tabelle `public.push_devices`, Funktionen `register_push_device`, `unregister_push_device`, `request_test_push`, Edge Function `push` mit Route `test`, Secrets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, GitHub-Variable `VITE_VAPID_PUBLIC_KEY`, Gerätespeicher `kruemel:push-device`, Bibliothek `@block65/webcrypto-web-push` 2.0.0.

- **Migration** `supabase/migrations/20261029120000_push_devices.sql`. `push_devices` hat schon `locale` (Standard `de`) und `last_seen_at`; die Einstellungsspalten kommen in NT-b. Lesen nur eigene Zeilen **ohne** `endpoint`, `p256dh`, `auth` (Spaltenrechte). Erlaubtliste als `private.is_push_endpoint` (auch als Tabellenprüfung).
- **Grenzen der Testbenachrichtigung** in einer eigenen kleinen Tabelle `private.push_tests` (Anfragen des letzten Tages) statt `push_counters` (bleibt NT-c).
- **Edge Function ohne Secret Key:** Sie prüft die Anmeldung (`auth.getUser`) und ruft `request_test_push` und (bei 404/410) `unregister_push_device` **als die Person** auf; `SUPABASE_SECRET_KEYS` braucht NT-a nicht. Dateien: `supabase/functions/push/` mit `index.ts` (Deno), `core.ts` (Ablauf, getestet), `rules.ts` (Erlaubtliste, Schlüsselformate, Fehlercodes, Grenzen; auch von App und Fake-Server genutzt), `rules.cases.ts` (gemeinsame Fälle für Vitest und Job `db`), `deno.json` (exakte Versionen).
- **Fehlercodes** der Funktion: `{"error": "<Code>"}` mit `notSignedIn` 401, `notConfigured` 503, `badRequest` 400, `deviceUnknown` 404, `deviceGone` 410, `testWait`/`testToday` 429, `keyChanged` 409, `endpointInvalid` 422, `pushFailed` 502, `pushRejected` 502 (seit 24.10.2026), `notFound` 404. Verschlüsselt wird über `encrypt.ts` (ohne Auffüllen, siehe 6.3), nicht über `buildPushPayload`.
- **App:** `src/push/` mit `notifications.ts` (Status, Einschalten, Test, Ausschalten; `pushSupport`, `notificationWay` liegen hier statt in `install.ts`), `browserPush.ts` (Push API), `supabasePushApi.ts`, `fakeHttpPushApi.ts`, `fakePush.ts` (Fake-Server), `messages.ts` (`notificationFor`, `openApp`). Texte der Meldungen in `src/push/messageTexts.ts` (der Service Worker darf keine Datei mit der Seite teilen, sonst startet er nicht; der Build bricht jetzt ab, wenn `sw.js` etwas importiert), Texte der Kachel in `src/ui/notificationTexts.ts`. Kachel `src/ui/components/NotificationTile.tsx`.
- **Fake-Server:** `/push/register`, `/push/unregister`, `/push/test`, Testwege `/test/pushes`, `/test/push-devices`, `/test/push-answer` (Antwort des „Push-Dienstes“ je Konto). E2E nutzen kein Fake-`PushPort`, sondern spielen die Push API des Browsers nach (`tests/e2e/pushMock.ts`), damit `browserPush.ts` mitläuft; Spec `tests/e2e/notifications.spec.ts`.

### 10.2 Tatsächliche Namen nach NT-b (24.10.2026, nur Abweichungen und Ergänzungen)

- **Migration** `supabase/migrations/20261030120000_push_settings.sql`: Spalten `daily_enabled`, `daily_time`, `daily_days` (Bitmaske Mo = 1 … So = 64), `partner_enabled`, `household_enabled`, `quiet_enabled`, `quiet_from`, `quiet_to` an `push_devices` (Standardwerte aus 1.2, Tabellenprüfung `push_devices_settings`), Funktion `update_push_settings(p_device_id, …)` (prüft die Werte, nur eigene Geräte, sonst `push_device_unknown`/`push_settings_invalid`). Lesen der eigenen Einstellungen per `select` auf die freigegebenen Spalten (Adresse und Schlüssel bleiben gesperrt). `register_push_device` lässt die Einstellungen unberührt, wenn sich ein Gerät erneut meldet.
- **Regeln** in `supabase/functions/push/rules.ts` (gleiche Datei für App, Fake-Server, Datenbank-Fälle): `PushSettings`, `DEFAULT_PUSH_SETTINGS`, `pushSettingsProblems` (Uhrzeit `HH:MM`, bei Tagesüberblick mindestens ein Tag, Ruhezeit mit gleichem Beginn und Ende nicht erlaubt), Fehlercode `settingsInvalid` (422); Fälle in `rules.cases.ts` (`VALID_SETTINGS`, `INVALID_SETTINGS`), vom Job `db` und von Vitest geprüft.
- **App:** `Notifications` (`src/push/notifications.ts`) hat zusätzlich Status `lost` („Gerät abgemeldet“, Knopf „Neu einschalten“), `sync()` (bei jedem Start und bei „wieder online“: Zeitzone und „zuletzt gesehen“ nachführen, ersetzte Adresse neu anmelden, verlorene Adresse still neu machen, nicht mehr bekanntes Gerät als `lost` markieren, Abmelde-Merker `unregisterFor` nachholen, wartende Einstellungen senden), `loadSettings()`, `saveSettings()` (offline: „noch nicht übertragen“, Ablage `kruemel:push-settings` mit `pending`), `release()` (Abmelden: Server und Browser, bei Fehler Merker; wartet höchstens 4 s) und `forget()` (Konto gelöscht). `PushApi` hat `settings()` und `updateSettings()`; Fake-Server `POST /push/settings`, `POST /push/update-settings`. Oberfläche: `components/NotificationSettings.tsx` (unter dem Status „aktiv“), Texte `NOTIFICATION_SETTINGS_TEXTS`, `WEEKDAYS`; Rückfrage beim Abmelden nennt die Benachrichtigungen, wenn sie auf dem Gerät an sind.
- **Abweichungen:** (1) Die Einstellungen werden nicht nur online gespeichert (1.2), sondern offline vorgemerkt und später gesendet. (2) Uhrzeiten sind auf die Minute genau (kein 15-Minuten-Raster). (3) „Server nicht erreichbar“ ist kein Status der Kachel, sondern ein Zustand des Einstellungsblocks (Hinweis mit „Erneut versuchen“). (4) Zu „Haushalt verlassen / Mitglied entfernt: Meldungen hören auf“: Es gibt noch keine Warteschlange (`push_jobs`, `push_events` kommen mit NT-c/NT-d), also kein Löschen von Wartendem. Geprüft ist, dass das Gerät beim Konto bleibt und die Person danach nicht mehr zu den Empfängern des Haushalts gehört; das Löschen wartender Ereignisse per Trigger an `household_members` bleibt in NT-d. (5) `LEGAL_DATE` blieb „24. Oktober 2026“ (gleicher Tag wie NT-a). (6) Die Tabellenprüfung `push_devices_settings` (zweite Sicherung neben der Funktion) ist nicht einzeln getestet: Ein direktes Schreiben scheitert schon an der Prüfung der Push-Adresse (`is_push_endpoint` ist für den Dienstschlüssel nicht ausführbar); getestet sind die Funktion und das Verbot des direkten Schreibens.

### 10.3 Tatsächliche Namen nach NT-c (24.10.2026, nur Abweichungen und Ergänzungen)

- **Migration** `supabase/migrations/20261031120000_push_schedule.sql`: Erweiterungen `pg_cron` (Schema `pg_catalog`) und `pg_net` (Schema `extensions`); Spalten `last_daily_on` (Ortstag des letzten Überblicks) und `last_sent_at` an `push_devices` (kein `failures`, für Personen nicht lesbar); Tabellen `private.push_jobs` (`device` = `push_devices.id`, `kind` nur `daily`, `dedupe_key` `daily:<Gerät>:<Ortstag>`, `not_before`, `expires_at` = 6 Std., `claimed_until`, `attempts`) und `private.push_counters` (`device`, Ortstag `day`, `sent`). Funktionen in `private`: `local_time`, `daily_overview_day`, `daily_counts`, `is_quiet_time` (erst für NT-d, schon mit gemeinsamen Fällen geprüft), `plan_daily_pushes(p_now)`, `push_tick(p_now)`, `claim_push_jobs(p_limit, p_now)`, `finish_push_jobs(p_results, p_now)`, `push_cleanup(p_now)`; in `public` nur `claim_push_jobs(p_limit)` und `finish_push_jobs(p_results)`, freigegeben allein für `service_role`. Zeitplan (UTC): `kruemel-push-tick` jede Minute, `kruemel-push-cleanup` täglich 03:23 (löscht auch `cron.job_run_details` älter als 7 Tage).
- **Vault:** `push_tick` liest `project_url` und `push_cron_token` (Leerzeichen und Zeilenumbruch am Ende werden abgeschnitten; Token mindestens 32 Zeichen). Fehlt eines, tut der Lauf **gar nichts**, auch nicht planen (Antwort `notConfigured`).
- **Edge Function:** Route `flush` mit Header `x-kruemel-cron` (`CRON_HEADER`), Secret `PUSH_CRON_TOKEN` (`cronTokenOf`, Vergleich `sameSecret`). Fehlt der Header, ist er falsch oder das Secret nicht gesetzt: immer 401 `notSignedIn`. Ohne VAPID-Secrets oder Datenbankzugang 503 `notConfigured`, Datenbank nicht erreichbar 500 `unknown`, sonst 200 mit `{sent, retry, gone, dropped, empty}`. **Abweichung von 10.1:** Die Funktion braucht jetzt den Secret Key (`SUPABASE_SECRET_KEYS`, sonst `SUPABASE_SERVICE_ROLE_KEY`; beide stellt Supabase selbst bereit), nur für `claim_push_jobs`/`finish_push_jobs`. Grenzen `FLUSH_LIMITS` in `rules.ts`: 25 je Abholung, 10 gleichzeitig, 100 je Lauf, nach 30 s kein neuer Stapel. Protokoll: eine Zeile je Lauf mit Zahlen und `problems` (Fehlercode, Dienst, Antwort, Ursache, Anzahl). Nutzlast `dailyPayload` `{"v":1,"k":"daily","due":…,"overdue":…}`, TTL 6 Std., Topic `daily`.
- **Wiederholen:** nach 5 Min., 15 Min., 1 Std., 1 Std. (oder länger, wenn der Dienst mit `Retry-After` bis 1 Std. darum bittet); der fünfte Fehlschlag gibt auf. Auch Schlüssel der Funktion, die nicht funktionieren (`notConfigured` beim Verschlüsseln), gelten als „später erneut“ (der PO kann sie inzwischen richten); anderer Schlüssel des Geräts (`keyChanged`) und Adresse außerhalb der Erlaubtliste werden verworfen.
- **Fachlogik:** `src/domain/notificationPlan.ts` (`localMoment`, `dailyOverviewDay`, `isQuietTime`, `myDueCounts`, `DAILY_CATCH_UP_MINUTES`), gemeinsame Fälle `src/domain/notificationPlan.cases.ts` (`DAILY_CASES`, `QUIET_CASES`, `COUNT_CASES`), geprüft von Vitest und `supabase/tests/schedule.test.ts`. SQL als Eigentümer der Datenbank in den Tests über `sql`/`sqlJson` in `supabase/tests/setup.ts` (`psql` im Container, wie schon `auth.test.ts`). Text auf dem Gerät `PUSH_MESSAGE_TEXTS.daily` in `src/push/messageTexts.ts` (Beispiele aus 8.2), `tag` `daily`.
- **Abweichungen:** (1) **Nachholen höchstens 2 Stunden:** Der Überblick kommt, wenn die Uhrzeit erreicht ist und höchstens 119 Minuten zurückliegt (Plan 4.2 ohne Grenze). Sonst käme nach einem Ausfall oder Wiederherstellen des Projekts am Abend noch ein „Morgen“-Überblick, und wer am Nachmittag einschaltet oder die Uhrzeit vorverlegt, bekäme sofort einen. (2) **Ruhezeit:** Der Tagesüberblick kommt wie in 1.2 auch in der Ruhezeit (so steht es auch in der Kachel); die Anweisung zu NT-c nannte „außerhalb der Ruhezeit“ – bei den Standardwerten (07:30, Ruhe 21–7 Uhr) gibt es keinen Unterschied. (3) Gezählt wird für den Ortstag des Geräts beim Abholen; erledigt zählt, was beim Server angekommen ist (4.5). (4) Ausschalten und wieder Einschalten am selben Tag kann einen zweiten Überblick bringen (neue Gerätezeile). (5) Fällt die Datenbank zwischen Senden und Rückmelden aus, kommt die Meldung nach 3 Minuten noch einmal und ersetzt die erste auf dem Gerät (gleicher `tag`). (6) Der Fake-Server der E2E-Tests kennt den Tagesüberblick nicht; geprüft wird er im Job `db`, in `core.test.ts` und von Hand (unten). (7) Die optionale Prüfung der Edge Function in der lokalen Instanz (9.2) entfällt. (8) „Ausgesetzte“ oder „archivierte“ Aufgaben gibt es in Krümel nicht; gelöschte und erledigte einmalige zählen nicht.
- **Last (kostenloser Tarif):** Die Funktion wird nur aufgerufen, wenn eine Meldung wartet: bei 2 Personen mit zusammen bis zu 6 Geräten höchstens etwa 6 Aufrufe am Tag plus Wiederholungen, also unter 300 im Monat (Grenze 500 000). Je Lauf wenige Millisekunden Rechenzeit (Grenze 2 s), höchstens etwa 1 Minute Laufzeit (Grenze 150 s). `pg_cron` läuft 1 440-mal am Tag in der Datenbank, jeder Lauf liest nur die Gerätetabelle (Millisekunden); sein Protokoll wird nach 7 Tagen gelöscht. Pausiert das Projekt, läuft auch der Zeitplan nicht und kann es nicht wecken; wach hält es weiter `keepalive` (täglich `ping`), ob die Läufe von `pg_cron` als Nutzung zählen, ist nicht belegt (2.4).
- **Prüfliste von Hand (nach Einspielen):** (1) Dashboard → Integrations → Cron: `kruemel-push-tick` (jede Minute) und `kruemel-push-cleanup` stehen dort, die letzten Läufe „succeeded“. (2) In der App auf einem Gerät: Einstellungen → Benachrichtigungen → Tagesüberblick an, heutiger Wochentag gewählt, Uhrzeit 2 Minuten nach jetzt, „Speichern“. (3) Es muss eine eigene oder gemeinsame Aufgabe heute fällig oder überfällig sein. (4) Zur Uhrzeit (bis etwa 1 Minute später) kommt „Heute … für dich …“, ohne Aufgabentitel; Tippen öffnet „Heute“. (5) Uhrzeit wieder 2 Minuten nach jetzt stellen: Heute kommt keine zweite. (6) Ein Gerät ohne fällige Aufgaben bekommt keine. (7) Edge Functions → `push` → Logs: eine Zeile `"route":"flush"` mit `"sent":1`. (8) Morgen zur gewohnten Zeit kommt der Überblick wieder.

### 10.4 Tatsächliche Namen nach NT-d (24.10.2026, nur Abweichungen und Ergänzungen)

- **Migration** `supabase/migrations/20261101120000_push_events.sql`: Tabellen `private.push_events` (`household_id`, `recipient_user`, `actor_user`, `kind` `done`/`tookOver`/`joined`, `task_id`, `completion_id`; je Erledigung und Empfänger höchstens ein Ereignis), `private.push_job_events` (welche Ereignisse eine wartende Meldung erzählt) und `private.push_daily_marks` (Ortstag des letzten Tagesüberblicks je Konto und Geräte-Kennung). `push_jobs.kind` jetzt `daily`, `partner`, `joined`; Schlüssel `partner:<Gerät>:<Ereignis>`, `joined:<Gerät>:<Person>`. Regeln in SQL: `task_owner`, `is_partner_completion`, `is_takeover`, `quiet_end`; Trigger `note_completion_event` (an `completions`), `note_task_event` (an `tasks`), `note_joined_event` und `forget_member_events` (an `household_members`), `queue_push_event` (an `push_events`); Schedule `defer_quiet_pushes(p_now)` (in `push_tick`), Zählen `partner_counts`; ersetzt: `plan_daily_pushes`, `push_tick`, `claim_push_jobs`, `push_cleanup`, `public.save_task`, `public.complete_task`. Keine neue Freigabe.
- **Woher ein Ereignis kommt:** Nur `complete_task` (Erledigung) und `save_task` (Übernahme) zählen; ihre Hüllen in `public` setzen für die Transaktion `kruemel.push_events` (`complete` bzw. `save`). Sicherung einspielen, Daten übernehmen, die Rücknahme der Übernahme beim Abhaken und Rückgängig erzeugen nichts. Rückgängig, Löschen von Aufgabe oder Erledigung löschen das Ereignis (auf jedem Weg).
- **Abholen:** `claim_push_jobs` liefert zusätzlich `{"kind":"partner","name"?,"done","took"}` und `{"kind":"joined","name"?}`; gezählt wird beim Abholen, jede Erledigung und jede Aufgabe einmal, nur was noch gilt (Erledigung und Aufgabe da, Aufgabe noch bei der anderen Person, beide noch im Haushalt, Schalter an). Ohne Namen im Haushalt fehlt `name`, die Meldung sagt dann „Die andere Person …“ bzw. „Jemand ist jetzt in deinem Haushalt dabei.“
- **Edge Function:** `partnerPayload`, `joinedPayload`, `PARTNER_TTL_SECONDS` (12 Std.), `JOINED_TTL_SECONDS` (24 Std.), Topics `partner`, `joined`; `messageOf` exportiert. **Abweichung von Abschnitt 5:** `Urgency` ist jetzt für alle Meldungen `high` (`PUSH_URGENCY`). RFC 8030, 5.3: ohne Angabe gilt `normal` („weder am Strom noch im WLAN“, Beispiel Chat), `high` kommt auch bei schwachem Akku („time-sensitive alert“). Bei Android stellt FCM `high` sofort zu, auch im Ruhezustand (Doze), `normal` kann warten (Firebase, „Set the priority of a message“). Mozilla beschreibt nicht, ob autopush den Wert an FCM weitergibt (Firefox auf Android) – im Gerätetest NT-e prüfen.
- **App:** `notificationFor` liefert zusätzlich `open` (Seite beim Antippen): Tagesüberblick und Test `#/heute`, Partner mit Erledigtem `#/erledigt`, nur Übernommenes `#/woche`, Beitritt `#/einstellungen`. Der Service Worker legt sie in `data.open` ab (`openPageOf`); `openApp` holt ein offenes Fenster nach vorn und wechselt dort auf die Seite, außer mitten in einem Aufgabenformular. Texte `PUSH_MESSAGE_TEXTS.partner`, `.joined`. Fachlogik in `notificationPlan.ts`: `isPartnerCompletion`, `isTakeOver`, `quietEnd`, `partnerMessages` (Bündeln, Vorbild für SQL), `PARTNER_WAIT_MINUTES`, `PARTNER_MAX_AGE_HOURS`; Fälle `PARTNER_COMPLETION_CASES`, `TAKE_OVER_CASES`, `QUIET_END_CASES`, geprüft von Vitest und `supabase/tests/partner.test.ts`.
- **Abweichungen:** (1) Verlassen und Entfernen löschen die wartenden Ereignisse und Meldungen, **nicht die Geräte** (4.4: sie gehören zum Konto und bleiben für einen späteren Haushalt); Konto löschen und Gerät ausschalten/abmelden löschen das Gerät samt Meldungen. (2) Übernehmen zählt auch, wenn eine Person eine „nur dieses Mal“ übernommene eigene Aufgabe zurückholt (Besitz wechselt von der anderen Person zu ihr); nicht, wenn sie eine Aufgabe abgibt. (3) Meldungen über die andere Person und Beitritt liegen als zwei Meldungen vor, wenn beides in eine Ruhezeit fällt (je Art eine). (4) Erledigungen ohne `completedAt` oder `assigneeAtCompletion` (alte Daten) lösen nichts aus. (5) Der Fake-Server der E2E-Tests kennt die Meldungen nicht (wie den Tagesüberblick in NT-c, 10.3 (6)); die Oberfläche ändert sich nicht, geprüft wird in `partner.test.ts`, `core.test.ts`, `messages.test.ts` und von Hand. (6) NT-c 10.3 (4) ist behoben: Aus- und wieder Einschalten am selben Tag bringt keinen zweiten Überblick (`push_daily_marks`). (7) Ein offenes Fenster wechselt beim Antippen jetzt die Seite (NT-a: blieb, wo es war).
- **Prüfliste von Hand (zwei Konten, nach Einspielen):** (1) Alex und Robin je auf einem Gerät angemeldet, Benachrichtigungen an, Ruhezeit so, dass jetzt keine ist. (2) Robin hakt eine Aufgabe von Alex ab: nach 5–6 Minuten bei Alex „Robin hat eine Aufgabe für dich erledigt.“; Tippen öffnet „Erledigt“. (3) Robin hakt schnell zwei weitere ab und übernimmt eine: eine Meldung „… 2 Aufgaben für dich erledigt und eine übernommen.“ (4) Robin hakt ab und drückt sofort „Rückgängig“: keine Meldung. (5) Robin hakt eine eigene Aufgabe ab: keine Meldung. (6) Ruhezeit bei Alex um jetzt legen, Robin hakt ab: Meldung erst am Ende der Ruhezeit. (7) Alex lädt eine dritte Testperson in einen neuen Haushalt ein (oder entfernt Robin und lädt neu ein): beim Beitritt bekommt der Einladende sofort „… ist jetzt im Haushalt dabei.“, Tippen öffnet die Einstellungen. (8) Edge Functions → `push` → Logs: Zeilen `"route":"flush"` nur mit Zahlen.

## 11. Risiken und offene Punkte

**Risiken**

- **iPhone (größtes Risiko):** Push nur in der App vom Home-Bildschirm und ab iOS 16.4 (Version von Dilans iPhone im Durchstich prüfen); Erlaubnis nur nach Tippen; die App vom Home-Bildschirm hat eigene Anmeldung und eigene Daten; Fokus-Modi halten Meldungen zurück; wird die App vom Home-Bildschirm gelöscht, ist die Adresse weg; Apple kann das Verhalten ändern (EU-Streit 2024). Rückfall: „Declarative Web Push“ (iOS 18.4+) prüfen, falls der Service Worker Meldungen nicht zuverlässig zeigt.
- **Redmi mit Firefox:** HyperOS kann Firefox im Hintergrund beenden; Meldungen kommen dann verspätet oder erst beim Öffnen. Gegenmittel: Akku „Keine Einschränkungen“, Autostart (in der Anleitung der Kachel). Firefox-Verknüpfungen sind keine echten installierten Apps; die Meldung kommt „von Firefox“. Falls Firefox unzuverlässig bleibt: Chrome auf dem Redmi als Empfänger testen (nur für Benachrichtigungen).
- **Windows:** Meldungen nur, solange der Browser läuft (Edge im Hintergrund meist ja, Chrome/Firefox eher nein).
- **Bibliothek:** klein und nicht von Fachleuten geprüft; abgesichert durch Krypto-Test, feste Version, Ausweichlösung `web-push`.
- **Doppelte Regel TS/SQL:** abgesichert durch die gemeinsame Fall-Tabelle.
- **Supabase pausiert** → keine Meldungen bis „Restore project“; `keepalive` bleibt nötig.
- **Token im Warteschlangen-Eintrag von `pg_net`:** nur das eigene Token, das allein nur „Senden anstoßen“ erlaubt.
- **Erlaubtliste der Push-Dienste:** Ein Browser mit neuem Dienst wird abgewiesen, bis die Liste erweitert ist.

**Offene Punkte (später, nicht in NT)**

- Abend-Erinnerung an offene Aufgaben von heute.
- Aufgabentitel in Meldungen als bewusste Einstellung („Titel auf dem Sperrbildschirm zeigen“, Standard aus).
- Zahl auf dem App-Symbol (`setAppBadge`) beim Tagesüberblick.
- Eigenes einfarbiges Symbol für die Android-Statusleiste (`badge`); bis dahin zeigt Android ein Standardsymbol.
- Hinweis-Karte „Benachrichtigungen einschalten?“ auf „Heute“ (wie `InstallHint`) – bewusst nicht, solange „nie automatisch“ gilt.
- Englische Texte (EN-a bis EN-d), nach NT.

## 12. Gerätetest-Protokoll (24./25.10.2026, Paket NT-e)

Getestet vom PO am 24.10.2026, zusammen mit Dilan. Das Protokoll wurde am 25.10.2026 korrigiert: Eine frühere Fassung enthielt Ergebnisse, die nicht gemeldet worden waren. Eingetragen ist nur, was der PO gemeldet hat; alles andere steht auf „nicht getestet“. Browser-Version (PC) und iOS-Version (iPhone) wurden nicht notiert.

| Gerät | Test | Ergebnis | Datum |
|---|---|---|---|
| PC (Chrome oder Edge, Version nicht notiert) | Testbenachrichtigung | ok | 24.10.2026 |
| PC | Tagesüberblick zur eingestellten Uhrzeit (22:10) | ok | 24.10.2026 |
| PC | Meldungen über die andere Person (Erledigen, Zusammenfassen nach 5 Minuten, Rückgängig, Übernehmen) | nicht getestet | – |
| PC | Ruhezeit | nicht getestet | – |
| PC | Haushaltsbeitritt („ist jetzt dabei“) | nicht getestet | – |
| Redmi (Firefox Android, HyperOS) | Testbenachrichtigung bei geöffneter App (nach Korrektur der Nachrichtengröße; davor 413 von Mozilla) | ok | 24.10.2026 |
| Redmi | Tagesüberblick im Hintergrund (22:07; der Server meldete laut Log `sent:1`, auf dem Handy kam nichts an) | nicht ok, ungeklärt | 24.10.2026 |
| Redmi | Meldungen über die andere Person | nicht getestet | – |
| Redmi | Akku „Keine Einschränkungen“, Autostart, App anpinnen, Test bei gesperrtem Handy | nicht getestet | – |
| iPhone von Dilan (iOS-Version nicht notiert) | Testbenachrichtigung | ok | 24.10.2026 |
| iPhone | Tagesüberblick | nicht getestet | – |
| iPhone | Meldungen über die andere Person | nicht getestet | – |
| alle | Zeitumstellung auf Winterzeit am 25.10.2026 | nicht getestet | – |

**Zusammenfassung:** Der Durchstich ist getestet: Die Testbenachrichtigung kam auf PC, Redmi (App geöffnet) und iPhone an, der Tagesüberblick auf dem PC zur eingestellten Zeit. Offen sind der Test der Meldungen über die andere Person und des Haushaltsbeitritts (NT-d, mit zwei Konten), die Ruhezeit, der Tagesüberblick auf dem iPhone, die Zeitumstellung und vor allem die Hintergrundzustellung auf dem Redmi.

**Redmi, Tagesüberblick nicht angekommen (ungeklärt):** Der Server hat ihn laut Log erfolgreich abgeliefert (`sent:1`), das Handy zeigte nichts. Verdacht: Die Akku-Verwaltung von HyperOS beendet oder bremst Firefox im Hintergrund (Abschnitt 2.2 und 11). Einstellungen für Akku, Autostart und Anpinnen sind noch nicht geprüft. Folglich ist die Frage aus 10.4 zur Dringlichkeit `high` bei Firefox Android noch offen.

**Bekannte Grenzen (aus der Recherche, nicht durch den Test belegt):**
- iPhone: nur in der App vom Home-Bildschirm, ab iOS 16.4, Erlaubnis nur per Tippen; Fokus-Modi halten Meldungen zurück.
- Windows-PC: Meldungen kommen nur, solange der Browser läuft.
- Der Tagesüberblick nennt nur Zahlen und zählt, was beim Server angekommen ist (4.5).

**Nicht getestet:** siehe Tabelle; dazu iOS-Version, Browser-Version am PC, Lauf mit Akku „Standard“ auf dem Redmi, Neustart-Test und geschlossener Browser am PC (9.3 Punkt 3). Siehe Backlog in `PLAN.md`.

## 13. Benachrichtigungen einrichten und Probleme lösen

Für alle, die Krümel nutzen. Benachrichtigungen sind freiwillig und pro Gerät: Jedes Handy und jeder PC wird einzeln eingeschaltet.

**Einschalten (alle Geräte):** Krümel öffnen, Einstellungen, Kachel „Benachrichtigungen“, „Auf diesem Gerät einschalten“. Dein Gerät fragt dann, ob Krümel Benachrichtigungen schicken darf: „Erlauben“ wählen. Danach „Testbenachrichtigung senden“ drücken; nach wenigen Sekunden sollte eine Meldung erscheinen.

**iPhone und iPad:**
- Es geht nur mit der Krümel-App vom Home-Bildschirm und ab iOS 16.4 (Einstellungen → Allgemein → Info zeigt die Version). Im normalen Safari-Fenster gibt es die Funktion nicht.
- Zum Home-Bildschirm hinzufügen: Teilen-Symbol → „Zum Home-Bildschirm“. Danach die App von dort öffnen und dort einschalten.
- Kommt nichts an: Einstellungen → Mitteilungen → Krümel → „Mitteilungen erlauben“ an. Prüfe auch, ob ein Fokus-Modus („Nicht stören“) läuft; er hält Meldungen zurück.
- Wenn du die App vom Home-Bildschirm löschst, ist die Einstellung weg: neu hinzufügen, anmelden, neu einschalten.

**Android mit Firefox (zum Beispiel Redmi, Xiaomi, POCO):**
- Zwei Erlaubnisse müssen stimmen: in Firefox für die Seite (Menü ⋮ → Einstellungen → Website-Berechtigungen → Benachrichtigungen → Krümel → Erlauben) und in Android (Einstellungen → Apps → Firefox → Benachrichtigungen an).
- Damit Meldungen pünktlich kommen, wenn das Handy gesperrt ist: Einstellungen → Apps → Firefox → Akku → „Keine Einschränkungen“, und „Autostart“ für Firefox einschalten. Auf Xiaomi-Geräten beendet die Akku-Verwaltung sonst Firefox im Hintergrund.
- Auch wenn du die App-Verknüpfung nutzt, kommt die Meldung „von Firefox“ an.

**Android mit Chrome, PC mit Chrome oder Edge:**
- Symbol links neben der Adresse → Berechtigungen (oder Website-Einstellungen) → Benachrichtigungen → „Zulassen“.
- Windows: Einstellungen → System → Benachrichtigungen → Browser an, „Nicht stören“ aus.
- Am PC kommen Meldungen nur, solange der Browser läuft. Edge läuft meist im Hintergrund weiter, Chrome und Firefox eher nicht.

**Was bedeutet „Blockiert“?** Dein Browser oder dein Gerät hat Krümel die Erlaubnis verweigert, zum Beispiel weil „Blockieren“ gewählt wurde. Krümel kann das nicht selbst ändern. Folge der passenden Anleitung oben (die Kachel zeigt sie für deinen Browser auch selbst an), setze die Erlaubnis zurück auf „Zulassen“ oder „Fragen“ und lade Krümel neu. Danach steht in der Kachel wieder „Aus“ und du kannst einschalten.

**Erlaubnis zurücksetzen:** Browser-Einstellungen → Website-Berechtigungen (oder Datenschutz) → Krümel → Benachrichtigungen auf „Fragen“ oder „Zulassen“. Am iPhone: Einstellungen → Mitteilungen → Krümel. Falls das nicht hilft: in Krümel „Auf diesem Gerät ausschalten“, Seite neu laden und wieder einschalten.

**Es kommt nichts an? Prüfe der Reihe nach:**
1. Steht die Kachel auf „Auf diesem Gerät aktiv“? Sonst einschalten.
2. Testbenachrichtigung drücken. Kommt sie an, liegt es an den Einstellungen (Tagesüberblick, Wochentage, Ruhezeit) oder daran, dass nichts fällig ist: Ohne fällige Aufgaben gibt es keinen Tagesüberblick.
3. Ruhezeit und „Nicht stören“ des Geräts prüfen.
4. Meldungen über die andere Person kommen erst nach etwa 5 Minuten und gebündelt; wer es rückgängig macht, löst keine aus.
5. Zeigt die Kachel „Gerät abgemeldet“ oder „Bitte neu einschalten“, auf „Neu einschalten“ tippen.
6. Das Handy kommt lange nicht aus dem Ruhezustand: Akku-Einstellungen wie oben prüfen.
7. Wenn ein Gerät 90 Tage nicht benutzt wurde, schaltet der Server es aus; einfach neu einschalten.

**Ausschalten:** Kachel „Benachrichtigungen“ → „Auf diesem Gerät ausschalten“. Beim Abmelden werden sie auf dem Gerät automatisch ausgeschaltet.

## 14. Quellen (abgerufen 24.10.2026)

- MDN, Push API: https://developer.mozilla.org/en-US/docs/Web/API/Push_API
- RFC 8291, Message Encryption for Web Push: https://www.rfc-editor.org/rfc/rfc8291 · RFC 8030 (Web Push Protocol): https://www.rfc-editor.org/rfc/rfc8030 · RFC 8292 (VAPID): https://www.rfc-editor.org/rfc/rfc8292
- WebKit, Web Push for Web Apps on iOS and iPadOS (16.4): https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- WebKit, Meet Declarative Web Push: https://webkit.org/?p=16535 · WebKit Features in Safari 18.4: https://webkit.org/?p=16574
- pushpad, iOS-Anforderungen: https://pushpad.xyz/blog/ios-special-requirements-for-web-push-notifications · Benachrichtigung bei geschlossenem Browser: https://pushpad.xyz/blog/can-you-display-notifications-when-the-browser-is-closed/
- 9to5Mac, iOS 17.4 und Web-Apps in der EU: https://9to5mac.com/2024/02/15/ios-17-4-web-apps-european-union/ · Silicon, Apple nimmt es zurück: https://silicon.co.uk/mobility/smartphones/apple-dma-web-apps-552741
- Mozilla autopush, HTTP API (2744 Byte bei FCM-Brücke, 201, Topic, TTL): https://mozilla-services.github.io/autopush-rs/http.html · ältere Fassung mit Fehlercodes (413, errno 104/111/113): https://autopush.readthedocs.io/en/latest/http.html
- Mozilla, Web Push in Firefox: https://support.mozilla.org/kb/push-notifications-firefox · https://mozilla.org/firefox/push · Mozilla Wiki Firefox/Push Notifications: https://wiki.mozilla.org/Firefox/Push_Notifications
- Microsoft Edge, Notifications und Badging: https://blogs.windows.com/msedgedev/2020/11/16/improving-notifications-badging-microsoft-edge/ · 3CX, Chrome/Edge im Hintergrund: https://www.3cx.com/blog/docs/pwa-push-notifications/
- Xiaomi-Hinweise (Autostart, Akku): https://scos.co.uk/troubleshooting/xiaomi/xiaomi-notification-lag
- web.dev, Notification Triggers: https://web.dev/notification-triggers · MDN, Periodic Background Sync: https://developer.mozilla.org/docs/Web/API/Web_Periodic_Background_Synchronization_API
- Supabase: Limits https://supabase.com/docs/guides/functions/limits · Pricing https://supabase.com/docs/guides/functions/pricing · Scheduling https://supabase.com/docs/guides/functions/schedule-functions · Secrets https://supabase.com/docs/guides/functions/secrets · Regional Invocations https://supabase.com/docs/guides/functions/regional-invocation · Project Pausing https://supabase.com/docs/guides/platform/free-project-pausing
- Bibliotheken: https://github.com/block65/webcrypto-web-push · https://github.com/web-push-libs/web-push · https://jsr.io/@negrel/webpush · https://github.com/negrel/webpush
