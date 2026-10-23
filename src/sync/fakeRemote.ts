// `Remote` on top of `FakeHousehold`, in memory: what the unit tests of the sync talk to. The
// connection can be cut (`online = false`) to play through offline work, and the answer to a
// change can be lost (`loseNextAnswer`), the way a bad connection does it: the server got the
// change, the device does not know.

import { SCHEMA_VERSION } from "../storage/appData";
import type { Change, PushResult } from "./changes";
import type { FakeHousehold } from "./fakeHousehold";
import { type PullResult, type Remote, RemoteError } from "./remote";

export class FakeRemote implements Remote {
  /** When false, every call fails with a `RemoteError`, as without a connection. */
  online = true;
  /** The `schemaVersion` of the app on this device (a test can play an older or newer one). */
  schemaVersion: number = SCHEMA_VERSION;
  /** The next `push` reaches the server, but its answer is lost (`RemoteError`). */
  loseNextAnswer = false;
  /** The next `push` is refused for good (`RemoteError` with `permanent`), e.g. invalid data. */
  refuseNext = false;
  /** The person no longer belongs to the household (E2-5a): every call fails with `notMember`. */
  removed = false;
  /** Every change handed over, also those that were lost on the way back. */
  readonly pushed: Change[] = [];

  constructor(readonly household: FakeHousehold) {}

  async pull(cursor: string | null): Promise<PullResult> {
    this.requireOnline();
    return this.household.pull(cursor);
  }

  async push(change: Change): Promise<PushResult> {
    this.requireOnline();
    this.pushed.push(change);
    if (this.refuseNext) {
      this.refuseNext = false;
      throw new RemoteError("Die Änderung ist ungültig.", true);
    }
    const result = this.household.push(change, this.schemaVersion);
    if (this.loseNextAnswer) {
      this.loseNextAnswer = false;
      throw new RemoteError("Die Antwort des Servers ist nicht angekommen.");
    }
    return result;
  }

  subscribe(hint: () => void): () => void {
    return this.household.subscribe(() => {
      if (this.online) {
        hint();
      }
    });
  }

  private requireOnline(): void {
    if (!this.online) {
      throw new RemoteError("Keine Verbindung zum Server.");
    }
    if (this.removed) {
      throw new RemoteError("Kein Mitglied des Haushalts.", true, true);
    }
  }
}
