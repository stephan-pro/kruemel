// Runs every quality step in order and stops at the first failure (Q1).
// Locally Biome fixes formatting; in CI (env CI set) it only checks.
import { spawnSync } from "node:child_process";

const isCi = Boolean(process.env.CI);

const steps = [
  {
    name: "Formatierung und Linting (Biome)",
    cmd: isCi ? "biome ci ." : "biome check --write .",
  },
  { name: "Typprüfung (TypeScript)", cmd: "tsc --noEmit" },
  { name: "Unit-Tests mit Abdeckung (Vitest)", cmd: "vitest run --coverage" },
  { name: "Build (Vite)", cmd: "vite build" },
  { name: "End-to-End-Tests mit axe (Playwright)", cmd: "playwright test" },
];

for (const [index, step] of steps.entries()) {
  const label = `Schritt ${index + 1}/${steps.length}: ${step.name}`;
  console.log(`\n▶ ${label}\n  $ ${step.cmd}\n`);
  const result = spawnSync(`npx ${step.cmd}`, { stdio: "inherit", shell: true });
  if (result.status !== 0) {
    console.error(`\n❌ nicht bestanden in ${label}\n`);
    process.exit(1);
  }
}

console.log("\n✅ bestanden – alle Prüfungen sind grün\n");
