import { describe, expect, it } from "vitest";
import { createFakeHttpRemote } from "./fakeHttpRemote";
import { FakeServer } from "./fakeServer";
import { eventSourceFrom, fetchFrom } from "./fakeServer.fixtures";
import { RemoteError } from "./remote";
import { describeRemoteContract } from "./remote.contract";
import { dataWith, weekly } from "./sync.fixtures";

const BASE = "http://fake.test";

describeRemoteContract("FakeHttpRemote (über den Fake-Server)", async () => {
  const server = new FakeServer();
  const { tokens } = server.createHousehold();
  const options = { baseUrl: BASE, fetch: fetchFrom(server), eventSource: eventSourceFrom(server) };
  return {
    a: createFakeHttpRemote({ ...options, token: tokens.personA }),
    b: createFakeHttpRemote({ ...options, token: tokens.personB }),
    device: (person, schemaVersion) =>
      createFakeHttpRemote({
        ...options,
        token: person === "a" ? tokens.personA : tokens.personB,
        schemaVersion,
      }),
  };
});

describe("Fake-Server (Test-Hilfe)", () => {
  const request = (overrides: object) => ({
    method: "GET",
    path: "/pull",
    query: {},
    token: undefined,
    body: undefined,
    ...overrides,
  });

  it("Ein Test legt einen Haushalt mit zwei Geheimnissen an, auch mit Daten", () => {
    const server = new FakeServer();
    const data = dataWith([weekly()]);

    const created = server.handle(
      request({ method: "POST", path: "/test/household", body: { data } }),
    );
    const { tokens } = created.body as { tokens: { personA: string; personB: string } };

    expect(created.status).toBe(200);
    expect(tokens.personA).not.toBe(tokens.personB);
    const seen = server.handle(request({ path: "/test/data", token: tokens.personB }));
    expect(seen.body).toEqual(data);
  });

  it("Zwei Haushalte sehen die Daten des anderen nicht", () => {
    const server = new FakeServer();
    const one = server.createHousehold(dataWith([weekly()]));
    const two = server.createHousehold();

    const pulled = (token: string) =>
      (server.handle(request({ token })).body as { tasks: unknown[] }).tasks.length;

    expect(pulled(one.tokens.personA)).toBe(1);
    expect(pulled(two.tokens.personA)).toBe(0);
  });

  it("Ohne bekanntes Geheimnis ist nichts lesbar (401)", () => {
    const server = new FakeServer();

    expect(server.handle(request({})).status).toBe(401);
    expect(server.handle(request({ token: "geraten" })).status).toBe(401);
    expect(server.householdFor(undefined)).toBeUndefined();
  });

  it("Ein Senden ohne Änderung oder mit unlesbarer Version wird abgelehnt (400), eine unbekannte Adresse nicht gefunden (404)", () => {
    const server = new FakeServer();
    const { tokens } = server.createHousehold();
    const push = (body: unknown, query = {}) =>
      server.handle(request({ method: "POST", path: "/push", token: tokens.personA, body, query }))
        .status;

    expect(push(5)).toBe(400);
    expect(push({ id: "x", type: "deleteTask", taskId: "t" }, { schemaVersion: "neu" })).toBe(400);
    expect(server.handle(request({ path: "/gibtsnicht", token: tokens.personA })).status).toBe(404);
  });

  it("Der HTTP-Zugang meldet fehlende Verbindung, Fehlerantworten und Unlesbares als RemoteError", async () => {
    const options = { baseUrl: BASE, token: "t", eventSource: eventSourceFrom(new FakeServer()) };

    const offline = createFakeHttpRemote({
      ...options,
      fetch: (async () => {
        throw new TypeError("Failed to fetch");
      }) as unknown as typeof fetch,
    });
    const refused = createFakeHttpRemote({
      ...options,
      fetch: (async () => new Response("{}", { status: 401 })) as unknown as typeof fetch,
    });
    const garbled = createFakeHttpRemote({
      ...options,
      fetch: (async () => new Response("kein JSON", { status: 200 })) as unknown as typeof fetch,
    });

    await expect(offline.pull(null)).rejects.toBeInstanceOf(RemoteError);
    await expect(refused.pull("3")).rejects.toThrow("401");
    await expect(garbled.push({ id: "x", type: "deleteTask", taskId: "t" })).rejects.toThrow(
      "Unlesbare Antwort",
    );
  });

  it("Der HTTP-Zugang schickt den Stand des letzten Abrufs mit", async () => {
    const urls: string[] = [];
    const remote = createFakeHttpRemote({
      baseUrl: BASE,
      token: "t",
      eventSource: eventSourceFrom(new FakeServer()),
      fetch: (async (input: RequestInfo | URL) => {
        urls.push(String(input));
        return new Response(JSON.stringify({ cursor: "1", tasks: [], completions: [] }));
      }) as unknown as typeof fetch,
    });

    await remote.pull(null);
    await remote.pull("12");

    expect(urls).toEqual([`${BASE}/pull`, `${BASE}/pull?cursor=12`]);
  });
});
