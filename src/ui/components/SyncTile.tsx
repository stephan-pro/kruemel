import type { SyncStatus } from "../../storage/storage";
import { SYNC_TEXTS } from "../householdTexts";
import { waitingText } from "./SyncNotices";

interface SyncTileProps {
  readonly status: SyncStatus;
  /** How many changes the server refused for good (the hint above the page has the actions). */
  readonly rejected: number;
}

/** What the line of the tile says now. */
function statusText(status: SyncStatus): string {
  switch (status.state) {
    case "synced":
      return SYNC_TEXTS.allSent;
    case "syncing":
      return SYNC_TEXTS.sending;
    case "offline":
      return waitingText(status) ?? SYNC_TEXTS.offline;
    case "unreachable":
      return waitingText(status) ?? SYNC_TEXTS.unreachable;
  }
}

/** "Übertragung" in the settings (E2-3c): where the shared data stand, always shown. */
export function SyncTile({ status, rejected }: SyncTileProps) {
  return (
    <section class="tile tile--narrow" aria-labelledby="uebertragung">
      <h2 class="tile__title" id="uebertragung">
        {SYNC_TEXTS.tileTitle}
      </h2>
      <p class="muted">{SYNC_TEXTS.tileIntro}</p>
      <p class="sync-status">{statusText(status)}</p>
      {rejected > 0 && <p class="sync-status">{SYNC_TEXTS.rejectedTile(rejected)}</p>}
    </section>
  );
}
