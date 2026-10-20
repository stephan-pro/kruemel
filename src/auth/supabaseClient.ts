// The one supabase-js client of the app (mode `supabase`): sign-in now (`SupabaseAuth`), the
// database from E2-3. supabase-js keeps, renews and ends the session itself (S1, S4); we only say
// where on the device it is kept, so `SupabaseAuth` can read it there without network.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { KeyValueStore } from "../storage/localStorage";

/** Where supabase-js keeps the session in the device's storage. */
export const SESSION_KEY = "kruemel:auth";

export interface SupabaseClientOptions {
  /** `VITE_SUPABASE_URL` */
  readonly url: string;
  /** `VITE_SUPABASE_PUBLISHABLE_KEY` (public) */
  readonly publishableKey: string;
  /** The device's storage (the browser's localStorage). */
  readonly store: KeyValueStore;
  /** Default: the browser's `fetch`. For tests (no network, or a stand-in for the service). */
  readonly fetch?: typeof fetch;
}

export function createSupabaseClient(options: SupabaseClientOptions): SupabaseClient {
  return createClient(options.url, options.publishableKey, {
    auth: {
      storage: options.store,
      storageKey: SESSION_KEY,
      persistSession: true,
      autoRefreshToken: true,
      // Sign-in is with a code typed into the app, never with a link back to the page.
      detectSessionInUrl: false,
      flowType: "implicit",
    },
    ...(options.fetch === undefined ? {} : { global: { fetch: options.fetch } }),
  });
}
