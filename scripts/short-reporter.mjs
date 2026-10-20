// Playwright reporter with a tiny output: nothing while running, at the end one line plus one block
// per failed test (project, file:line, title, first lines of the error). Traces, screenshots and the
// HTML report stay on disk (test-results/, playwright-report/).
import { stripVTControlCharacters } from "node:util";

const MAX_ERROR_LINES = 6;

export default class ShortReporter {
  // Last attempt per test: a retry that passes replaces the failed first attempt.
  last = new Map();

  onTestEnd(test, result) {
    this.last.set(test.id, { test, result });
  }

  onEnd() {
    let passed = 0;
    let skipped = 0;
    const failed = [];
    for (const { test, result } of this.last.values()) {
      if (result.status === "skipped") {
        skipped += 1;
      } else if (result.status === test.expectedStatus) {
        passed += 1;
      } else {
        const where = test.location.file.replace(/\\/g, "/").replace(/^.*\/tests\//, "tests/");
        const error = stripVTControlCharacters(result.error?.message ?? result.status);
        failed.push(
          `\n✖ [${test.parent.project()?.name ?? ""}] ${where}:${test.location.line}\n  ${test.title}\n    ${error
            .split("\n")
            .slice(0, MAX_ERROR_LINES)
            .join("\n    ")}\n`,
        );
      }
    }
    process.stdout.write(
      `E2E: ${passed}/${passed + failed.length} bestanden, ${skipped} übersprungen, ${failed.length} fehlgeschlagen\n${failed.join("")}`,
    );
  }

  printsToStdio() {
    return true;
  }
}
