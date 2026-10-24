import { describe, expect, it } from "vitest";
import {
  PARTNER_COMPLETION_CASES,
  QUIET_END_CASES,
  TAKE_OVER_CASES,
} from "../../src/domain/notificationPlan.cases";
import { SCHEMA_VERSION } from "../../src/storage/appData";
import {
  DEFAULT_PUSH_SETTINGS,
  type PushSettings,
  settingsArguments,
} from "../functions/push/rules";
import {
  anonymous,
  call,
  couple,
  invite,
  literal,
  type Person,
  pushDevice,
  signedIn,
  sql,
  sqlJson,
  withHousehold,
} from "./setup";

// NT-d: the messages about the other person and about joining (migration `…_push_events.sql`).
// Events arise from the app's own calls (`complete_task`, `save_task`, `accept_invite`) as the two
// people make them; the schedule's side (`claim_push_jobs`, `defer_quiet_pushes`) as SQL of the
// owner of the database with the moment as a parameter. The events get the real time of the
// database (`now()`), so the moments are given relative to it ("now() + interval '6 minutes'").
// The cases of the rules are the app's (src/domain/notificationPlan.cases.ts).
//
// Every test makes its own people and devices and looks only at them; messages of other tests are
// cleared first (`clearJobs`).

const change = () => ({ p_change_id: crypto.randomUUID(), p_schema_version: SCHEMA_VERSION });

/** A weekly task due on 20 October 2026, for `assignee`. */
function task(assignee = "personA", extra: Record<string, unknown> = {}) {
  return {
    kind: "recurring",
    id: `t-${crypto.randomUUID()}`,
    title: "Bad putzen (darf nie in einer Meldung stehen)",
    symbol: "standard",
    recurrence: { unit: "week", interval: 1 },
    assignee,
    dueDate: "2026-10-20",
    checklist: [],
    ...extra,
  };
}

type Task = ReturnType<typeof task>;

const addTask = async (person: Person, added: Task) => {
  await call(person, "save_task", {
    ...change(),
    p_task_id: added.id,
    p_set: added,
    p_unset: [],
    p_create: added,
  });
  return added;
};

/** A completion of the task by `by` (as the app writes it), just now unless `completedAt` says. */
function completion(of: Task, by: string, extra: Record<string, unknown> = {}) {
  return {
    id: `c-${crypto.randomUUID()}`,
    taskId: of.id,
    completedOn: "2026-10-20",
    completedBy: by,
    previousDueDate: of.dueDate,
    nextDueDate: "2026-10-27",
    checkedItemIds: [],
    completedAt: new Date().toISOString(),
    assigneeAtCompletion: of.assignee,
    ...extra,
  };
}

const complete = (person: Person, done: ReturnType<typeof completion>, changeId?: string) =>
  call(person, "complete_task", {
    p_change_id: changeId ?? crypto.randomUUID(),
    p_schema_version: SCHEMA_VERSION,
    p_completion: done,
    p_set: { dueDate: "2026-10-27" },
    p_unset: [],
  });

const undo = (person: Person, done: ReturnType<typeof completion>) =>
  call(person, "undo_completion", {
    ...change(),
    p_completion_id: done.id,
    p_set: { dueDate: done.previousDueDate },
    p_unset: [],
  });

const save = (person: Person, of: Task, set: Record<string, unknown>, unset: string[] = []) =>
  call(person, "save_task", { ...change(), p_task_id: of.id, p_set: set, p_unset: unset });

interface Device {
  /** `push_devices.id`. */
  readonly row: string;
  readonly deviceId: string;
  readonly endpoint: string;
}

/**
 * Switches notifications on for a new device of the person. Without quiet hours unless the test
 * gives them, so the tests do not depend on the time of day they run at.
 */
async function switchOn(
  person: Person,
  settings: Partial<PushSettings> = {},
  deviceId?: string,
): Promise<Device> {
  const phone = pushDevice(deviceId === undefined ? {} : { p_device_id: deviceId });
  await call(person, "register_push_device", phone);
  await call(person, "update_push_settings", {
    p_device_id: phone.p_device_id,
    ...settingsArguments({ ...DEFAULT_PUSH_SETTINGS, quietEnabled: false, ...settings }),
  });
  const [row] = sql(
    `select id from public.push_devices where device_id = ${literal(phone.p_device_id)} and endpoint = ${literal(phone.p_endpoint)}`,
  );
  return { row: row ?? "", deviceId: phone.p_device_id, endpoint: phone.p_endpoint };
}

const list = (devices: readonly Device[]) =>
  devices.length === 0 ? "null" : devices.map((device) => literal(device.row)).join(", ");

const clearJobs = () => sql("delete from private.push_jobs; delete from private.push_counters;");

interface Job {
  readonly device: string;
  readonly kind: string;
  readonly events: number;
  /** Minutes from now (rounded) until it may go. */
  readonly inMinutes: number;
}

/** The waiting messages of these devices, oldest first. */
const jobsOf = (devices: readonly Device[]) =>
  sqlJson<Job[]>(
    `select coalesce(jsonb_agg(jsonb_build_object('device', j.device, 'kind', j.kind, 'events', (select count(*) from private.push_job_events l where l.job = j.id), 'inMinutes', round(extract(epoch from j.not_before - now()) / 60)) order by j.id), '[]'::jsonb) from private.push_jobs j where j.device in (${list(devices)})`,
  );

/**
 * The events of a household: kind and who is told. Without joining unless asked (`couple` makes
 * one when B accepts the invite).
 */
const eventsOf = (household: string, joined = false) =>
  sqlJson<{ kind: string; recipient: string; actor: string }[]>(
    `select coalesce(jsonb_agg(jsonb_build_object('kind', e.kind, 'recipient', e.recipient_user, 'actor', e.actor_user) order by e.id), '[]'::jsonb) from private.push_events e where e.household_id = ${literal(household)} and (${joined} or e.kind <> 'joined')`,
  );

interface Claimed {
  readonly jobs: readonly (Record<string, unknown> & { endpoint: string })[];
  readonly empty: number;
  readonly dropped: number;
}

/** `claim_push_jobs` at a moment given in SQL (e.g. "now() + interval '6 minutes'"). */
const claim = (moment: string) =>
  sqlJson<Claimed>(`select private.claim_push_jobs(100, ${moment})`);

/** What the claim handed out for these devices, without the address and keys. */
const told = (claimed: Claimed, devices: readonly Device[]) =>
  claimed.jobs
    .filter((job) => devices.some((device) => device.endpoint === job.endpoint))
    .map(
      ({ id: _id, endpoint: _endpoint, p256dh: _p256dh, auth: _auth, keyId: _keyId, ...what }) =>
        what,
    );

const AFTER_WAIT = "now() + interval '6 minutes'";

async function failure(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return (error as Error).message;
  }
  return "kein Fehler";
}

describe("NT-d Gemeinsame Fälle mit der App", () => {
  it("NT-d Erledigt zählt nur von der anderen Person, für mich oder beide, höchstens 24 Stunden alt", () => {
    const rows = PARTNER_COMPLETION_CASES.map(
      (example, index) =>
        `(${index}, ${literal(JSON.stringify(example.completion))}::jsonb, ${literal(example.actor)}, ${literal(example.recipient)}, ${literal(example.arrivedAt)}::timestamptz)`,
    ).join(",\n");
    const results = sqlJson<boolean[]>(
      `select jsonb_agg(private.is_partner_completion(c.data, c.actor, c.recipient, c.arrived) order by c.n) from (values ${rows}) as c(n, data, actor, recipient, arrived)`,
    );
    PARTNER_COMPLETION_CASES.forEach((example, index) => {
      expect(results[index], example.name).toBe(example.expected);
    });
  });

  it("NT-d Übernommen zählt nur dieses Mal oder dauerhaft, von mir oder beiden, durch die andere Person", () => {
    const rows = TAKE_OVER_CASES.map(
      (example, index) =>
        `(${index}, ${literal(JSON.stringify(example.before))}::jsonb, ${literal(JSON.stringify(example.after))}::jsonb, ${literal(example.actor)}, ${literal(example.recipient)})`,
    ).join(",\n");
    const results = sqlJson<boolean[]>(
      `select jsonb_agg(private.is_takeover(c.before, c.after, c.actor, c.recipient) order by c.n) from (values ${rows}) as c(n, before, after, actor, recipient)`,
    );
    TAKE_OVER_CASES.forEach((example, index) => {
      expect(results[index], example.name).toBe(example.expected);
    });
  });

  it("NT-d Ende der Ruhezeit nach Ortszeit, über Mitternacht und Zeitumstellung", () => {
    const rows = QUIET_END_CASES.map(
      (example, index) =>
        `(${index}, ${literal(example.now)}::timestamptz, ${literal(example.timeZone)}, ${example.quietEnabled}, ${literal(example.quietFrom)}::time, ${literal(example.quietTo)}::time)`,
    ).join(",\n");
    const results = sqlJson<(string | null)[]>(
      `select jsonb_agg(to_char(private.quiet_end(c.moment, c.zone, c.enabled, c.from_, c.to_) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') order by c.n) from (values ${rows}) as c(n, moment, zone, enabled, from_, to_)`,
    );
    QUIET_END_CASES.forEach((example, index) => {
      expect(results[index], example.name).toBe(example.expected);
    });
  });
});

describe("NT-d Ereignisse aus Erledigen und Übernehmen", () => {
  it("NT-d Robin erledigt zwei Aufgaben für Alex und übernimmt eine: eine Meldung nach 5 Minuten an jedes Gerät von Alex, keine an Robin", async () => {
    clearJobs();
    const { a, b, household } = await couple();
    const phone = await switchOn(a);
    const laptop = await switchOn(a);
    const robinsPhone = await switchOn(b);
    const [first, second, shared, third] = [
      await addTask(a, task("personA")),
      await addTask(a, task("personA")),
      await addTask(a, task("both")),
      await addTask(a, task("personA")),
    ];

    await complete(b, completion(first, "personB"));
    await complete(b, completion(shared, "personB"));
    await save(b, third, { takenOverBy: "personB" });

    expect(eventsOf(household)).toEqual([
      { kind: "done", recipient: a.id, actor: b.id },
      { kind: "done", recipient: a.id, actor: b.id },
      { kind: "tookOver", recipient: a.id, actor: b.id },
    ]);
    const waiting = jobsOf([phone, laptop, robinsPhone]);
    expect(waiting.map((job) => job.device).sort()).toEqual([phone.row, laptop.row].sort());
    for (const job of waiting) {
      expect(job).toEqual({ device: job.device, kind: "partner", events: 3, inMinutes: 5 });
    }
    // Not before the 5 minutes are over; one more meanwhile joins the same message.
    expect(told(claim("now() + interval '4 minutes'"), [phone, laptop])).toEqual([]);
    await complete(b, completion(second, "personB"));
    const claimed = claim(AFTER_WAIT);

    expect(told(claimed, [phone, laptop, robinsPhone])).toEqual([
      { kind: "partner", name: "Robin", done: 3, took: 1 },
      { kind: "partner", name: "Robin", done: 3, took: 1 },
    ]);
    expect(JSON.stringify(claimed)).not.toContain("Bad putzen");
  });

  it("NT-d Keine Meldung für Eigenes, keine Doppelten bei Wiederholung derselben Änderung oder Erledigung, keine nach 24 Stunden Offline", async () => {
    clearJobs();
    const { a, b, household } = await couple();
    const phone = await switchOn(a);
    const own = await addTask(a, task("personA"));
    const robins = await addTask(a, task("personB"));
    const late = await addTask(a, task("personA"));
    const twice = await addTask(a, task("personA"));

    // A ticks off their own task, B their own: nobody is told.
    await complete(a, completion(own, "personA"));
    await complete(b, completion(robins, "personB"));
    // B's completion arrives after two days offline.
    await complete(
      b,
      completion(late, "personB", {
        completedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      }),
    );
    expect(eventsOf(household)).toEqual([]);

    // The same change again (sync after a lost answer), the same completion with a new change.
    const done = completion(twice, "personB");
    const changeId = crypto.randomUUID();
    await complete(b, done, changeId);
    await complete(b, done, changeId);
    await complete(b, done);
    expect(eventsOf(household)).toHaveLength(1);
    expect(jobsOf([phone])).toEqual([expect.objectContaining({ kind: "partner", events: 1 })]);
    expect(told(claim(AFTER_WAIT), [phone])).toEqual([
      { kind: "partner", name: "Robin", done: 1, took: 0 },
    ]);
  });

  it("NT-d Rückgängig, Löschen oder Zurückgeben innerhalb der 5 Minuten: das Ereignis zählt nicht, ohne anderes keine Meldung", async () => {
    clearJobs();
    const { a, b, household } = await couple();
    const phone = await switchOn(a);
    const [undone, deleted, given] = [
      await addTask(a, task("personA")),
      await addTask(a, task("personA")),
      await addTask(a, task("personA")),
    ];
    const done = completion(undone, "personB");
    await complete(b, done);
    await complete(b, completion(deleted, "personB"));
    await save(b, given, { takenOverBy: "personB" });
    expect(eventsOf(household)).toHaveLength(3);

    await undo(b, done);
    await call(a, "delete_task", { ...change(), p_task_id: deleted.id });
    // A takes it back before the message goes (which B is told, B has no device).
    await save(a, given, {}, ["takenOverBy"]);

    expect(eventsOf(household)).toEqual([
      { kind: "tookOver", recipient: a.id, actor: b.id },
      { kind: "tookOver", recipient: b.id, actor: a.id },
    ]);
    const claimed = claim(AFTER_WAIT);
    expect(told(claimed, [phone])).toEqual([]);
    expect(claimed.empty).toBeGreaterThanOrEqual(1);
    expect(jobsOf([phone])).toEqual([]);
  });

  it("NT-d Nachträgliche Korrekturen erzeugen keine Meldung: Sicherung einspielen, Daten übernehmen, Abhaken setzt die Übernahme zurück", async () => {
    clearJobs();
    const { a, b, household } = await couple();
    await switchOn(a);
    const restored = task("personA");
    const added = task("personA", { title: "Neu aus Etappe 1" });

    await call(b, "replace_household_data", {
      p_change_id: crypto.randomUUID(),
      p_data: {
        schemaVersion: SCHEMA_VERSION,
        tasks: [restored],
        completions: [completion(restored, "personB")],
      },
    });
    await call(b, "add_household_data", {
      ...change(),
      p_data: { tasks: [added], completions: [completion(added, "personB")] },
    });
    // A had taken over B's task once; B ticks it off, which hands it back to B (no takeover).
    const robins = await addTask(b, task("personB", { takenOverBy: "personA" }));
    await call(b, "complete_task", {
      ...change(),
      p_completion: completion(robins, "personB", { assigneeAtCompletion: "personB" }),
      p_set: { dueDate: "2026-10-27" },
      p_unset: ["takenOverBy"],
    });

    expect(eventsOf(household)).toEqual([]);
  });

  it("NT-d Abgeschaltet: ohne Schalter „Partner“ keine Meldung; nach dem Abschalten entfällt eine wartende", async () => {
    clearJobs();
    const { a, b } = await couple();
    const off = await switchOn(a, { partnerEnabled: false });
    const later = await switchOn(a);
    await complete(b, completion(await addTask(a, task("personA")), "personB"));
    expect(jobsOf([off, later])).toEqual([
      expect.objectContaining({ device: later.row, kind: "partner" }),
    ]);

    await call(a, "update_push_settings", {
      p_device_id: later.deviceId,
      ...settingsArguments({
        ...DEFAULT_PUSH_SETTINGS,
        quietEnabled: false,
        partnerEnabled: false,
      }),
    });
    expect(told(claim(AFTER_WAIT), [off, later])).toEqual([]);
    expect(jobsOf([later])).toEqual([]);
  });
});

describe("NT-d Ruhezeit", () => {
  it("NT-d In der Ruhezeit zurückgehalten, alles bis dahin am Ende als eine Meldung", async () => {
    clearJobs();
    const { a, b } = await couple();
    // Quiet hours around now on this device: from an hour ago to two hours from now.
    const [from = "", to = ""] =
      sql(
        "select to_char((now() - interval '1 hour') at time zone 'Europe/Berlin', 'HH24:MI') || '|' || to_char((now() + interval '2 hours') at time zone 'Europe/Berlin', 'HH24:MI')",
      )[0]?.split("|") ?? [];
    const phone = await switchOn(a, { quietEnabled: true, quietFrom: from, quietTo: to });
    const awake = await switchOn(a, { quietEnabled: false });
    await complete(b, completion(await addTask(a, task("personA")), "personB"));

    // The schedule after the 5 minutes: the quiet device waits, the other one is handed out.
    sql(`select private.defer_quiet_pushes(${AFTER_WAIT})`);
    const first = claim(AFTER_WAIT);
    expect(told(first, [phone])).toEqual([]);
    expect(told(first, [awake])).toEqual([expect.objectContaining({ done: 1 })]);
    expect(jobsOf([phone])).toEqual([
      expect.objectContaining({ kind: "partner", events: 1, inMinutes: expect.any(Number) }),
    ]);
    const waits = jobsOf([phone])[0]?.inMinutes ?? 0;
    expect(waits).toBeGreaterThanOrEqual(118);
    expect(waits).toBeLessThanOrEqual(121);

    // More during the quiet hours joins the same message.
    await complete(b, completion(await addTask(a, task("personA")), "personB"));
    expect(jobsOf([phone])).toEqual([expect.objectContaining({ events: 2 })]);
    expect(told(claim("now() + interval '90 minutes'"), [phone])).toEqual([]);
    expect(told(claim("now() + interval '125 minutes'"), [phone])).toEqual([
      { kind: "partner", name: "Robin", done: 2, took: 0 },
    ]);
  });
});

describe("NT-d Beitritt zum Haushalt", () => {
  it("NT-d Tritt Robin bei, bekommt Alex sofort eine Meldung mit Robins Namen; Robin selbst keine; ohne Schalter „Haushalt“ keine", async () => {
    clearJobs();
    const a = await withHousehold();
    const phone = await switchOn(a);
    const notWanted = await switchOn(a, { householdEnabled: false });
    const b = await signedIn();
    const robinsPhone = await switchOn(b);

    await call(b, "accept_invite", { p_token: (await invite(a)).token });

    expect(eventsOf(a.household, true)).toEqual([{ kind: "joined", recipient: a.id, actor: b.id }]);
    expect(jobsOf([phone, notWanted, robinsPhone])).toEqual([
      { device: phone.row, kind: "joined", events: 1, inMinutes: 0 },
    ]);
    // Without quiet hours on the device (with them it would wait for their end like the others).
    expect(told(claim("now() + interval '1 minute'"), [phone, notWanted, robinsPhone])).toEqual([
      { kind: "joined", name: "Robin" },
    ]);
  });
});

describe("NT-d Aufräumen: Verlassen, Entfernen, Konto löschen, Gerät abmelden", () => {
  /** Two households of two with a message waiting for each person. */
  async function twoHouseholds() {
    clearJobs();
    const one = await couple();
    const two = await couple();
    const phones = {
      a1: await switchOn(one.a),
      b1: await switchOn(one.b),
      a2: await switchOn(two.a),
      b2: await switchOn(two.b),
    };
    for (const { a, b } of [one, two]) {
      await complete(b, completion(await addTask(a, task("personA")), "personB"));
      await complete(a, completion(await addTask(a, task("personB")), "personA"));
    }
    const other = () => ({
      events: eventsOf(two.household),
      jobs: jobsOf([phones.a2, phones.b2]).map(({ inMinutes: _inMinutes, ...job }) => job),
    });
    const before = other();
    expect(before.events).toHaveLength(2);
    expect(before.jobs).toHaveLength(2);
    return { one, two, phones, other, before };
  }

  it("NT-d Haushalt verlassen: Wartendes von und für die Person ist weg, ihr Gerät bleibt beim Konto; der andere Haushalt bleibt unberührt", async () => {
    const { one, phones, other, before } = await twoHouseholds();

    await call(one.b, "leave_household");

    // Also the one about B joining.
    expect(eventsOf(one.household, true)).toEqual([]);
    expect(jobsOf([phones.a1, phones.b1])).toEqual([]);
    expect(
      sql(`select count(*) from public.push_devices where id = ${literal(phones.b1.row)}`),
    ).toEqual(["1"]);
    expect(other()).toEqual(before);
    expect(told(claim(AFTER_WAIT), [phones.a1, phones.b1])).toEqual([]);
  });

  it("NT-d Mitglied entfernen: Wartendes der entfernten Person und über sie ist weg; der andere Haushalt bleibt unberührt", async () => {
    const { one, phones, other, before } = await twoHouseholds();

    await call(one.a, "remove_member", { p_role: "personB" });

    expect(eventsOf(one.household, true)).toEqual([]);
    expect(jobsOf([phones.a1, phones.b1])).toEqual([]);
    expect(other()).toEqual(before);
  });

  it("NT-d Konto löschen: Geräte, Ereignisse und Wartendes der Person sind weg; der andere Haushalt bleibt unberührt", async () => {
    const { one, phones, other, before } = await twoHouseholds();

    await call(one.b, "delete_account");

    expect(
      sql(`select count(*) from public.push_devices where id = ${literal(phones.b1.row)}`),
    ).toEqual(["0"]);
    expect(
      sql(
        `select count(*) from private.push_events where recipient_user = ${literal(one.b.id)} or actor_user = ${literal(one.b.id)}`,
      ),
    ).toEqual(["0"]);
    expect(jobsOf([phones.a1, phones.b1])).toEqual([]);
    expect(other()).toEqual(before);
  });

  it("NT-d Gerät abmelden (Ausschalten, Abmelden): seine wartenden Meldungen sind weg, die anderen Geräte bekommen ihre", async () => {
    const { one, phones, other, before } = await twoHouseholds();
    const laptop = await switchOn(one.a);
    await complete(one.b, completion(await addTask(one.a, task("personA")), "personB"));

    await call(one.a, "unregister_push_device", { p_device_id: phones.a1.deviceId });

    expect(jobsOf([phones.a1])).toEqual([]);
    expect(jobsOf([laptop])).toEqual([expect.objectContaining({ kind: "partner", events: 1 })]);
    expect(other()).toEqual(before);
  });
});

describe("NT-d Tagesüberblick: einmal je Konto, Gerät und Tag", () => {
  it("NT-d Aus- und wieder Einschalten oder neue Uhrzeit am selben Tag bringt keinen zweiten Überblick; ein anderes Gerät bekommt seinen", async () => {
    clearJobs();
    const alex = await withHousehold();
    const deviceId = crypto.randomUUID();
    const phone = await switchOn(alex, {}, deviceId);
    const plan = (moment: string) =>
      sql(`select private.plan_daily_pushes(${literal(moment)}::timestamptz)`);
    // Wednesday 3 March 2027, 07:30 in Berlin.
    plan("2027-03-03T06:30:00Z");
    expect(jobsOf([phone])).toEqual([expect.objectContaining({ kind: "daily" })]);

    // Switched off and on again (a new row, the same device), then the time moved to 08:00.
    await call(alex, "unregister_push_device", { p_device_id: deviceId });
    const again = await switchOn(alex, { dailyTime: "08:00" }, deviceId);
    plan("2027-03-03T07:00:00Z");
    plan("2027-03-03T07:05:00Z");
    expect(jobsOf([phone, again])).toEqual([]);

    const other = await switchOn(alex, { dailyTime: "08:00" });
    plan("2027-03-03T07:06:00Z");
    expect(jobsOf([again, other])).toEqual([
      expect.objectContaining({ device: other.row, kind: "daily" }),
    ]);
    // Next day both again.
    plan("2027-03-04T07:00:00Z");
    expect(jobsOf([again]).map((job) => job.kind)).toEqual(["daily"]);
  });
});

describe("NT-d S5 Ereignisse und Meldungen sind nur für Datenbank und Edge Function", () => {
  it("NT-d S5 Personen und anon sehen keine Ereignisse und können die neuen Funktionen nicht aufrufen; Erledigen und Übernehmen gehen weiter nur angemeldet", async () => {
    const { a, b } = await couple();
    await switchOn(a);
    await complete(b, completion(await addTask(a, task("personA")), "personB"));

    for (const table of ["push_events", "push_job_events", "push_daily_marks"]) {
      const read = await a.client.schema("private").from(table).select("*");
      expect(read.error, table).not.toBeNull();
    }
    for (const name of ["defer_quiet_pushes", "partner_counts", "quiet_end", "is_takeover"]) {
      expect(await failure(call(a, name)), name).not.toBe("kein Fehler");
    }
    expect(
      await failure(
        call(anonymous(), "complete_task", {
          ...change(),
          p_completion: {},
          p_set: {},
          p_unset: [],
        }),
      ),
    ).toMatch(/permission denied/);

    const rights = sqlJson<Record<string, boolean>>(
      `select jsonb_build_object(
         'personEvents', has_table_privilege('authenticated', 'private.push_events', 'select'),
         'anonEvents', has_table_privilege('anon', 'private.push_events', 'select'),
         'personLinks', has_table_privilege('authenticated', 'private.push_job_events', 'select'),
         'personMarks', has_table_privilege('authenticated', 'private.push_daily_marks', 'select'),
         'personDefer', has_function_privilege('authenticated', 'private.defer_quiet_pushes(timestamptz)', 'execute'),
         'personCounts', has_function_privilege('authenticated', 'private.partner_counts(bigint, uuid, uuid)', 'execute'),
         'personQueue', has_function_privilege('authenticated', 'private.queue_push_event()', 'execute'),
         'serviceDefer', has_function_privilege('service_role', 'private.defer_quiet_pushes(timestamptz)', 'execute'),
         'personComplete', has_function_privilege('authenticated', 'public.complete_task(text, integer, jsonb, jsonb, text[])', 'execute'),
         'anonComplete', has_function_privilege('anon', 'public.complete_task(text, integer, jsonb, jsonb, text[])', 'execute'),
         'anonSave', has_function_privilege('anon', 'public.save_task(text, integer, text, jsonb, text[], jsonb)', 'execute'))`,
    );
    expect(rights).toEqual({
      personEvents: false,
      anonEvents: false,
      personLinks: false,
      personMarks: false,
      personDefer: false,
      personCounts: false,
      personQueue: false,
      serviceDefer: false,
      personComplete: true,
      anonComplete: false,
      anonSave: false,
    });
  });
});
