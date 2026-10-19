import { defineConfig } from "vitest/config";

export default defineConfig({
  // GitHub Pages serves the app under /<repo-name>/.
  base: "/putzplan/",
  test: {
    include: ["src/**/*.test.ts"],
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      include: ["src/domain/**/*.ts"],
      exclude: ["src/domain/**/*.test.ts"],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
