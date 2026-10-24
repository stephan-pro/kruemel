// Secret scan for the pre-commit hook: looks only at the lines that are added in the staged files
// (`git diff --cached`), never at the whole history, so it takes a fraction of a second.
// Public values (Supabase URL, `sb_publishable_…` key) are fine; service-role keys, private keys,
// tokens and hard-coded passwords stop the commit.
import { spawnSync } from "node:child_process";

const FORBIDDEN_FILES = /(^|\/)(\.env(\.[^/]*)?|[^/]+\.(pem|key|p12))$/;
const ALLOWED_FILES = /(^|\/)\.env\.(example|sample)$/;

const PATTERNS = [
  ["Supabase Secret Key", /sb_secret_[A-Za-z0-9_-]{16,}/],
  ["privater Schlüssel", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["GitHub-Token", /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|github_pat_[A-Za-z0-9_]{40,}/],
  ["Passwort im Quelltext", /(passwor[dt]|secret|app_?password)\s*[:=]\s*["'][^"'\s]{8,}["']/i],
  // NT-a: a bare private VAPID key (32 bytes base64url) cannot be told from other text; only one
  // written next to its name can.
  ["privater VAPID-Schlüssel", /VAPID_PRIVATE_KEY\S*\s*[:=]\s*["']?[A-Za-z0-9_-]{43}\b/],
  // NT-c: the same for the token of the schedule (base64 of 32 bytes, 44 characters).
  ["Token des Zeitplans", /PUSH_CRON_TOKEN\S*\s*[:=]\s*["']?[A-Za-z0-9+/_-]{32,}/],
];
// A JWT is only a problem if it is a service-role key (the anon key is public).
const JWT = /eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g;

function git(...args) {
  const result = spawnSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  return result.stdout ?? "";
}

const findings = [];
const staged = git("diff", "--cached", "--name-only", "--diff-filter=ACM")
  .split("\n")
  .filter(Boolean);
for (const file of staged) {
  if (FORBIDDEN_FILES.test(file) && !ALLOWED_FILES.test(file)) {
    findings.push(`${file}: Datei mit Zugangsdaten gehört nicht ins Repository`);
  }
}

let file = "";
for (const line of git("diff", "--cached", "-U0", "--no-color", "--diff-filter=ACM").split("\n")) {
  if (line.startsWith("+++ b/")) {
    file = line.slice(6);
  } else if (line.startsWith("+") && !line.startsWith("+++")) {
    for (const [name, pattern] of PATTERNS) {
      if (pattern.test(line)) findings.push(`${file}: ${name}`);
    }
    for (const match of line.matchAll(JWT)) {
      try {
        const payload = JSON.parse(Buffer.from(match[1], "base64url").toString("utf8"));
        if (payload.role === "service_role")
          findings.push(`${file}: Supabase service_role-Schlüssel`);
      } catch {
        // not a JWT after all
      }
    }
  }
}

if (findings.length > 0) {
  console.error(
    `❌ Commit abgebrochen: mögliche Geheimnisse in gestagten Dateien:\n  ${findings.join("\n  ")}`,
  );
  console.error(
    "Entfernen und erneut stagen (nie ins Repository; öffentlich sind nur URL und Publishable Key).",
  );
  process.exit(1);
}
