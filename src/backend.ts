// Which storage the app runs on (stage 2):
//
// - `local`: the browser's localStorage, no sign-in. `npm run demo`, the tests of stage 1 and the
//   way back for the online version (workflow `pages` with `VITE_BACKEND=local`).
// - `fake`: the shared storage against the fake server of the end-to-end tests (build mode `e2e`).
// - `supabase`: the real shared storage; the online version since E2-3f.
//
// Chosen at build time: the build setting `VITE_BACKEND` decides, and without it the build mode
// (`demo` → local, `e2e` → fake, everything else → local). `vite.config.ts` turns the choice into
// the constant `__BACKEND__`, so the code of the other modes is not part of the build.

export type BackendMode = "supabase" | "fake" | "local";

export const BACKEND_MODES: readonly BackendMode[] = ["supabase", "fake", "local"];

/** The storage for a build mode and the value of `VITE_BACKEND` (unset or empty = by build mode). */
export function backendMode(buildMode: string, setting: string | undefined): BackendMode {
  const chosen = setting?.trim();
  if (chosen !== undefined && chosen !== "") {
    if (BACKEND_MODES.includes(chosen as BackendMode)) {
      return chosen as BackendMode;
    }
    throw new Error(
      `VITE_BACKEND=${chosen} ist unbekannt. Erlaubt: ${BACKEND_MODES.join(", ")} (oder leer).`,
    );
  }
  return buildMode === "e2e" ? "fake" : "local";
}

/**
 * Stops a `supabase` build without the project's public key (the app could not sign in) or with
 * another kind of key: only the publishable key may go into the app, never the secret one.
 */
export function checkPublishableKey(key: string | undefined): void {
  const value = key?.trim() ?? "";
  if (value === "") {
    throw new Error(
      "VITE_SUPABASE_PUBLISHABLE_KEY fehlt (öffentlicher Schlüssel des Supabase-Projekts, siehe .env.example).",
    );
  }
  if (!value.startsWith("sb_publishable_")) {
    throw new Error(
      "VITE_SUPABASE_PUBLISHABLE_KEY muss der Publishable Key sein (sb_publishable_…), nie der Secret Key.",
    );
  }
}
