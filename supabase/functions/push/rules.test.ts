import { describe, expect, it } from "vitest";
import {
  base64Url,
  fromBase64Url,
  isAuthSecret,
  isP256dh,
  isPushEndpoint,
  isPushFailure,
  isVapidPrivateKey,
  isVapidPublicKey,
  keyIdOf,
  raisedPushFailure,
} from "./rules";
import { ALLOWED_ENDPOINTS, REFUSED_ENDPOINTS } from "./rules.cases";

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
    expect(raisedPushFailure("anderer Fehler")).toBeUndefined();
  });
});
