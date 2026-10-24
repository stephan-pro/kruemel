import { describe, expect, it } from "vitest";
import {
  DEFAULT_PUSH_SETTINGS,
  type PushSettings,
  settingsArguments,
  settingsFromRow,
} from "../functions/push/rules";
import {
  ALLOWED_ENDPOINTS,
  INVALID_SETTINGS,
  REFUSED_ENDPOINTS,
  VALID_SETTINGS,
} from "../functions/push/rules.cases";
import {
  admin,
  anonymous,
  call,
  couple,
  pushDevice as device,
  type Person,
  randomKey,
  signedIn,
  withHousehold,
} from "./setup";

// NT-a: the push addresses of the devices (`push_devices`) and the limits of the test
// notification (`request_test_push`, called by the Edge Function `push` with the person's
// sign-in). The Edge Function itself is tested with a mock push service in `check`
// (supabase/functions/push/core.test.ts).

async function failure(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return (error as Error).message;
  }
  return "kein Fehler";
}

/** The rows of a person as the service role sees them (all columns). */
async function devicesOf(person: Person) {
  const { data, error } = await admin.from("push_devices").select("*").eq("user_id", person.id);
  if (error) {
    throw error;
  }
  return data as {
    device_id: string;
    endpoint: string;
    time_zone: string;
    locale: string;
    key_id: string;
  }[];
}

describe("NT-a Geräte für Benachrichtigungen (Datenbank)", () => {
  it("NT-a Einschalten speichert das Gerät; erneutes Einschalten aktualisiert es, statt es zu verdoppeln", async () => {
    const alex = await withHousehold();
    const phone = device();

    await call(alex, "register_push_device", phone);
    const moved = { ...phone, p_endpoint: `https://web.push.apple.com/${crypto.randomUUID()}` };
    await call(alex, "register_push_device", { ...moved, p_time_zone: "America/New_York" });

    expect(await devicesOf(alex)).toEqual([
      expect.objectContaining({
        device_id: phone.p_device_id,
        endpoint: moved.p_endpoint,
        time_zone: "America/New_York",
        locale: "de",
        key_id: "schluessel-1",
      }),
    ]);
  });

  it("NT-a Unbekannte Zeitzone wird Berlin, unbekannte Sprache Deutsch", async () => {
    const alex = await signedIn();

    await call(alex, "register_push_device", device({ p_time_zone: "Mars/Olymp", p_locale: "x" }));

    expect(await devicesOf(alex)).toEqual([
      expect.objectContaining({ time_zone: "Europe/Berlin", locale: "de" }),
    ]);
  });

  it("NT-a Erlaubtliste: nur Adressen der Push-Dienste der Browser, dieselben Fälle wie in der Edge Function", async () => {
    const alex = await signedIn();

    for (const endpoint of ALLOWED_ENDPOINTS) {
      await call(alex, "register_push_device", device({ p_endpoint: endpoint }));
    }
    for (const endpoint of REFUSED_ENDPOINTS) {
      expect(
        await failure(call(alex, "register_push_device", device({ p_endpoint: endpoint }))),
        endpoint,
      ).toContain("push_endpoint_invalid");
    }
    expect((await devicesOf(alex)).map((row) => row.endpoint).sort()).toEqual(
      [...ALLOWED_ENDPOINTS].sort(),
    );
  });

  it("NT-a Größen: Schlüssel mit fester Länge, Kennung des Schlüssels begrenzt", async () => {
    const alex = await signedIn();

    for (const wrong of [
      { p_p256dh: `B${randomKey(85)}` },
      { p_p256dh: `B${randomKey(86)}=` },
      { p_auth: randomKey(23) },
      { p_auth: "a".repeat(21) },
      { p_key_id: "" },
      { p_key_id: "k".repeat(33) },
      { p_p256dh: null },
    ]) {
      expect(await failure(call(alex, "register_push_device", device(wrong)))).toContain(
        "push_keys_invalid",
      );
    }
    expect(await devicesOf(alex)).toEqual([]);
  });

  it("NT-a Höchstens 10 Geräte je Konto: das elfte ersetzt das am längsten nicht gesehene", async () => {
    const alex = await signedIn();
    const devices = Array.from({ length: 11 }, () => device());

    for (const next of devices) {
      await call(alex, "register_push_device", next);
    }

    const kept = (await devicesOf(alex)).map((row) => row.device_id).sort();
    expect(kept).toEqual(
      devices
        .slice(1)
        .map((next) => next.p_device_id)
        .sort(),
    );
  });

  it("NT-a Meldet ein anderes Konto dieselbe Push-Adresse an, gehört sie danach diesem Konto", async () => {
    const [alex, robin] = [await signedIn(), await signedIn()];
    const shared = device();

    await call(alex, "register_push_device", shared);
    await call(robin, "register_push_device", { ...shared, p_device_id: crypto.randomUUID() });

    expect(await devicesOf(alex)).toEqual([]);
    expect((await devicesOf(robin)).map((row) => row.endpoint)).toEqual([shared.p_endpoint]);
  });

  it("NT-a Ausschalten löscht nur das eigene Gerät", async () => {
    const [alex, robin] = [await signedIn(), await signedIn()];
    const [mine, other] = [device(), device()];
    await call(alex, "register_push_device", mine);
    await call(robin, "register_push_device", other);

    await call(alex, "unregister_push_device", { p_device_id: other.p_device_id });
    expect(await devicesOf(robin)).toHaveLength(1);
    await call(alex, "unregister_push_device", { p_device_id: mine.p_device_id });
    expect(await devicesOf(alex)).toEqual([]);
  });

  it("NT-a Konto löschen löscht seine Geräte", async () => {
    const alex = await withHousehold();
    await call(alex, "register_push_device", device());

    await call(alex, "delete_account");

    expect(await devicesOf(alex)).toEqual([]);
  });
});

describe("NT-a Testbenachrichtigung (Datenbank)", () => {
  it("NT-a Die Testbenachrichtigung liefert die Adresse des eigenen Geräts, höchstens eine pro Minute und Gerät", async () => {
    const alex = await signedIn();
    const phone = device();
    await call(alex, "register_push_device", phone);

    expect(await call(alex, "request_test_push", { p_device_id: phone.p_device_id })).toEqual({
      endpoint: phone.p_endpoint,
      p256dh: phone.p_p256dh,
      auth: phone.p_auth,
      keyId: phone.p_key_id,
    });
    expect(
      await failure(call(alex, "request_test_push", { p_device_id: phone.p_device_id })),
    ).toContain("push_test_wait");
  });

  it("NT-a Höchstens 10 Testbenachrichtigungen am Tag je Konto", async () => {
    const alex = await signedIn();
    const devices = Array.from({ length: 11 }, () => device());

    for (const next of devices.slice(0, 10)) {
      await call(alex, "register_push_device", next);
      await call(alex, "request_test_push", { p_device_id: next.p_device_id });
    }
    // The eleventh device replaces the first one; its test is the eleventh of the day.
    const eleventh = devices[10] ?? device();
    await call(alex, "register_push_device", eleventh);

    expect(
      await failure(call(alex, "request_test_push", { p_device_id: eleventh.p_device_id })),
    ).toContain("push_test_today");
  });

  it("NT-a S5 Fremdes Gerät: unbekannt, auch mit seiner Kennung; ohne Anmeldung geht nichts", async () => {
    const [alex, robin] = [await signedIn(), await signedIn()];
    const robinsPhone = device();
    await call(robin, "register_push_device", robinsPhone);

    expect(
      await failure(call(alex, "request_test_push", { p_device_id: robinsPhone.p_device_id })),
    ).toContain("push_device_unknown");
    for (const [name, args] of [
      ["register_push_device", device()],
      ["unregister_push_device", { p_device_id: robinsPhone.p_device_id }],
      ["request_test_push", { p_device_id: robinsPhone.p_device_id }],
    ] as const) {
      expect(await failure(call(anonymous(), name, args)), name).toMatch(/permission denied/);
    }
    expect(await devicesOf(robin)).toHaveLength(1);
  });
});

describe("NT-a S5 Lesen und Schreiben der Geräte", () => {
  it("NT-a S5 Jede Person sieht nur die eigenen Geräte und nie Adresse oder Schlüssel; Schreiben nur über die Funktionen", async () => {
    const [alex, robin] = [await signedIn(), await signedIn()];
    const phone = device();
    await call(alex, "register_push_device", phone);

    const own = await alex.client.from("push_devices").select("device_id, key_id, time_zone");
    expect(own.data).toEqual([
      { device_id: phone.p_device_id, key_id: "schluessel-1", time_zone: "Europe/Berlin" },
    ]);
    const foreign = await robin.client.from("push_devices").select("device_id");
    expect(foreign.data).toEqual([]);
    for (const column of ["endpoint", "p256dh", "auth", "*"]) {
      const secret = await alex.client.from("push_devices").select(column);
      expect(secret.error?.message, column).toMatch(/permission denied/);
    }
    const anon = await anonymous().from("push_devices").select("device_id");
    expect(anon.error?.message).toMatch(/permission denied/);

    const inserted = await robin.client.from("push_devices").insert({
      user_id: robin.id,
      device_id: crypto.randomUUID(),
      endpoint: "https://fcm.googleapis.com/fcm/send/eingeschmuggelt",
      p256dh: phone.p_p256dh,
      auth: phone.p_auth,
      key_id: "k",
      time_zone: "Europe/Berlin",
    });
    expect(inserted.error?.message).toMatch(/permission denied/);
    const moved = await alex.client
      .from("push_devices")
      .update({ time_zone: "UTC" })
      .eq("device_id", phone.p_device_id);
    expect(moved.error?.message).toMatch(/permission denied/);
    const deleted = await alex.client
      .from("push_devices")
      .delete()
      .eq("device_id", phone.p_device_id);
    expect(deleted.error?.message).toMatch(/permission denied/);
    expect(await devicesOf(alex)).toHaveLength(1);
  });
});

// NT-b: the settings of a device. The same cases as the app and the fake server
// (supabase/functions/push/rules.cases.ts).

/** The settings of a device as its owner reads them (columns granted to `authenticated`). */
async function settingsOf(person: Person, deviceId: string): Promise<PushSettings | null> {
  const { data, error } = await person.client
    .from("push_devices")
    .select(
      "daily_enabled, daily_time, daily_days, partner_enabled, household_enabled, quiet_enabled, quiet_from, quiet_to",
    )
    .eq("device_id", deviceId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data === null ? null : settingsFromRow(data as Parameters<typeof settingsFromRow>[0]);
}

const save = (person: Person, deviceId: string, settings: PushSettings) =>
  call(person, "update_push_settings", { p_device_id: deviceId, ...settingsArguments(settings) });

describe("NT-b Einstellungen der Geräte (Datenbank)", () => {
  it("NT-b Ein neues Gerät hat die Standardwerte: alles an, Tagesüberblick 07:30, Ruhezeit 21 bis 7 Uhr", async () => {
    const alex = await signedIn();
    const phone = device();

    await call(alex, "register_push_device", phone);

    expect(await settingsOf(alex, phone.p_device_id)).toEqual(DEFAULT_PUSH_SETTINGS);
  });

  it("NT-b Gültige Einstellungen werden gespeichert und genau so wieder gelesen", async () => {
    const alex = await signedIn();
    const phone = device();
    await call(alex, "register_push_device", phone);

    for (const settings of VALID_SETTINGS) {
      await save(alex, phone.p_device_id, settings);
      expect(await settingsOf(alex, phone.p_device_id), JSON.stringify(settings)).toEqual(settings);
    }
  });

  it("NT-b Ungültige Einstellungen werden abgelehnt und ändern nichts (dieselben Fälle wie in der App)", async () => {
    const alex = await signedIn();
    const phone = device();
    await call(alex, "register_push_device", phone);

    for (const { settings } of INVALID_SETTINGS) {
      expect(
        await failure(save(alex, phone.p_device_id, settings)),
        JSON.stringify(settings),
      ).toContain("push_settings_invalid");
    }
    for (const missing of [
      "p_daily_enabled",
      "p_daily_time",
      "p_daily_days",
      "p_partner_enabled",
      "p_household_enabled",
      "p_quiet_enabled",
      "p_quiet_from",
      "p_quiet_to",
    ]) {
      expect(
        await failure(
          call(alex, "update_push_settings", {
            p_device_id: phone.p_device_id,
            ...settingsArguments(DEFAULT_PUSH_SETTINGS),
            [missing]: null,
          }),
        ),
        missing,
      ).toContain("push_settings_invalid");
    }
    expect(await settingsOf(alex, phone.p_device_id)).toEqual(DEFAULT_PUSH_SETTINGS);
  });

  it("NT-b Erneutes Anmelden des Geräts (neue Adresse, neue Zeitzone) behält die Einstellungen", async () => {
    const alex = await signedIn();
    const phone = device();
    await call(alex, "register_push_device", phone);
    const chosen = { ...DEFAULT_PUSH_SETTINGS, dailyTime: "06:45", partnerEnabled: false };
    await save(alex, phone.p_device_id, chosen);

    await call(alex, "register_push_device", {
      ...phone,
      p_endpoint: `https://web.push.apple.com/${crypto.randomUUID()}`,
      p_time_zone: "America/New_York",
    });

    expect(await settingsOf(alex, phone.p_device_id)).toEqual(chosen);
    expect((await devicesOf(alex))[0]?.time_zone).toBe("America/New_York");
  });

  it("NT-b S5 Fremde Geräte: nicht änderbar, nicht lesbar, ohne Anmeldung nichts, direktes Schreiben gesperrt", async () => {
    const [alex, robin] = [await signedIn(), await signedIn()];
    const alexsPhone = device();
    await call(alex, "register_push_device", alexsPhone);
    await call(robin, "register_push_device", device());
    const mine = { ...DEFAULT_PUSH_SETTINGS, dailyEnabled: false, dailyDays: 0 };
    await save(alex, alexsPhone.p_device_id, mine);

    expect(
      await failure(save(robin, alexsPhone.p_device_id, { ...DEFAULT_PUSH_SETTINGS })),
    ).toContain("push_device_unknown");
    expect(await settingsOf(robin, alexsPhone.p_device_id)).toBeNull();
    expect(
      await failure(
        call(anonymous(), "update_push_settings", {
          p_device_id: alexsPhone.p_device_id,
          ...settingsArguments(DEFAULT_PUSH_SETTINGS),
        }),
      ),
    ).toMatch(/permission denied/);
    const direct = await alex.client
      .from("push_devices")
      .update({ daily_days: 1 })
      .eq("device_id", alexsPhone.p_device_id);
    expect(direct.error?.message).toMatch(/permission denied/);
    expect(await settingsOf(alex, alexsPhone.p_device_id)).toEqual(mine);
  });

  it("NT-b Ausschalten löscht das Gerät mit seinen Einstellungen; danach gibt es nichts mehr zu ändern", async () => {
    const alex = await signedIn();
    const phone = device();
    await call(alex, "register_push_device", phone);

    await call(alex, "unregister_push_device", { p_device_id: phone.p_device_id });

    expect(await devicesOf(alex)).toEqual([]);
    expect(await settingsOf(alex, phone.p_device_id)).toBeNull();
    expect(await failure(save(alex, phone.p_device_id, DEFAULT_PUSH_SETTINGS))).toContain(
      "push_device_unknown",
    );
  });

  it("NT-b Konto löschen löscht die Geräte mit allen Einstellungen, auch in einem Haushalt zu zweit", async () => {
    const { a, b } = await couple();
    await call(a, "register_push_device", device());
    await call(b, "register_push_device", device());

    await call(a, "delete_account");

    expect(await devicesOf(a)).toEqual([]);
    expect(await devicesOf(b)).toHaveLength(1);
  });

  it("NT-b Entfernt oder verlässt jemand den Haushalt, bekommt er dessen Meldungen nicht mehr; das Gerät bleibt beim Konto", async () => {
    const { a, b, household } = await couple();
    const [phoneA, phoneB] = [device(), device()];
    await call(a, "register_push_device", phoneA);
    await call(b, "register_push_device", phoneB);
    const chosen = { ...DEFAULT_PUSH_SETTINGS, partnerEnabled: false };
    await save(b, phoneB.p_device_id, chosen);

    /** The accounts whose devices notifications about the household may go to. */
    const recipients = async () => {
      const members = await admin
        .from("household_members")
        .select("user_id")
        .eq("household_id", household);
      const ids = (members.data ?? []).map((row) => row.user_id as string);
      const devices = await admin.from("push_devices").select("user_id").in("user_id", ids);
      return (devices.data ?? []).map((row) => row.user_id as string).sort();
    };
    expect(await recipients()).toEqual([a.id, b.id].sort());

    await call(a, "remove_member", { p_role: "personB" });
    expect(await recipients()).toEqual([a.id]);
    // The device belongs to the account: it stays, with what it chose, for a later household.
    expect(await settingsOf(b, phoneB.p_device_id)).toEqual(chosen);

    const invited = await call<{ token: string }>(a, "create_invite");
    await call(b, "accept_invite", { p_token: invited.token });
    expect(await recipients()).toEqual([a.id, b.id].sort());
    await call(b, "leave_household");
    expect(await recipients()).toEqual([a.id]);
    expect(await devicesOf(b)).toHaveLength(1);
  });
});
