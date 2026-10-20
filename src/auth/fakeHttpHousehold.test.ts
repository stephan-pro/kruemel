import { describe, expect, it } from "vitest";
import { FakeStore } from "../storage/storage.fixtures";
import { createFakeHttpRemote } from "../sync/fakeHttpRemote";
import { FakeServer } from "../sync/fakeServer";
import { fetchFrom } from "../sync/fakeServer.fixtures";
import { dataWith, weekly } from "../sync/sync.fixtures";
import { FakeHttpAuth, fakeAuthToken } from "./fakeHttpAuth";
import { FakeHttpHousehold } from "./fakeHttpHousehold";
import type { HouseholdError } from "./household";
import { describeHouseholdContract } from "./household.contract";
import { offlineFetch } from "./supabaseAuth.fixtures";

const BASE = "http://fake.test";
const NAMES = { personA: "Alex", personB: "Robin" };

/** A device whose person has signed in with a code, as in the app. */
async function device(server: FakeServer) {
  const store = new FakeStore();
  const send = fetchFrom(server);
  const email = `person-${crypto.randomUUID()}@example.com`;
  const auth = new FakeHttpAuth({ baseUrl: BASE, store, fetch: send });
  await auth.requestCode(email);
  await auth.verifyCode(email, server.auth.lastCode(email) ?? "");
  return { store, send, household: new FakeHttpHousehold({ baseUrl: BASE, store, fetch: send }) };
}

describeHouseholdContract("FakeHttpHousehold (über den Fake-Server)", async () => {
  let now = 1_000_000;
  const server = new FakeServer({ auth: { now: () => now } });
  return {
    newPerson: async () => (await device(server)).household,
    expireInvites: async () => {
      now += 8 * 24 * 60 * 60_000;
    },
  };
});

describe("Haushalt am Fake-Server", () => {
  it("Nach dem Beitritt arbeiten beide Personen mit ihrer Anmeldung an denselben Daten; fremde Haushalte sehen sie nicht", async () => {
    const server = new FakeServer();
    const [alex, robin, other] = [await device(server), await device(server), await device(server)];
    await alex.household.create(NAMES);
    await robin.household.acceptInvite((await alex.household.createInvite()).token);
    await other.household.create({ personA: "Sam", personB: "Kim" });
    const remote = (who: typeof alex) =>
      createFakeHttpRemote({
        baseUrl: BASE,
        fetch: who.send,
        token: fakeAuthToken(who.store) ?? "",
      });

    await remote(alex).push({
      id: "c1",
      type: "saveTask",
      taskId: "t-bad",
      patch: { set: { ...weekly() }, unset: [] },
      create: weekly(),
    });

    expect((await remote(robin).pull(null)).settings?.personNames).toEqual(NAMES);
    expect((await remote(robin).pull(null)).tasks.map((row) => row.id)).toEqual(["t-bad"]);
    expect((await remote(other).pull(null)).tasks).toEqual([]);
  });

  it("Ohne Anmeldung oder ohne Netz meldet die Schnittstelle den Grund; unlesbare Antworten sind „unbekannt“", async () => {
    const server = new FakeServer();
    const signedOut = new FakeHttpHousehold({
      baseUrl: BASE,
      store: new FakeStore(),
      fetch: fetchFrom(server),
    });
    const withStore = (fetcher: typeof fetch) =>
      new FakeHttpHousehold({ baseUrl: BASE, store: new FakeStore(), fetch: fetcher });
    const failureOf = async (promise: Promise<unknown>) =>
      promise.then(
        () => "kein Fehler",
        (error: HouseholdError) => error.failure,
      );
    const answering = (status: number, body: string) =>
      withStore((async () => new Response(body, { status })) as unknown as typeof fetch);

    expect(await failureOf(signedOut.current())).toBe("notSignedIn");
    expect(await failureOf(withStore(offlineFetch).current())).toBe("offline");
    expect(await failureOf(answering(502, "kaputt").current())).toBe("offline");
    expect(await failureOf(answering(418, "{}").current())).toBe("unknown");
  });

  it("Unbekannte Adressen unter /household antworten 404; /test/household bleibt, was es war", async () => {
    const server = new FakeServer();
    const { send } = await device(server);
    const session = await device(server);
    const token = fakeAuthToken(session.store);

    const unknown = await send(`${BASE}/household/gibtsnicht`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const made = await send(`${BASE}/test/household`, {
      method: "POST",
      body: JSON.stringify({ data: dataWith([weekly()]) }),
    });

    expect(unknown.status).toBe(404);
    expect(made.status).toBe(200);
  });
});
