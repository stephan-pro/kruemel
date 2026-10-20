// Which storage the app runs on (stage 2):
//
// - `local`: the browser's localStorage, no sign-in. The online version until the end of E2-3,
//   `npm run demo` and the tests of stage 1.
// - `fake`: the shared storage against the fake server of the end-to-end tests (build mode `e2e`).
// - `supabase`: the real shared storage (from E2-1/E2-3).
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
