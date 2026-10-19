// Fills the demo storage area (`npm run demo`). Existing demo data is kept, so the person trying
// the app can change things and reload; a reset replaces it with fresh example data.

import type { CalendarDay } from "../domain/date";
import type { AppData } from "../storage/appData";
import { type AppStorage, StorageError } from "../storage/storage";
import { DEMO_DEVICE, demoData } from "./demoData";

export interface SeedOptions {
  /** Replace whatever is stored with fresh example data. */
  readonly reset?: boolean;
}

function isEmpty(data: AppData): boolean {
  return data.tasks.length === 0 && data.settings.personNames === undefined;
}

/** Makes sure the storage holds example data and returns what is stored afterwards. */
export async function seedDemo(
  storage: AppStorage,
  today: CalendarDay,
  options: SeedOptions = {},
): Promise<AppData> {
  if (!options.reset) {
    try {
      const existing = await storage.load();
      if (!isEmpty(existing)) {
        return existing;
      }
    } catch (error) {
      // Unreadable demo data is worthless; real data is never handled here.
      if (!(error instanceof StorageError)) {
        throw error;
      }
    }
  }
  const data = demoData(today);
  await storage.save(data);
  await storage.saveDevice(DEMO_DEVICE);
  return data;
}
