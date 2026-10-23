// `Remote` for the fake server of the end-to-end tests (`scripts/fake-server.ts`): the three calls
// over HTTP and the hints as server-sent events. This is what the app runs on in the mode `e2e`,
// so a real browser can play through two devices, offline work and parallel ticking off.

import { SCHEMA_VERSION } from "../storage/appData";
import type { Change, PushResult } from "./changes";
import { type PullResult, type Remote, RemoteError } from "./remote";

/** The part of the browser's `EventSource` that is used. */
export interface EventSourceLike {
  addEventListener(type: string, listener: () => void): void;
  close(): void;
}

export interface FakeHttpRemoteOptions {
  /** e.g. "http://localhost:4180" */
  readonly baseUrl: string;
  /** The secret of the person (`/test/household` hands it out). */
  readonly token: string;
  /** Default: the browser's `fetch`. */
  readonly fetch?: typeof fetch;
  /** Default: the browser's `EventSource`. */
  readonly eventSource?: (url: string) => EventSourceLike;
  /** The app's `schemaVersion`; default `SCHEMA_VERSION` (tests play other versions). */
  readonly schemaVersion?: number;
}

export function createFakeHttpRemote(options: FakeHttpRemoteOptions): Remote {
  const { baseUrl, token } = options;
  const send = options.fetch ?? ((input, init) => fetch(input, init));
  const open = options.eventSource ?? ((url: string) => new EventSource(url));

  async function call<T>(path: string, init: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await send(`${baseUrl}${path}`, {
        ...init,
        headers: { ...init.headers, Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      throw new RemoteError(`Keine Verbindung zum Server: ${String(error)}`);
    }
    if (!response.ok) {
      throw new RemoteError(`Der Server antwortet mit ${response.status}.`);
    }
    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new RemoteError(`Unlesbare Antwort des Servers: ${String(error)}`);
    }
  }

  return {
    pull: (cursor) =>
      call<PullResult>(cursor === null ? "/pull" : `/pull?cursor=${encodeURIComponent(cursor)}`, {
        method: "GET",
      }),

    push: (change: Change) =>
      call<PushResult>(`/push?schemaVersion=${options.schemaVersion ?? SCHEMA_VERSION}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(change),
      }),

    subscribe(hint: () => void): () => void {
      const source = open(`${baseUrl}/events?token=${encodeURIComponent(token)}`);
      source.addEventListener("change", hint);
      return () => source.close();
    },
  };
}
