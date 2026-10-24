import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// K2c: Realtime announces only the tables the app listens to. `household_members` is not among
// them (its delete events would bypass row level security).

declare const process: { env: Record<string, string | undefined> };

const DB_CONTAINER = process.env.SUPABASE_DB_CONTAINER || "supabase_db_kruemel";

/** Runs one query in the database container and returns the printed rows (one table name per line). */
function rows(sql: string): string[] {
  const database = new URL(process.env.SUPABASE_DB_URL ?? "");
  const result = spawnSync(
    "docker",
    [
      "exec",
      "-e",
      `PGPASSWORD=${decodeURIComponent(database.password)}`,
      DB_CONTAINER,
      "psql",
      "-h",
      "127.0.0.1",
      "-U",
      decodeURIComponent(database.username),
      "-d",
      database.pathname.slice(1),
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
      "-c",
      sql,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`Abfrage fehlgeschlagen: ${result.stdout} ${result.stderr}`);
  }
  return result.stdout.split("\n").filter((line) => line !== "");
}

describe("Echtzeit-Liste", () => {
  it("K2c meldet Haushalte, Aufgaben und Erledigungen, nicht die Mitglieder", () => {
    const tables = rows(
      "select tablename from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' order by tablename",
    );

    expect(tables).toEqual(["completions", "households", "tasks"]);
  });
});
