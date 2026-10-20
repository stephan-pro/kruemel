import { defineConfig } from "vitest/config";

// The database tests of `npm run check:db` (stage 2): against the local Supabase instance, which
// `scripts/check-db.mjs` starts and whose addresses and keys it passes in. Not part of
// `npm run check` (that one needs neither Docker nor a network).
export default defineConfig({
  test: {
    include: ["supabase/tests/**/*.test.ts"],
    // One database for all files: one after the other keeps the logs readable.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
