// Start-up of the demo mode (`npm run demo`): opens the demo storage area and makes sure it
// holds example data. Only reached from `main.tsx` when the app is built in mode "demo".

import { dayFromDate } from "../domain/date";
import { createLocalStorage, type KeyValueStore } from "../storage/localStorage";
import { DEMO_NAMESPACE } from "./demoData";
import { seedDemo } from "./seed";

/** What the page shows about the demo. */
export interface DemoInfo {
  readonly taskCount: number;
  readonly completionCount: number;
  /** True if this start replaced the stored data with fresh example data. */
  readonly wasReset: boolean;
}

/** The address parameter that asks for fresh example data: `?demo=neu`. */
export function wantsReset(search: string): boolean {
  return new URLSearchParams(search).get("demo") === "neu";
}

export async function startDemo(
  store: KeyValueStore,
  search: string,
  now: Date = new Date(),
): Promise<DemoInfo> {
  const storage = createLocalStorage({ store, namespace: DEMO_NAMESPACE });
  const reset = wantsReset(search);
  const data = await seedDemo(storage, dayFromDate(now), { reset });
  return {
    taskCount: data.tasks.length,
    completionCount: data.completions.length,
    wasReset: reset,
  };
}
