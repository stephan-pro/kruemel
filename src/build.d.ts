/** When and from which commit this build was made; `define` in vite.config.ts fills it in. */
declare const __APP_BUILD__: { readonly time: string; readonly commit: string | null };

/** Which storage this build uses (`src/backend.ts`); `define` in vite.config.ts fills it in. */
declare const __BACKEND__: "supabase" | "fake" | "local";

/** Address of the fake server in the mode `e2e`, e.g. "http://localhost:4180". */
declare const __FAKE_SERVER__: string;
