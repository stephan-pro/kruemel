import { describe, expect, it } from "vitest";
import { COUNT_CASES, DAILY_CASES, QUIET_CASES } from "../../src/domain/notificationPlan.cases";
import { SCHEMA_VERSION } from "../../src/storage/appData";
import {
  DEFAULT_PUSH_SETTINGS,
  type PushSettings,
  settingsArguments,
} from "../functions/push/rules";
import {
  admin,
  anonymous,
  call,
  couple,
  literal,
  type Person,
  pushDevice,
  signedIn,
  sleep,
  sql,
  sqlJson,
  withHousehold,
} from "./setup";

// NT-c: the schedule of the notifications and the daily overview (migration `…_push_schedule.sql`)
// as `pg_cron` runs it: SQL as the owner of the database, the moment always as a parameter
// (`p_now`), never the real clock. The Edge Function's side (`claim_push_jobs`, `finish_push_jobs`)
// partly through the API with the service role, as the function calls it. The cases of time and
// counting are the app's (src/domain/notificationPlan.cases.ts).
//
// The database is shared by all test files: every test notes the devices it made and looks only at
// them; messages planned by other tests are cleared first (`clearJobs`).

const at = (moment: string) => `${literal(moment)}::timestamptz`;

const change = () => ({ p_change_id: crypto.randomUUID(), p_schema_version: SCHEMA_VERSION });

/** Adds a task to the person's household, as the app does. */
const addTask = (person: Person, task: { id: string } & Record<string, unknown>) =>
  call(person, "save_task", {
    ...change(),
    p_task_id: task.id,
    p_set: task,
    p_unset: [],
    p_create: task,
  });

/** A weekly task, due on `dueDate`, for `assignee`. */
function task(dueDate: string, assignee = "personA", extra: Record<string, unknown> = {}) {
  return {
    kind: "recurring",
    id: `t-${crypto.randomUUID()}`,
    title: "Bad putzen (darf nie in einer Meldung stehen)",
    symbol: "standard",
    recurrence: { unit: "week", interval: 1 },
    assignee,
    dueDate,
    checklist: [],
    ...extra,
  };
}

interface Device {
  /** `push_devices.id`. */
  readonly row: string;
  readonly deviceId: string;
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
}

/** Switches notifications on for a new device of the person, with other settings if given. */
async function switchOn(
  person: Person,
  overrides: Record<string, unknown> = {},
  settings: Partial<PushSettings> = {},
): Promise<Device> {
  const phone = pushDevice(overrides);
  await call(person, "register_push_device", phone);
  if (Object.keys(settings).length > 0) {
    await call(person, "update_push_settings", {
      p_device_id: phone.p_device_id,
      ...settingsArguments({ ...DEFAULT_PUSH_SETTINGS, ...settings }),
    });
  }
  const [row] = sql(
    `select id from public.push_devices where device_id = ${literal(phone.p_device_id)}`,
  );
  return {
    row: row ?? "",
    deviceId: phone.p_device_id,
    endpoint: phone.p_endpoint,
    p256dh: phone.p_p256dh,
    auth: phone.p_auth,
  };
}

const list = (devices: readonly Device[]) =>
  devices.length === 0 ? "null" : devices.map((device) => literal(device.row)).join(", ");

const clearJobs = () => sql("delete from private.push_jobs; delete from private.push_counters;");

const plan = (moment: string) => Number(sql(`select private.plan_daily_pushes(${at(moment)})`)[0]);

interface Job {
  readonly id: number;
  readonly device: string;
  readonly key: string;
  readonly attempts: number;
  readonly notBefore: string;
  readonly claimed: boolean;
}

/** The planned messages of these devices, oldest first. */
const jobsOf = (devices: readonly Device[]) =>
  sqlJson<Job[]>(
    `select coalesce(jsonb_agg(jsonb_build_object('id', j.id, 'device', j.device, 'key', j.dedupe_key, 'attempts', j.attempts, 'notBefore', to_char(j.not_before at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'claimed', j.claimed_until is not null) order by j.id), '[]'::jsonb) from private.push_jobs j where j.device in (${list(devices)})`,
  );

const keysOf = (devices: readonly Device[]) => jobsOf(devices).map((job) => job.key);

interface ClaimedJob {
  readonly id: number;
  readonly kind: string;
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
  readonly keyId: string;
  readonly locale: string;
  readonly due: number;
  readonly overdue: number;
}

interface Claimed {
  readonly jobs: readonly ClaimedJob[];
  readonly empty: number;
  readonly dropped: number;
}

const claim = (moment: string, limit = 100) =>
  sqlJson<Claimed>(`select private.claim_push_jobs(${limit}, ${at(moment)})`);

/** The claimed messages for these devices (the claim hands out those of other tests as well). */
const claimedFor = (claimed: Claimed, devices: readonly Device[]) =>
  claimed.jobs.filter((job) => devices.some((device) => device.endpoint === job.endpoint));

const finish = (results: readonly object[], moment: string) =>
  sqlJson<Record<string, number>>(
    `select private.finish_push_jobs(${literal(JSON.stringify(results))}::jsonb, ${at(moment)})`,
  );

async function failure(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return (error as Error).message;
  }
  return "kein Fehler";
}

describe("NT-c Zeitplan: gemeinsame Fälle mit der App", () => {
  it("NT-c Uhrzeit minutengenau in der Zeitzone des Geräts, Wochentage, Zeitumstellung und Reisen wie in der App", () => {
    const rows = DAILY_CASES.map(
      (example, index) =>
        `(${index}, ${at(example.now)}, ${literal(example.timeZone)}, ${example.dailyEnabled}, ${literal(example.dailyTime)}::time, ${example.dailyDays}, ${example.lastDailyOn === null ? "null" : literal(example.lastDailyOn)}::date)`,
    ).join(",\n");
    const days = sqlJson<(string | null)[]>(
      `select jsonb_agg(private.daily_overview_day(c.moment, c.zone, c.enabled, c.clock, c.days, c.last_day) order by c.n) from (values ${rows}) as c(n, moment, zone, enabled, clock, days, last_day)`,
    );

    DAILY_CASES.forEach((example, index) => {
      expect(days[index], example.name).toBe(example.expected);
    });
  });

  it("NT-c Ruhezeit mit Beginn und Ende, auch über Mitternacht, wie in der App", () => {
    const rows = QUIET_CASES.map(
      (example, index) =>
        `(${index}, ${literal(example.time)}::time, ${literal(example.from)}::time, ${literal(example.to)}::time)`,
    ).join(",\n");
    const quiet = sqlJson<boolean[]>(
      `select jsonb_agg(private.is_quiet_time(c.clock, c.from_, c.to_) order by c.n) from (values ${rows}) as c(n, clock, from_, to_)`,
    );

    expect(quiet).toEqual(QUIET_CASES.map((example) => example.quiet));
  });

  it("NT-c Gezählt wird wie in der App: heute fällig und überfällig, nur eigene und gemeinsame, Übernahme, erledigte nicht", async () => {
    for (const example of COUNT_CASES) {
      const person = await withHousehold();
      for (const each of example.tasks) {
        await addTask(person, each as unknown as { id: string });
      }
      const counts = sqlJson(
        `select private.daily_counts(${literal(person.household)}::uuid, ${literal(example.person)}, ${literal(example.today)}::date)`,
      );
      expect(counts, example.name).toEqual({ due: example.due, overdue: example.overdue });
    }
  });

  it("NT-c Gelöschte Aufgaben zählen nicht, Aufgaben eines anderen Haushalts nie", async () => {
    const [alex, other] = [await withHousehold(), await withHousehold()];
    const gone = task("2027-01-13");
    await addTask(alex, gone);
    await addTask(alex, task("2027-01-10"));
    for (let index = 0; index < 3; index++) {
      await addTask(other, task("2027-01-13"));
    }
    await call(alex, "delete_task", { ...change(), p_task_id: gone.id });

    const counts = sqlJson(
      `select private.daily_counts(${literal(alex.household)}::uuid, 'personA', '2027-01-13'::date)`,
    );
    expect(counts).toEqual({ due: 1, overdue: 1 });
  });
});

describe("NT-c Zeitplan in der Datenbank", () => {
  it("NT-c Ohne Vault-Einträge (lokale Testinstanz) tut der Zeitplan nichts und bricht nicht ab; er läuft jede Minute, das Aufräumen täglich", async () => {
    clearJobs();
    const alex = await withHousehold();
    const phone = await switchOn(alex);

    // Monday, 07:30 in Berlin.
    expect(sqlJson(`select private.push_tick(${at("2027-02-01T06:30:00Z")})`)).toEqual({
      status: "notConfigured",
    });
    expect(jobsOf([phone])).toEqual([]);

    expect(
      sqlJson(
        "select jsonb_agg(jsonb_build_object('name', jobname, 'schedule', schedule, 'command', command) order by jobname) from cron.job where jobname like 'kruemel-push-%'",
      ),
    ).toEqual([
      {
        name: "kruemel-push-cleanup",
        schedule: "23 3 * * *",
        command: "select private.push_cleanup()",
      },
      { name: "kruemel-push-tick", schedule: "* * * * *", command: "select private.push_tick()" },
    ]);
    // The real schedule of this instance ran (at the latest after a minute) without an error.
    let runs: string[] = [];
    for (let attempt = 0; attempt < 40 && runs.length === 0; attempt++) {
      runs = sql(
        "select r.status from cron.job_run_details r join cron.job j on j.jobid = r.jobid where j.jobname = 'kruemel-push-tick' and r.status in ('succeeded', 'failed') order by r.start_time desc limit 5",
      );
      if (runs.length === 0) {
        await sleep(2000);
      }
    }
    expect(runs.length).toBeGreaterThan(0);
    expect(runs.every((status) => status === "succeeded")).toBe(true);
  }, 100_000);

  it("NT-c Mit Vault-Einträgen: plant fällige Überblicke und ruft die Funktion mit Token und Region auf; ohne Fälliges kein Aufruf", async () => {
    clearJobs();
    const alex = await withHousehold();
    await switchOn(alex);
    // Made up for the test, never a real value; everything below is rolled back.
    const token = "nur-ein-Test-Token-fuer-die-lokale-Instanz-0123";

    const [due, queued, later] = sql(
      `begin;
       select vault.create_secret('http://127.0.0.1:54321/', 'project_url');
       select vault.create_secret(${literal(`${token}\n`)}, 'push_cron_token');
       select private.push_tick(${at("2027-02-02T06:30:00Z")});
       select coalesce(jsonb_agg(jsonb_build_object('url', q.url, 'token', q.headers ->> 'x-kruemel-cron', 'region', q.headers ->> 'x-region', 'method', q.method)), '[]'::jsonb) from net.http_request_queue q;
       select private.push_tick(${at("2027-02-02T15:00:00Z")});
       rollback;`,
    )
      .slice(-3)
      .map((row) => JSON.parse(row));

    expect(due).toEqual({ status: "ok", planned: expect.any(Number), called: true });
    expect(due.planned).toBeGreaterThanOrEqual(1);
    expect(queued).toEqual([
      {
        url: "http://127.0.0.1:54321/functions/v1/push/flush",
        token,
        region: "eu-west-3",
        method: "POST",
      },
    ]);
    // 16:00 in Berlin: nothing due, nothing waiting (the morning's messages are past their time).
    expect(later).toEqual({ status: "ok", planned: 0, called: false });
    expect(
      sql(
        "select count(*) from vault.decrypted_secrets where name in ('project_url', 'push_cron_token')",
      ),
    ).toEqual(["0"]);
  });

  it("NT-c Genau ein Überblick je Gerät und Ortstag, auch bei mehrfachem Lauf; jede Zeitzone zu ihrer Uhrzeit, nur gewählte Wochentage, ohne Haushalt nichts", async () => {
    clearJobs();
    const alex = await withHousehold();
    const berlin = await switchOn(alex);
    const newYork = await switchOn(alex, { p_time_zone: "America/New_York" });
    const mondays = await switchOn(alex, {}, { dailyDays: 1 });
    const off = await switchOn(alex, {}, { dailyEnabled: false, dailyDays: 0 });
    const alone = await switchOn(await signedIn());
    const all = [berlin, newYork, mondays, off, alone];

    // Wednesday, 07:30 in Berlin; the schedule runs again and again.
    plan("2027-03-03T06:30:00Z");
    plan("2027-03-03T06:30:00Z");
    plan("2027-03-03T06:45:00Z");
    expect(keysOf(all)).toEqual([`daily:${berlin.row}:2027-03-03`]);

    // 07:30 in New York.
    plan("2027-03-03T12:30:00Z");
    // Monday, 07:30 in Berlin.
    plan("2027-03-08T06:30:00Z");
    expect(keysOf(all).sort()).toEqual(
      [
        `daily:${berlin.row}:2027-03-03`,
        `daily:${newYork.row}:2027-03-03`,
        `daily:${berlin.row}:2027-03-08`,
        `daily:${mondays.row}:2027-03-08`,
      ].sort(),
    );
  });

  it("NT-c Zeitumstellung: der Überblick fällt nicht aus und kommt nicht doppelt", async () => {
    clearJobs();
    const alex = await withHousehold();
    const night = await switchOn(alex, {}, { dailyTime: "02:30" });

    // Forward (28 March): 02:30 does not exist; at 01:59 not yet, at 03:00 it comes.
    plan("2027-03-28T00:59:00Z");
    expect(keysOf([night])).toEqual([]);
    plan("2027-03-28T01:00:00Z");
    // Back (31 October): 02:30 comes twice; the second does not plan it again.
    plan("2027-10-31T00:30:00Z");
    plan("2027-10-31T01:30:00Z");
    expect(keysOf([night])).toEqual([
      `daily:${night.row}:2027-03-28`,
      `daily:${night.row}:2027-10-31`,
    ]);
  });
});

describe("NT-c Abholen und Ergebnisse (für die Edge Function)", () => {
  it("NT-c Gezählt wird erst beim Abholen und nur im eigenen Haushalt; nichts zu tun oder kein Haushalt: keine Meldung; keine Titel", async () => {
    clearJobs();
    const { a, b } = await couple();
    const other = await withHousehold();
    await addTask(a, task("2027-04-07", "personA"));
    await addTask(a, task("2027-04-01", "both"));
    await addTask(a, task("2027-04-07", "personB", { takenOverBy: "personA" }));
    for (let index = 0; index < 5; index++) {
      await addTask(other, task("2027-04-07", "personA"));
    }
    const phoneA = await switchOn(a);
    const phoneB = await switchOn(b);
    const phoneOther = await switchOn(other);

    // Wednesday, 07:30 in Berlin (summer time). B has nothing of their own but the shared task.
    plan("2027-04-07T05:30:00Z");
    // A adds one more after planning: counted is what holds when the message goes.
    await addTask(a, task("2027-04-02", "personA"));
    const claimed = claim("2027-04-07T05:31:00Z");

    const byDevice = (job: ClaimedJob) =>
      [phoneA, phoneB, phoneOther].findIndex((phone) => phone.endpoint === job.endpoint);
    const mine = [...claimedFor(claimed, [phoneA, phoneB, phoneOther])].sort(
      (one, two) => byDevice(one) - byDevice(two),
    );
    expect(mine).toEqual([
      {
        id: expect.any(Number),
        kind: "daily",
        endpoint: phoneA.endpoint,
        p256dh: phoneA.p256dh,
        auth: phoneA.auth,
        keyId: "schluessel-1",
        locale: "de",
        due: 4,
        overdue: 2,
      },
      expect.objectContaining({ endpoint: phoneB.endpoint, due: 1, overdue: 1 }),
      expect.objectContaining({ endpoint: phoneOther.endpoint, due: 5, overdue: 0 }),
    ]);
    expect(JSON.stringify(claimed)).not.toContain("Bad putzen");

    // Next day B leaves the household after the overview was planned: nothing goes to B.
    clearJobs();
    plan("2027-04-08T05:30:00Z");
    expect(jobsOf([phoneB])).toHaveLength(1);
    await call(b, "leave_household");
    const next = claim("2027-04-08T05:31:00Z");
    expect(claimedFor(next, [phoneB])).toEqual([]);
    expect(jobsOf([phoneB])).toEqual([]);
    expect(claimedFor(next, [phoneA])).toHaveLength(1);
  });

  it("EN-c Die Meldungen zweier Geräte desselben Kontos tragen die Sprache des jeweiligen Geräts; ein Sprachwechsel gilt ab der nächsten Meldung", async () => {
    clearJobs();
    const alex = await withHousehold();
    await addTask(alex, task("2027-04-20", "personA"));
    const phone = await switchOn(alex, { p_locale: "en" });
    const tablet = await switchOn(alex, { p_locale: "de" });
    // A language the server does not know is German.
    const old = await switchOn(alex, { p_locale: "fr" });

    plan("2027-04-20T05:30:00Z");
    const languages = (claimed: Claimed) =>
      Object.fromEntries(
        claimedFor(claimed, [phone, tablet, old]).map((job) => [
          [phone, tablet, old].findIndex((device) => device.endpoint === job.endpoint),
          job.locale,
        ]),
      );
    expect(languages(claim("2027-04-20T05:31:00Z"))).toEqual({ 0: "en", 1: "de", 2: "de" });

    // The person switches the tablet to English (the app saves its settings with the language).
    await call(alex, "update_push_settings", {
      p_device_id: tablet.deviceId,
      ...settingsArguments(DEFAULT_PUSH_SETTINGS),
      p_locale: "en",
    });
    clearJobs();
    plan("2027-04-21T05:30:00Z");
    await addTask(alex, task("2027-04-21", "personA"));
    expect(languages(claim("2027-04-21T05:31:00Z"))).toEqual({ 0: "en", 1: "en", 2: "de" });
  });

  it("NT-c Nichts zu tun: der Überblick entfällt ohne Meldung", async () => {
    clearJobs();
    const alex = await withHousehold();
    await addTask(alex, task("2027-04-20", "personA"));
    const phone = await switchOn(alex);

    plan("2027-04-14T05:30:00Z");
    const claimed = claim("2027-04-14T05:31:00Z");

    expect(claimedFor(claimed, [phone])).toEqual([]);
    expect(claimed.empty).toBeGreaterThanOrEqual(1);
    expect(jobsOf([phone])).toEqual([]);
  });

  it("NT-c Zwei Läufe zur selben Zeit bekommen keine Meldung doppelt", async () => {
    clearJobs();
    const alex = await withHousehold();
    await addTask(alex, task("2026-01-01"));
    const phones: Device[] = [];
    for (let index = 0; index < 6; index++) {
      phones.push(await switchOn(alex));
    }
    sql(
      `insert into private.push_jobs (device, kind, dedupe_key, not_before, expires_at) select d.id, 'daily', 'test:' || d.id, now() - interval '1 minute', now() + interval '1 hour' from public.push_devices d where d.id in (${list(phones)})`,
    );

    // As the Edge Function calls it: through the API with the service role, twice at once.
    const runs = await Promise.all([
      admin.rpc("claim_push_jobs", { p_limit: 4 }),
      admin.rpc("claim_push_jobs", { p_limit: 4 }),
    ]);
    const ids = runs.map((run) => {
      expect(run.error).toBeNull();
      return claimedFor(run.data as Claimed, phones).map((job) => job.id);
    });

    const [first = [], second = []] = ids;
    expect(first.filter((id) => second.includes(id))).toEqual([]);
    expect(first.length + second.length).toBe(6);

    const done = await admin.rpc("finish_push_jobs", {
      p_results: [...first, ...second].map((id) => ({ id, outcome: "sent" })),
    });
    expect(done.data).toEqual({ sent: 6, retry: 0, gone: 0, dropped: 0 });
    const again = await admin.rpc("claim_push_jobs", { p_limit: 100 });
    expect(claimedFor(again.data as Claimed, phones)).toEqual([]);
  });

  it("NT-c Ergebnisse: gesendet wird gezählt, später erneut mit Abstand und höchstens fünfmal, 404/410 löscht das Gerät, verworfen nur die Meldung", async () => {
    clearJobs();
    const alex = await withHousehold();
    await addTask(alex, task("2027-05-01"));
    const [sent, retried, gone, dropped] = [
      await switchOn(alex),
      await switchOn(alex),
      await switchOn(alex),
      await switchOn(alex),
    ];
    const mine = [sent, retried, gone, dropped];
    plan("2027-05-05T05:30:00Z");
    const idOf = (claimed: Claimed, device: Device) =>
      claimedFor(claimed, [device])[0]?.id ?? Number.NaN;
    const first = claim("2027-05-05T05:31:00Z");

    expect(
      finish(
        [
          { id: idOf(first, sent), outcome: "sent" },
          { id: idOf(first, retried), outcome: "retry" },
          { id: idOf(first, gone), outcome: "gone" },
          { id: idOf(first, dropped), outcome: "dropped" },
          { id: 0, outcome: "sent" },
        ],
        "2027-05-05T05:31:30Z",
      ),
    ).toEqual({ sent: 1, retry: 1, gone: 1, dropped: 1 });

    expect(
      sqlJson(
        `select jsonb_build_object('lastSent', to_char(d.last_sent_at at time zone 'UTC', 'HH24:MI:SS'), 'counted', (select jsonb_agg(jsonb_build_object('day', c.day, 'sent', c.sent)) from private.push_counters c where c.device = d.id)) from public.push_devices d where d.id = ${literal(sent.row)}`,
      ),
    ).toEqual({ lastSent: "05:31:30", counted: [{ day: "2027-05-05", sent: 1 }] });
    expect(sql(`select count(*) from public.push_devices where id = ${literal(gone.row)}`)).toEqual(
      ["0"],
    );
    expect(
      sql(`select count(*) from public.push_devices where id = ${literal(dropped.row)}`),
    ).toEqual(["1"]);
    expect(jobsOf(mine)).toEqual([
      expect.objectContaining({
        device: retried.row,
        attempts: 1,
        claimed: false,
        notBefore: "2027-05-05T05:36:30Z",
      }),
    ]);

    // Not before the wait is over; then 15 minutes (or longer if the push service asks), 1 h, 1 h,
    // and the fifth failure gives up.
    expect(claimedFor(claim("2027-05-05T05:35:00Z"), [retried])).toEqual([]);
    const waits: [string, string, number | undefined][] = [
      ["2027-05-05T05:37:00Z", "2027-05-05T06:07:00Z", 1800],
      ["2027-05-05T06:07:00Z", "2027-05-05T07:07:00Z", undefined],
      ["2027-05-05T07:07:00Z", "2027-05-05T08:07:00Z", undefined],
    ];
    for (const [moment, next, retryAfter] of waits) {
      const claimed = claim(moment);
      finish(
        [{ id: idOf(claimed, retried), outcome: "retry", ...(retryAfter ? { retryAfter } : {}) }],
        moment,
      );
      expect(jobsOf([retried])[0]?.notBefore, moment).toBe(next);
    }
    const last = claim("2027-05-05T08:07:00Z");
    expect(finish([{ id: idOf(last, retried), outcome: "retry" }], "2027-05-05T08:07:00Z")).toEqual(
      { sent: 0, retry: 0, gone: 0, dropped: 1 },
    );
    expect(jobsOf([retried])).toEqual([]);
  });

  it("NT-c Höchstens 8 Meldungen am Tag je Gerät; nach 6 Stunden verfällt eine Meldung", async () => {
    clearJobs();
    const alex = await withHousehold();
    await addTask(alex, task("2027-05-01"));
    const [busy, late] = [await switchOn(alex), await switchOn(alex)];
    sql(
      `insert into private.push_counters (device, day, sent) values (${literal(busy.row)}, '2027-05-12', 8)`,
    );

    plan("2027-05-12T05:30:00Z");
    const claimed = claim("2027-05-12T05:31:00Z");
    expect(claimedFor(claimed, [busy])).toEqual([]);
    expect(claimed.dropped).toBeGreaterThanOrEqual(1);
    expect(jobsOf([busy])).toEqual([]);

    // The other one was claimed but never reported back: after 6 hours it is not handed out again.
    expect(claimedFor(claim("2027-05-12T11:31:00Z"), [late])).toEqual([]);
  });

  it("NT-c Konto löschen löscht die geplanten Meldungen mit dem Gerät", async () => {
    clearJobs();
    const alex = await withHousehold();
    const phone = await switchOn(alex);
    plan("2027-05-19T05:30:00Z");
    expect(jobsOf([phone])).toHaveLength(1);

    await call(alex, "delete_account");

    expect(jobsOf([phone])).toEqual([]);
  });

  it("NT-c Aufräumen: Geräte nach 90 Tagen ohne Start, abgelaufene Meldungen; alles andere bleibt", async () => {
    const alex = await withHousehold();
    const [old, fresh] = [await switchOn(alex), await switchOn(alex)];

    const after = sqlJson(
      `begin;
       update public.push_devices set last_seen_at = now() - interval '91 days' where id = ${literal(old.row)};
       insert into private.push_jobs (device, kind, dedupe_key, not_before, expires_at) values
         (${literal(fresh.row)}, 'daily', 'test:alt:' || ${literal(fresh.row)}, now() - interval '7 hours', now() - interval '1 hour'),
         (${literal(fresh.row)}, 'daily', 'test:neu:' || ${literal(fresh.row)}, now(), now() + interval '1 hour');
       select private.push_cleanup(now());
       select jsonb_build_object(
         'old', (select count(*) from public.push_devices where id = ${literal(old.row)}),
         'fresh', (select count(*) from public.push_devices where id = ${literal(fresh.row)}),
         'jobs', (select jsonb_agg(dedupe_key) from private.push_jobs where device = ${literal(fresh.row)}));
       rollback;`,
    );

    expect(after).toEqual({ old: 0, fresh: 1, jobs: [`test:neu:${fresh.row}`] });
  });
});

describe("NT-c S5 Zeitplan und Abholen sind nur für Datenbank und Edge Function", () => {
  it("NT-c S5 Personen und anon können Zeitplan, Abholen und Ergebnisse nicht aufrufen; die neuen Tabellen und Spalten sind gesperrt", async () => {
    const alex = await withHousehold();
    await switchOn(alex);

    for (const [name, args] of [
      ["claim_push_jobs", { p_limit: 100 }],
      ["finish_push_jobs", { p_results: [] }],
    ] as const) {
      expect(await failure(call(alex, name, args)), name).toMatch(/permission denied/);
      expect(await failure(call(anonymous(), name, args)), name).toMatch(/permission denied/);
    }
    for (const name of ["push_tick", "plan_daily_pushes", "push_cleanup", "daily_counts"]) {
      // Not in the API at all (schema `private` is not exposed).
      expect(await failure(call(alex, name)), name).not.toBe("kein Fehler");
    }
    const hidden = await alex.client.schema("private").from("push_jobs").select("id");
    expect(hidden.error).not.toBeNull();
    for (const column of ["last_daily_on", "last_sent_at"]) {
      const read = await alex.client.from("push_devices").select(column);
      expect(read.error?.message, column).toMatch(/permission denied/);
    }

    const rights = sqlJson<Record<string, boolean>>(
      `select jsonb_build_object(
         'personTick', has_function_privilege('authenticated', 'private.push_tick(timestamptz)', 'execute'),
         'personClaim', has_function_privilege('authenticated', 'private.claim_push_jobs(integer, timestamptz)', 'execute'),
         'personCounts', has_function_privilege('authenticated', 'private.daily_counts(uuid, text, date)', 'execute'),
         'anonFinish', has_function_privilege('anon', 'public.finish_push_jobs(jsonb)', 'execute'),
         'personJobs', has_table_privilege('authenticated', 'private.push_jobs', 'select'),
         'personCounters', has_table_privilege('authenticated', 'private.push_counters', 'select'),
         'serviceClaim', has_function_privilege('service_role', 'public.claim_push_jobs(integer)', 'execute'),
         'serviceTick', has_function_privilege('service_role', 'private.push_tick(timestamptz)', 'execute'))`,
    );
    expect(rights).toEqual({
      personTick: false,
      personClaim: false,
      personCounts: false,
      anonFinish: false,
      personJobs: false,
      personCounters: false,
      serviceClaim: true,
      serviceTick: false,
    });
  });
});
