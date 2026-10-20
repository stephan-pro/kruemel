// Test building blocks: the fake server reached the way the browser would reach it over HTTP, but
// in the same process (not part of the app, excluded from coverage).

import type { FakeServer } from "./fakeServer";

/** `fetch` that answers from the fake server directly, the way the HTTP wrapper would. */
export function fetchFrom(server: FakeServer): typeof fetch {
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
export function eventSourceFrom(server: FakeServer) {
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
