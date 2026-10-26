import { describe, expect, it } from "vitest";
import type { SyncStatus } from "../storage/storage";
import { settingsStatus } from "./settingsStatus";

const base = { signedIn: true, logoMotion: true, notifications: "off" } as const;
const sync = (status: SyncStatus, rejected = 0) => ({ status, rejected });

describe("UX-a Statusangaben der Einstellungen", () => {
  it("Konto und Haushalt: Name und Zahl der Personen, sonst der Grund", () => {
    const account = (state: Parameters<typeof settingsStatus>[0]) => settingsStatus(state).account;
    expect(account({ ...base, household: { name: "WG Sonnenweg", people: 2 } })).toBe(
      "WG Sonnenweg, 2 Personen",
    );
    expect(account({ ...base, household: { name: "WG Sonnenweg", people: 1 } })).toBe(
      "WG Sonnenweg, 1 Person",
    );
    expect(account({ ...base, household: { name: null, people: 1 } })).toBe("Haushalt, 1 Person");
    expect(account(base)).toBe("Noch kein Haushalt");
    expect(account({ ...base, signedIn: false })).toBe("Nur auf diesem Gerät");
  });

  it("Benachrichtigungen: jeder Zustand hat eine eigene Angabe", () => {
    const shown = (
      [
        "checking",
        "active",
        "off",
        "lost",
        "blocked",
        "notConfigured",
        "unavailable",
        "iosHomeScreen",
        "unsupported",
      ] as const
    ).map((notifications) => settingsStatus({ ...base, notifications }).notifications);
    expect(shown).toEqual([
      "Wird geprüft …",
      "Aktiv",
      "Aus",
      "Aus",
      "Blockiert",
      "Nicht eingerichtet",
      "Nicht eingerichtet",
      "Nur als installierte App",
      "Nicht unterstützt",
    ]);
  });

  it("Darstellung und Rechtliches", () => {
    expect(settingsStatus(base).appearance).toBe("Deutsch · Krümel bewegt sich: an");
    expect(settingsStatus({ ...base, logoMotion: false }).appearance).toBe(
      "Deutsch · Krümel bewegt sich: aus",
    );
    expect(settingsStatus(base).legal).toBe("Impressum, Datenschutz");
  });

  it("Daten: aus dem Übertragungsstatus; offline geht vor, Abgelehntes wird genannt", () => {
    const data = (value: ReturnType<typeof sync> | undefined) =>
      settingsStatus({ ...base, ...(value ? { sync: value } : {}) }).data;
    expect(data(undefined)).toBe("Nur auf diesem Gerät");
    expect(data(sync({ state: "synced" }))).toBe("Alles übertragen");
    expect(data(sync({ state: "syncing", pending: 0 }))).toBe("Wird übertragen …");
    expect(data(sync({ state: "syncing", pending: 2 }))).toBe("Noch nicht übertragen");
    expect(data(sync({ state: "unreachable", pending: 1 }))).toBe("Noch nicht übertragen");
    expect(data(sync({ state: "unreachable", pending: 0 }))).toBe("Server nicht erreichbar");
    expect(data(sync({ state: "offline", pending: 3 }))).toBe("Offline");
    expect(data(sync({ state: "synced" }, 1))).toBe("Nicht alles übertragen");
    expect(data(sync({ state: "offline", pending: 0 }, 1))).toBe("Offline");
  });
});
