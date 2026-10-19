// One-time setup of a fresh download: installs the packages and the Playwright browsers.
// Run it with `npm run setup`; running it again is harmless.
import { spawnSync } from "node:child_process";

const steps = [
  { name: "Pakete installieren", cmd: "npm install" },
  {
    name: "Browser für die End-to-End-Tests installieren",
    cmd: "npx playwright install chromium webkit",
  },
];

for (const [index, step] of steps.entries()) {
  console.log(`\n▶ Schritt ${index + 1}/${steps.length}: ${step.name}\n  $ ${step.cmd}\n`);
  const result = spawnSync(step.cmd, { stdio: "inherit", shell: true });
  if (result.status !== 0) {
    console.error(`\n❌ Einrichtung fehlgeschlagen in Schritt ${index + 1}: ${step.name}\n`);
    process.exit(1);
  }
}

console.log("\n✅ Einrichtung abgeschlossen – jetzt `npm run check` ausführen\n");
