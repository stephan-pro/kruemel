// Runs every quality step in order and stops at the first failure (Q1).
// Silent on success: one summary line. On failure: only what failed (file, line, message).
// `node scripts/check.mjs`        – Biome, tsc, unit tests, builds, E2E in Chromium / desktop.
// `node scripts/check.mjs --full` – the same, E2E in the full matrix (`npm run check:full`).
// Purely checking: Biome never rewrites files here (`npm run fix` does that).
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { stripVTControlCharacters } from "node:util";
import { chromium, webkit } from "@playwright/test";

const full = process.argv.includes("--full");
const MAX_FAILURE_LINES = 40;
const started = Date.now();

// The end-to-end tests need the browsers; fail early with the fix instead of after minutes of work.
const needed = full ? [chromium, webkit] : [chromium];
const missingBrowsers = needed.filter((type) => !existsSync(type.executablePath()));
if (missingBrowsers.length > 0) {
  const names = missingBrowsers.map((type) => type.name()).join(", ");
  console.error(
    `\n❌ Playwright-Browser fehlen (${names}). Bitte einmal \`npm run setup\` ausführen.\n`,
  );
  process.exit(1);
}

mkdirSync("test-results", { recursive: true });
const unitReport = "test-results/unit.json";

/** Runs a command with its output captured; returns the output without colour codes. */
function run(cmd, env = {}) {
  const result = spawnSync(`npx ${cmd}`, {
    shell: true,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1", ...env },
  });
  const output = stripVTControlCharacters(`${result.stdout ?? ""}${result.stderr ?? ""}`);
  return { ok: result.status === 0, output };
}

function fail(step, details) {
  console.error(`❌ ${step}\n${details.trim()}`);
  process.exit(1);
}

/** The end of a tool's output, enough to see the errors. */
function tail(output) {
  return output.trim().split("\n").slice(-MAX_FAILURE_LINES).join("\n");
}

/** Failed unit tests as "file:line  title – message", read from the JSON report. */
function unitFailures() {
  try {
    const report = JSON.parse(readFileSync(unitReport, "utf8"));
    const lines = [];
    for (const file of report.testResults) {
      const name = file.name.replace(/\\/g, "/").replace(/^.*\/(src\/)/, "$1");
      for (const test of file.assertionResults.filter((entry) => entry.status === "failed")) {
        const line = test.location?.line ? `:${test.location.line}` : "";
        const message = stripVTControlCharacters(test.failureMessages?.[0] ?? "").split("\n")[0];
        lines.push(`✖ ${name}${line}  ${test.fullName}\n    ${message}`);
      }
    }
    return lines.slice(0, MAX_FAILURE_LINES).join("\n");
  } catch {
    return "";
  }
}

// 1. Biome
const lint = run("biome check .");
if (!lint.ok) {
  fail("Formatierung und Linting (Biome; Korrektur mit `npm run fix`)", tail(lint.output));
}

// 2. TypeScript
const types = run("tsc --noEmit");
if (!types.ok) fail("Typprüfung (TypeScript)", tail(types.output));

// 3. Unit tests with coverage (json report for the count and the failures)
const unit = run(
  `vitest run --coverage --coverage.reporter=text-summary --reporter=json --outputFile.json=${unitReport}`,
);
if (!unit.ok) {
  const failures = unitFailures();
  const coverage = unit.output
    .split("\n")
    .filter((line) => /does not meet|Coverage for/.test(line))
    .join("\n");
  fail("Unit-Tests (Vitest)", failures || coverage || tail(unit.output));
}
const unitCount = JSON.parse(readFileSync(unitReport, "utf8")).numPassedTests;

// 4. Builds (app, app in mode e2e for the fake server, fake server)
for (const [name, cmd] of [
  ["Build (Vite)", "vite build"],
  ["Build für die E2E-Tests (Vite, Modus e2e)", "vite build --mode e2e --outDir dist-e2e"],
  ["Fake-Server bauen (Vite)", "vite build --ssr scripts/fake-server.ts --outDir dist-fake"],
]) {
  const build = run(cmd);
  if (!build.ok) fail(name, tail(build.output));
}

// 5. End-to-end tests with axe (short reporter prints one line plus the failures)
const e2e = run("playwright test", full ? { E2E_FULL: "1" } : {});
if (!e2e.ok) {
  fail("End-to-End-Tests (Playwright)", e2e.output.trim().split("\n").slice(0, 60).join("\n"));
}
const e2eCount = /^E2E: (\d+)\//m.exec(e2e.output)?.[1] ?? "?";

const seconds = Math.round((Date.now() - started) / 1000);
console.log(
  `✅ ${full ? "check:full" : "check"}: ${unitCount} Unit-Tests, ${e2eCount} E2E-Läufe (${full ? "volle Matrix" : "Chromium/Desktop"}), ${seconds} s`,
);
