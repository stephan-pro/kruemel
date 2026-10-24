import { describe, expect, it } from "vitest";
import { ALLOWED_ENDPOINTS, REFUSED_ENDPOINTS } from "../functions/push/rules.cases";
import { admin, anonymous, call, type Person, signedIn, withHousehold } from "./setup";

// NT-a: the push addresses of the devices (`push_devices`) and the limits of the test
// notification (`request_test_push`, called by the Edge Function `push` with the person's
// sign-in). The Edge Function itself is tested with a mock push service in `check`
// (supabase/functions/push/core.test.ts).

const KEY_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Random base64url text of the given length (like the keys of a browser's push address). */
function randomKey(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => KEY_CHARS[byte % 64]).join("");
}

/** What a device sends to switch on (`register_push_device`), with a fresh address. */
function device(overrides: Record<string, unknown> = {}) {
  return {
    p_device_id: crypto.randomUUID(),
    p_endpoint: `https://fcm.googleapis.com/fcm/send/${crypto.randomUUID()}`,
    p_p256dh: `B${randomKey(86)}`,
    p_auth: randomKey(22),
    p_key_id: "schluessel-1",
    p_time_zone: "Europe/Berlin",
    p_locale: "de",
    ...overrides,
  };
}

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
