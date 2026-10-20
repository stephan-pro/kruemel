import { describe, expect, it } from "vitest";
import { createFakeHttpRemote } from "./fakeHttpRemote";
import { FakeServer } from "./fakeServer";
import { RemoteError } from "./remote";
import { describeRemoteContract } from "./remote.contract";
import { dataWith, weekly } from "./sync.fixtures";

/** `fetch` that answers from the fake server directly, the way the HTTP wrapper would. */
function fetchFrom(server: FakeServer): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const authorization = (init?.headers as Record<string, string> | undefined)?.Authorization;
    const answer = server.handle({
      method: init?.method ?? "GET",
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      token: authorization?.replace(/^Bearer /, ""),
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    });
    return new Response(JSON.stringify(answer.body), { status: answer.status });
  }) as typeof fetch;
}

/** An `EventSource` whose "change" events come from the household behind the token in the URL. */
function eventSourceFrom(server: FakeServer) {
  return (url: string) => {
    const token = new URL(url).searchParams.get("token") ?? undefined;
    const listeners: (() => void)[] = [];
    const stop = server.householdFor(token)?.subscribe(() => {
      for (const listener of listeners) {
        listener();
      }
    });
    return {
      addEventListener: (_type: string, listener: () => void) => {
        listeners.push(listener);
      },
      close: () => stop?.(),
    };
  };
}

const BASE = "http://fake.test";

describeRemoteContract("FakeHttpRemote (über den Fake-Server)", async () => {
  const server = new FakeServer();
  const { tokens } = server.createHousehold();
  const options = { baseUrl: BASE, fetch: fetchFrom(server), eventSource: eventSourceFrom(server) };
  return {
    a: createFakeHttpRemote({ ...options, token: tokens.personA }),
    b: createFakeHttpRemote({ ...options, token: tokens.personB }),
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

  it("Ein Senden ohne Änderung wird abgelehnt (400), eine unbekannte Adresse nicht gefunden (404)", () => {
    const server = new FakeServer();
    const { tokens } = server.createHousehold();

    expect(
      server.handle(request({ method: "POST", path: "/push", token: tokens.personA, body: 5 }))
        .status,
    ).toBe(400);
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
