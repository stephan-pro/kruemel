// Security check of the dependencies (WT-a), run by the nightly workflow "check-full".
// `node scripts/audit.mjs` – asks the npm registry about known vulnerabilities.
//   - Production dependencies (what ships in the app): a finding of severity high or critical
//     fails the run, unless it is listed in `scripts/audit-exceptions.json` and the entry has not
//     expired. Lower severities are only reported.
//   - Development dependencies (build and test tools): reported as a warning, never a failure.
// An exception is for a finding without a fix: { "id": "GHSA-…", "reason": "…", "expires": "YYYY-MM-DD" }.
// An expired entry fails the run again, so nobody forgets it (docs/WARTUNG.md, Abschnitt 3).
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const FAILING = new Set(["high", "critical"]);

/** `npm audit` as JSON; `production` leaves the development dependencies out. */
function audit(production) {
  const result = spawnSync(`npm audit --json${production ? " --omit=dev" : ""}`, {
    shell: true,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  try {
    const report = JSON.parse(result.stdout);
    if (report.error !== undefined) {
      throw new Error(report.error.summary ?? "npm audit meldet einen Fehler");
    }
    return report;
  } catch (error) {
    console.error(
      `❌ npm audit lieferte keine lesbare Antwort (${error.message}). Netz oder Registry prüfen.`,
    );
    console.error(`${result.stdout ?? ""}${result.stderr ?? ""}`.trim().slice(0, 600));
    process.exit(2);
  }
}

/** Every advisory of a report once: { id, severity, title, package }. */
function advisories(report) {
  const found = new Map();
  for (const [name, entry] of Object.entries(report.vulnerabilities ?? {})) {
    for (const via of entry.via ?? []) {
      if (typeof via === "string") continue;
      const id =
        String(via.url ?? "")
          .split("/")
          .pop() || String(via.source);
      found.set(id, { id, severity: via.severity, title: via.title, package: via.name ?? name });
    }
  }
  return [...found.values()];
}

const today = new Date().toISOString().slice(0, 10);
const { exceptions = [] } = JSON.parse(
  readFileSync(new URL("./audit-exceptions.json", import.meta.url), "utf8"),
);

let failed = false;
const excused = new Set();
for (const entry of exceptions) {
  if (!entry.id || !entry.reason || !/^\d{4}-\d{2}-\d{2}$/.test(entry.expires ?? "")) {
    console.error(
      `❌ Ausnahme unvollständig (id, reason, expires nötig): ${JSON.stringify(entry)}`,
    );
    failed = true;
  } else if (entry.expires < today) {
    console.error(
      `❌ Ausnahme ${entry.id} ist am ${entry.expires} abgelaufen. Erneut prüfen: ${entry.reason}`,
    );
    failed = true;
  } else {
    excused.add(entry.id);
  }
}

const production = advisories(audit(true));
const blocking = production.filter((item) => FAILING.has(item.severity) && !excused.has(item.id));
for (const item of blocking) {
  console.error(`❌ ${item.severity}: ${item.package} – ${item.title} (${item.id})`);
  failed = true;
}
for (const item of production.filter((entry) => !blocking.includes(entry))) {
  const state = excused.has(item.id) ? "Ausnahme" : "nur Hinweis";
  console.warn(
    `::warning::Produktion (${state}): ${item.severity} ${item.package} – ${item.title} (${item.id})`,
  );
}

const productionIds = new Set(production.map((item) => item.id));
for (const item of advisories(audit(false)).filter((entry) => !productionIds.has(entry.id))) {
  console.warn(
    `::warning::Entwicklung (nur Hinweis): ${item.severity} ${item.package} – ${item.title} (${item.id})`,
  );
}

if (failed) process.exit(1);
console.log(
  `✅ audit: keine offenen Funde der Stufe high/critical in den Produktions-Abhängigkeiten (${excused.size} Ausnahme(n) aktiv)`,
);
