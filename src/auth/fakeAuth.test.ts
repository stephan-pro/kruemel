import { describe, expect, it } from "vitest";
import { AuthError } from "./auth";
import { FakeAuth } from "./fakeAuth";

// The rules both services share (right, wrong, expired, used code, new code, too soon) are in the
// contract (`auth.contract.ts`, run in `fakeHttpAuth.test.ts`); here only what is the fake's own.

function failureOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(AuthError);
    return (error as AuthError).failure;
  }
  throw new Error("Sollte scheitern");
}

describe("Anmeldedienst des Fake-Servers", () => {
  it("Nach fünf falschen Versuchen ist der Code verbraucht (steht für die Grenze des echten Dienstes)", () => {
    const auth = new FakeAuth({ newCode: () => "111111" });
    auth.requestCode("a@b.de");
    for (let tries = 0; tries < 5; tries++) {
      expect(failureOf(() => auth.verifyCode("a@b.de", "000000"))).toBe("wrongCode");
    }

    expect(failureOf(() => auth.verifyCode("a@b.de", "111111"))).toBe("tooManyTries");
    expect(failureOf(() => auth.verifyCode("a@b.de", "111111"))).toBe("expiredCode");
  });

  it("Dieselbe Adresse bekommt bei jeder Anmeldung dieselbe Benutzerkennung; der Standardcode hat sechs Ziffern", () => {
    let now = 0;
    const ids = ["user-1", "user-2"];
    const auth = new FakeAuth({ now: () => now, newUserId: () => ids.shift() ?? "?" });

    const signIn = (email: string) => {
      auth.requestCode(email);
      const code = auth.lastCode(email) ?? "";
      expect(code).toMatch(/^\d{6}$/);
      return auth.verifyCode(email, code).session.userId;
    };
    const first = signIn("a@b.de");
    now += 60_000;
    const second = signIn("A@B.de");
    const other = signIn("c@d.de");

    expect([first, second, other]).toEqual(["user-1", "user-1", "user-2"]);
  });

  it("Ein Geheimnis gilt bis zum Abmelden; „überall abmelden“ beendet alle Sitzungen der Adresse", () => {
    let now = 0;
    const auth = new FakeAuth({ now: () => now, newCode: () => "123456" });
    const signIn = (email: string) => {
      now += 60_000;
      auth.requestCode(email);
      return auth.verifyCode(email, "123456").token;
    };
    const phone = signIn("a@b.de");
    const laptop = signIn("a@b.de");
    const tablet = signIn("a@b.de");
    const other = signIn("c@d.de");

    auth.signOut(phone);
    auth.signOut(undefined);
    expect(auth.sessionFor(phone)).toBeUndefined();
    expect(auth.sessionFor(laptop)).toEqual({ userId: expect.any(String), email: "a@b.de" });

    auth.signOutEverywhere("A@b.de");
    expect(auth.sessionFor(laptop)).toBeUndefined();
    expect(auth.sessionFor(tablet)).toBeUndefined();
    expect(auth.sessionFor(other)?.email).toBe("c@d.de");
    expect(auth.sessionFor(undefined)).toBeUndefined();
  });
});
