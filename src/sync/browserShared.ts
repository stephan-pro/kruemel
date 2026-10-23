// Wires the shared storage of a signed-in member to the browser (modes `fake` and `supabase`,
// E2-3b). Not covered by unit tests: it only connects parts that are.
//
// Each account (household and person) keeps its copy and its outbox under a key of its own. So a
// second person who signs in on the same device never sees, and never sends, the first one's
// changes; those wait for the first person's next sign-in (unless they signed out, which deletes
// them after a warning). The data of stage 1 (`putzplan:data`) are not touched.

import type { KeyValueStore } from "../storage/localStorage";
import type { AppStorage } from "../storage/storage";
import type { Remote } from "./remote";
import { createSyncedStorage, type SyncedStorage } from "./syncedStorage";
import { browserTriggers } from "./triggers";

export interface SharedAccount {
  readonly householdId: string;
  readonly userId: string;
}

/** The prefix of the key the account's copy is kept under (`<prefix>:sync`). */
export function sharedNamespace(account: SharedAccount): string {
  return `kruemel:${account.householdId}:${account.userId}`;
}

export function createBrowserSharedStorage(
  remote: Remote,
  store: KeyValueStore,
  device: Pick<AppStorage, "loadDevice" | "saveDevice">,
  account: SharedAccount,
): SyncedStorage {
  return createSyncedStorage({
    remote,
    store,
    device,
    namespace: sharedNamespace(account),
    triggers: browserTriggers({ window, document }),
  });
}
