// Where the shared-storage tests find things (stage 2). The ports are set in
// `playwright.config.ts`; the app and the fake server are built by `npm run build:e2e`.

/** The fake server (`scripts/fake-server.ts`): households, push, pull, server-sent events. */
export const FAKE_SERVER = "http://localhost:4180";

/** The app in the mode `e2e`: the shared storage against the fake server, no sign-in yet. */
export const E2E_APP = "http://localhost:4175/putzplan/";

/** Where the app looks for the secret of the person who uses this device. */
export const FAKE_SESSION_KEY = "kruemel-fake:session";
