import { defineConfig, devices } from "@playwright/test";

// Minimal Node typing instead of @types/node (N7: avoid a dependency for one line).
declare const process: { env: Record<string, string | undefined> };

const port = 4173;
const demoPort = 4174;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}/putzplan/`,
    locale: "de-DE",
    trace: "on-first-retry",
  },
  // Runs against the production build; `npm run check` builds before this step.
  webServer: [
    {
      command: `npx vite preview --port ${port} --strictPort`,
      url: `http://localhost:${port}/putzplan/`,
      reuseExistingServer: !process.env.CI,
    },
    {
      // The same server as `npm run demo` (without opening a browser window).
      command: `npx vite --mode demo --port ${demoPort} --strictPort`,
      url: `http://localhost:${demoPort}/putzplan/`,
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "chromium-mobile", use: { ...devices["Pixel 7"] } },
    { name: "webkit-desktop", use: { ...devices["Desktop Safari"] } },
    { name: "webkit-mobile", use: { ...devices["iPhone 15"] } },
  ],
});
