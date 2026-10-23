import { describe, expect, it } from "vitest";
import { FakeStore } from "../storage/storage.fixtures";
import { FakeServer } from "../sync/fakeServer";
import { fetchFrom } from "../sync/fakeServer.fixtures";
import { AuthError } from "./auth";
import { describeAuthContract } from "./auth.contract";
import { FAKE_AUTH_KEY, FakeHttpAuth } from "./fakeHttpAuth";
import { FakeHttpHousehold } from "./fakeHttpHousehold";
import { offlineFetch } from "./supabaseAuth.fixtures";

const BASE = "http://fake.test";

const newEmail = () => `person-${crypto.randomUUID()}@example.com`;

/** A member of a new household, signed in through the fake server's API. */
async function member(server: FakeServer) {
  const store = new FakeStore();
  const send = fetchFrom(server);
  const email = newEmail();
  server.auth.addUser(email);
  const auth = new FakeHttpAuth({ baseUrl: BASE, store, fetch: send });
  await auth.requestCode(email);
  await auth.verifyCode(email, server.auth.lastCode(email) ?? "");
  const household = new FakeHttpHousehold({ baseUrl: BASE, store, fetch: send });
  await household.create({ personA: "Alex", personB: "Robin" });
  return household;
}

describeAuthContract("FakeHttpAuth (über den Fake-Server)", async () => {
  let now = 1_000_000;
  const server = new FakeServer({ auth: { now: () => now } });
  const store = new FakeStore();
  const email = newEmail();
  server.auth.addUser(email);
  return {
    email,
    newEmail,
    friendInvite: async () => (await (await member(server)).createFriendInvite()).token,
    householdInvite: async () => (await (await member(server)).createInvite()).token,
    mailCount: async (address) => server.auth.mailCount(address),
    open: (options) =>
      new FakeHttpAuth({
        baseUrl: BASE,
        store,
        fetch: options?.offline ? offlineFetch : fetchFrom(server),
      }),
    nextCode: async (email) => server.auth.lastCode(email) ?? "",
    expireCodes: async () => {
      now += 11 * 60_000;
    },
    waitBeforeResend: async () => {
      now += 61_000;
    },
    refuseSessions: async (email) => server.auth.signOutEverywhere(email),
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

describe("FakeHttpAuth und die Anmeldung am Fake-Server", () => {
  it("Der Test liest den Code über /test/code; die Sitzung prüft der Server über ihr Geheimnis", async () => {
    const server = new FakeServer({ auth: { newCode: () => "424242" } });
    const send = fetchFrom(server);
    const auth = new FakeHttpAuth({ baseUrl: BASE, store: new FakeStore(), fetch: send });

    expect((await send(`${BASE}/test/code?email=a@b.de`)).status).toBe(404);
    await send(`${BASE}/test/user`, { method: "POST", body: JSON.stringify({ email: "a@b.de" }) });
    await auth.requestCode("a@b.de");
    expect(await (await send(`${BASE}/test/code?email=a@b.de`)).json()).toEqual({ code: "424242" });
    await auth.verifyCode("a@b.de", "424242");
    expect((await send(`${BASE}/auth/session`)).status).toBe(401);
    expect((await send(`${BASE}/auth/gibtsnicht`)).status).toBe(404);
  });

  it("Unlesbare oder unerwartete Antworten werden zu „offline“ oder „unbekannt“; Kaputtes im Speicher heißt abgemeldet", async () => {
    const answering = (status: number, body: string) =>
      new FakeHttpAuth({
        baseUrl: BASE,
        store: new FakeStore(),
        fetch: (async () => new Response(body, { status })) as unknown as typeof fetch,
      });

    expect(await failureOf(answering(502, "kaputt").requestCode("a@b.de"))).toBe("offline");
    expect(await failureOf(answering(418, "{}").requestCode("a@b.de"))).toBe("unknown");
    expect(await failureOf(answering(200, "{}").verifyCode("a@b.de", "1"))).toBe("unknown");

    const store = new FakeStore();
    const auth = new FakeHttpAuth({ baseUrl: BASE, store, fetch: offlineFetch });
    for (const broken of ["kein JSON", "{}", JSON.stringify({ token: "t", session: {} })]) {
      store.items.set(FAKE_AUTH_KEY, broken);
      expect(await auth.session()).toBeNull();
    }
  });
});
