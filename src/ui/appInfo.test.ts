import { describe, expect, it } from "vitest";
import { APP_BUILD, appAddress, formatBuild } from "./appInfo";

describe("Version und Adresse der App", () => {
  it("Die Version nennt Datum, Uhrzeit und Commit des Builds", () => {
    expect(formatBuild({ time: "2026-10-20T12:32:00Z", commit: "a1b2c3d" }, "Europe/Berlin")).toBe(
      "20.10.2026, 14:32 Uhr (a1b2c3d)",
    );
  });

  it("Ein Build ohne Commit (auf dem eigenen Rechner) heißt „lokal gebaut“", () => {
    expect(formatBuild({ time: "2026-01-05T08:00:00Z", commit: null }, "Europe/Berlin")).toBe(
      "05.01.2026, 09:00 Uhr (lokal gebaut)",
    );
  });

  it("EN-b Auf Englisch steht Datum und Uhrzeit nach englischer Art, ohne „Uhr“", () => {
    const time = "2026-10-20T12:32:00Z";
    expect(formatBuild({ time, commit: "a1b2c3d" }, "Europe/Berlin", "en")).toBe(
      "20 Oct 2026, 14:32 (a1b2c3d)",
    );
    expect(formatBuild({ time, commit: null }, "Europe/Berlin", "en")).toBe(
      "20 Oct 2026, 14:32 (built locally)",
    );
  });

  it("Der Build trägt seine Zeit (vite.config.ts)", () => {
    expect(Number.isNaN(Date.parse(APP_BUILD.time))).toBe(false);
  });

  it("N3 Die Adresse der App ist die Startseite unter /kruemel/, ohne Unterseite", () => {
    expect(appAddress("https://stephan-pro.github.io", "/kruemel/")).toBe(
      "https://stephan-pro.github.io/kruemel/",
    );
  });
});
