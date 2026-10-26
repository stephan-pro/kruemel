import { afterEach, describe, expect, it } from "vitest";
import { AUTH_MESSAGES } from "../auth/auth";
import { HOUSEHOLD_MESSAGES } from "../auth/household";
import { resetLanguage, setLanguage } from "../i18n/language";
import { ACCOUNT_TEXTS } from "./accountTexts";
import {
  formatInviteEnd,
  HOUSEHOLD_TEXTS,
  INVITE_FAILURE_TITLES,
  SYNC_TEXTS,
} from "./householdTexts";

afterEach(() => resetLanguage());

describe("Texte zu Haushalt und Einladung", () => {
  it("Das Ende der Einladung steht mit Wochentag und Datum in der Zeitzone des Geräts", () => {
    expect(formatInviteEnd("2026-10-30T09:15:00Z", "Europe/Berlin")).toBe("Fr., 30.10.2026");
    // Kurz vor Mitternacht UTC ist in Berlin schon der nächste Tag.
    expect(formatInviteEnd("2026-10-30T23:30:00Z", "Europe/Berlin")).toBe("Sa., 31.10.2026");
  });

  it("EN-b Das Ende der Einladung folgt der Sprache", () => {
    expect(formatInviteEnd("2026-10-30T09:15:00Z", "Europe/Berlin", "en")).toBe("Fri, 30/10/2026");
    setLanguage("en");
    expect(formatInviteEnd("2026-10-30T09:15:00Z", "Europe/Berlin")).toBe("Fri, 30/10/2026");
  });
});

describe("EN-b Texte lesen immer die eingestellte Sprache", () => {
  it("Dieselbe Konstante liefert nach dem Wechsel den neuen Text", () => {
    expect(ACCOUNT_TEXTS.signInTitle).toBe("Anmelden");
    expect(HOUSEHOLD_TEXTS.create).toBe("Haushalt anlegen");
    expect(SYNC_TEXTS.waitingOffline(2)).toBe(
      "Kein Internet – 2 Änderungen warten auf Verbindung.",
    );
    expect(INVITE_FAILURE_TITLES.inviteUsed).toBe("Einladung schon benutzt");
    expect(AUTH_MESSAGES.wrongCode).toBe(
      "Der Code stimmt nicht. Bitte prüfen und erneut eingeben.",
    );

    setLanguage("en");

    expect(ACCOUNT_TEXTS.signInTitle).toBe("Sign in");
    expect(HOUSEHOLD_TEXTS.create).toBe("Create household");
    expect(SYNC_TEXTS.waitingOffline(1)).toBe(
      "No internet – 1 change is waiting for a connection.",
    );
    expect(SYNC_TEXTS.waitingOffline(2)).toBe(
      "No internet – 2 changes are waiting for a connection.",
    );
    expect(INVITE_FAILURE_TITLES.inviteUsed).toBe("Invite already used");
    expect(AUTH_MESSAGES.wrongCode).toBe("The code is wrong. Please check it and try again.");
    expect(HOUSEHOLD_MESSAGES.householdFull).toContain("already has two people");
  });

  it("Die Konstanten lassen sich wie Objekte durchsuchen (Schlüssel, in, Object.hasOwn)", () => {
    expect(Object.hasOwn(AUTH_MESSAGES, "offline")).toBe(true);
    expect(Object.hasOwn(AUTH_MESSAGES, "nope")).toBe(false);
    expect(Object.keys(HOUSEHOLD_MESSAGES)).toContain("friendInvitesOpen");
    expect("create" in HOUSEHOLD_TEXTS).toBe(true);
    expect(Object.keys(ACCOUNT_TEXTS)).toContain("signOut");
  });
});
