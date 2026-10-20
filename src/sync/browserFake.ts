// Wires the shared storage to the fake server in the browser. Only for the build mode `e2e`; the
// tests put the secret of a person into the browser storage before the app starts (there is no
// sign-in page before E2-2). Not covered by unit tests: it only connects parts that are.

import type { KeyValueStore } from "../storage/localStorage";
import type { AppStorage } from "../storage/storage";
import { createFakeHttpRemote } from "./fakeHttpRemote";
import { createSyncedStorage, type SyncedStorage } from "./syncedStorage";
import { browserTriggers } from "./triggers";

/** The key a test stores the person's secret under: `{"token": "…"}`. */
export const FAKE_SESSION_KEY = "kruemel-fake:session";

export function createFakeBackendStorage(
  store: KeyValueStore,
  device: Pick<AppStorage, "loadDevice" | "saveDevice">,
): SyncedStorage {
  const text = store.getItem(FAKE_SESSION_KEY);
  const token = text === null ? undefined : (JSON.parse(text) as { token?: string }).token;
  if (token === undefined) {
    throw new Error(`Keine Test-Sitzung: ${FAKE_SESSION_KEY} fehlt im Browser-Speicher.`);
  }
  return createSyncedStorage({
    remote: createFakeHttpRemote({ baseUrl: __FAKE_SERVER__, token }),
    store,
    device,
    triggers: browserTriggers({ window, document }),
  });
}
