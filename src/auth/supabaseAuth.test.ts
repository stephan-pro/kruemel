import { describe, expect, it } from "vitest";
import { FakeStore } from "../storage/storage.fixtures";
import { AuthError } from "./auth";
import { describeAuthContract } from "./auth.contract";
import { CODE_REQUEST_KEY, SupabaseAuth } from "./supabaseAuth";
import {
  expireAccessToken,
  FAKE_SUPABASE_URL,
  fakeGoTrue,
  offlineFetch,
  serviceError,
} from "./supabaseAuth.fixtures";
import { createSupabaseClient, SESSION_KEY } from "./supabaseClient";

function device(send: typeof fetch, store = new FakeStore(), now?: () => number) {
  const client = createSupabaseClient({
    url: FAKE_SUPABASE_URL,
    publishableKey: "sb_publishable_test",
    store,
    fetch: send,
  });
  return new SupabaseAuth({ client, store, ...(now === undefined ? {} : { now }) });
}

describeAuthContract("SupabaseAuth (Nachbau des Anmeldedienstes)", async () => {
  let now = Date.now();
  const service = fakeGoTrue({ now: () => now });
  const store = new FakeStore();
  return {
    email: `person-${crypto.randomUUID()}@example.com`,
    open: (options) => device(options?.offline ? offlineFetch : service.fetch, store, () => now),
    nextCode: async (email) => service.lastCode(email) ?? "",
    expireCodes: async () => {
      now += 11 * 60_000;
    },
    waitBeforeResend: async () => {
      now += 61_000;
    },
    refuseSessions: async (email) => {
      service.refuseSessions(email);
      expireAccessToken(store);
    },
  };
});

async function failureOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AuthError);
    return (error as AuthError).failure;
  }
  throw new Error("Sollte scheitern");
}

/** A service that answers every request with the given response. */
const answering = (response: () => Response) => (async () => response()) as unknown as typeof fetch;

describe("SupabaseAuth: Fehler des Dienstes werden zu AuthFailure", () => {
  it("Zu viele Versuche, gesperrte Neuanmeldung, Dienst gestört und Unbekanntes haben eigene Meldungen", async () => {
    const cases: [Response, string, string][] = [
      [serviceError(429, "over_request_rate_limit"), "verify", "tooManyTries"],
      [serviceError(429, "irgendwas"), "request", "tooManyTries"],
      [serviceError(422, "signup_disabled"), "request", "notAllowed"],
      [serviceError(403, "email_address_not_authorized"), "request", "notAllowed"],
      [serviceError(400, "email_address_invalid"), "request", "invalidEmail"],
      [serviceError(400, "validation_failed"), "verify", "wrongCode"],
      [serviceError(503, "unavailable"), "request", "offline"],
      [serviceError(400, "bad_json"), "verify", "unknown"],
      [new Response("kein JSON", { status: 400 }), "request", "unknown"],
    ];
    for (const [response, step, failure] of cases) {
      const auth = device(answering(() => response.clone()));
      const action =
        step === "request" ? auth.requestCode("a@b.de") : auth.verifyCode("a@b.de", "123456");

      expect([step, response.status, await failureOf(action)]).toEqual([
        step,
        response.status,
        failure,
      ]);
    }
  });

  it("Falsch oder abgelaufen entscheidet das Gerät nach dem Zeitpunkt seiner Anforderung, auch nach dem Neuladen", async () => {
    let now = 0;
    const service = fakeGoTrue({ now: () => now });
    const store = new FakeStore();
    await device(service.fetch, store, () => now).requestCode("a@b.de");

    now += 9 * 60_000;
    expect(await failureOf(device(service.fetch, store, () => now).verifyCode("a@b.de", "1"))).toBe(
      "wrongCode",
    );
    expect(await failureOf(device(service.fetch, store, () => now).verifyCode("c@d.de", "1"))).toBe(
      "expiredCode",
    );
    store.items.set(CODE_REQUEST_KEY, "kaputt");
    expect(await failureOf(device(service.fetch, store, () => now).verifyCode("a@b.de", "1"))).toBe(
      "expiredCode",
    );
  });

  it("Ohne nutzbaren Gerätespeicher klappt die Anmeldung trotzdem; eine kaputte gemerkte Sitzung zählt als abgemeldet", async () => {
    const service = fakeGoTrue();
    const store = new FakeStore();
    const auth = device(service.fetch, store);
    await auth.requestCode("a@b.de");
    const code = service.lastCode("a@b.de") ?? "";
    // supabase-js keeps its session in memory as well; only our own notes fail to be written.
    const original = store.setItem.bind(store);
    store.setItem = (key, value) => {
      if (key === CODE_REQUEST_KEY) throw new Error("voll");
      original(key, value);
    };
    store.removeItem = () => {
      throw new Error("gesperrt");
    };

    expect((await auth.verifyCode("a@b.de", code)).email).toBe("a@b.de");
    await expect(auth.requestCode("e@f.de")).resolves.toBeUndefined();

    for (const broken of ["kein JSON", "{}", JSON.stringify({ refresh_token: "r", user: {} })]) {
      store.items.set(SESSION_KEY, broken);
      expect(await auth.session()).toBeNull();
    }
    store.items.set(SESSION_KEY, JSON.stringify({ refresh_token: "r", user: { id: "u-1" } }));
    expect(await auth.session()).toEqual({ userId: "u-1", email: "" });
  });

  it("Antwortet der Dienst ohne Benutzer, ist das ein unbekannter Fehler", async () => {
    const auth = device(answering(() => new Response(JSON.stringify({}), { status: 200 })));

    expect(await failureOf(auth.verifyCode("a@b.de", "123456"))).toBe("unknown");
  });
});
