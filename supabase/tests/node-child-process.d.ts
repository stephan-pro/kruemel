// Minimal typing of the one Node function the database tests use (instead of @types/node, N7), as
// `scripts/node-http.d.ts` does for the fake server.
declare module "node:child_process" {
  export function spawnSync(
    command: string,
    args: readonly string[],
    options: { readonly encoding: "utf8" },
  ): { readonly status: number | null; readonly stdout: string; readonly stderr: string };
}
