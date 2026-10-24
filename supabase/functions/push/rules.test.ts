import { describe, expect, it } from "vitest";
import {
  base64Url,
  DEFAULT_PUSH_SETTINGS,
  fromBase64Url,
  isAuthSecret,
  isClockTime,
  isP256dh,
  isPushEndpoint,
  isPushFailure,
  isVapidPrivateKey,
  isVapidPublicKey,
  keyIdOf,
  pushSettingsProblems,
  raisedPushFailure,
  settingsArguments,
  settingsFromRow,
} from "./rules";
import {
  ALLOWED_ENDPOINTS,
  INVALID_SETTINGS,
  REFUSED_ENDPOINTS,
  VALID_SETTINGS,
} from "./rules.cases";

describe("NT-a Regeln der Benachrichtigungen", () => {
  it("NT-a Erlaubtliste: nur Adressen der Push-Dienste der Browser (dieselben Fälle wie die Datenbank)", () => {
    for (const endpoint of ALLOWED_ENDPOINTS) {
      expect(isPushEndpoint(endpoint), endpoint).toBe(true);
    }
    for (const endpoint of REFUSED_ENDPOINTS) {
      expect(isPushEndpoint(endpoint), endpoint).toBe(false);
    }
  });

  it("NT-a Schlüssel haben feste Längen", () => {
    expect(isP256dh(`B${"a".repeat(86)}`)).toBe(true);
    expect(isP256dh(`B${"a".repeat(85)}=`)).toBe(false);
    expect(isAuthSecret("a".repeat(22))).toBe(true);
    expect(isAuthSecret("a+".repeat(11))).toBe(false);
    expect(isVapidPublicKey(`B${"_".repeat(86)}`)).toBe(true);
    expect(isVapidPublicKey(`A${"_".repeat(86)}`)).toBe(false);
    expect(isVapidPrivateKey("-".repeat(43))).toBe(true);
    expect(isVapidPrivateKey("-".repeat(44))).toBe(false);
  });

  it("NT-a Kennung des Schlüssels: kurz, fest und je Schlüssel verschieden", async () => {
    const first = await keyIdOf(`B${"a".repeat(86)}`);

    expect(first).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(await keyIdOf(`B${"a".repeat(86)}`)).toBe(first);
    expect(await keyIdOf(`B${"b".repeat(86)}`)).not.toBe(first);
  });

  it("NT-a base64url hin und zurück, auch mit Auffüllzeichen", () => {
    const bytes = Uint8Array.from([0, 250, 251, 255, 62, 63]);

    expect(base64Url(bytes)).toBe("APr7_z4_");
    expect([...fromBase64Url("APr7_z4_")]).toEqual([...bytes]);
    expect([...fromBase64Url("AQ==")]).toEqual([1]);
  });

  it("NT-a Fehlercodes: bekannte Codes und Meldungen der Datenbank", () => {
    expect(isPushFailure("testWait")).toBe(true);
    expect(isPushFailure("irgendwas")).toBe(false);
    expect(isPushFailure(3)).toBe(false);
    expect(raisedPushFailure("ERROR: push_test_today")).toBe("testToday");
    expect(raisedPushFailure("ERROR: push_settings_invalid")).toBe("settingsInvalid");
    expect(raisedPushFailure("anderer Fehler")).toBeUndefined();
  });
});

describe("NT-b Regeln der Einstellungen eines Geräts", () => {
  it("NT-b Gültige Einstellungen bestehen die Prüfung, ungültige nennen das falsche Feld (dieselben Fälle wie die Datenbank)", () => {
    for (const settings of VALID_SETTINGS) {
      expect(pushSettingsProblems(settings), JSON.stringify(settings)).toEqual([]);
    }
    for (const { settings, problems } of INVALID_SETTINGS) {
      expect(pushSettingsProblems(settings), JSON.stringify(settings)).toEqual(problems);
    }
  });

  it("NT-b Standardwerte: alles an, Tagesüberblick 07:30 an allen Tagen, Ruhezeit 21 bis 7 Uhr", () => {
    expect(DEFAULT_PUSH_SETTINGS).toEqual({
      dailyEnabled: true,
      dailyTime: "07:30",
      dailyDays: 127,
      partnerEnabled: true,
      householdEnabled: true,
      quietEnabled: true,
      quietFrom: "21:00",
      quietTo: "07:00",
    });
  });

  it("NT-b Uhrzeiten: nur HH:MM von 00:00 bis 23:59", () => {
    for (const time of ["00:00", "07:30", "23:59"]) {
      expect(isClockTime(time), time).toBe(true);
    }
    for (const time of ["24:00", "7:30", "07:5", "07:30:00", "", "ab:cd", 730, null]) {
      expect(isClockTime(time), String(time)).toBe(false);
    }
  });

  it("NT-b Einstellungen als Argumente der Datenbankfunktion und aus einer Zeile der Tabelle", () => {
    const chosen = { ...DEFAULT_PUSH_SETTINGS, dailyTime: "06:15", quietEnabled: false };
    expect(settingsArguments(chosen)).toEqual({
      p_daily_enabled: true,
      p_daily_time: "06:15",
      p_daily_days: 127,
      p_partner_enabled: true,
      p_household_enabled: true,
      p_quiet_enabled: false,
      p_quiet_from: "21:00",
      p_quiet_to: "07:00",
    });
    expect(
      settingsFromRow({
        daily_enabled: true,
        daily_time: "06:15:00",
        daily_days: 127,
        partner_enabled: true,
        household_enabled: true,
        quiet_enabled: false,
        quiet_from: "21:00:00",
        quiet_to: "07:00:00",
      }),
    ).toEqual(chosen);
  });
});
