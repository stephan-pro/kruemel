import { describe, expect, it } from "vitest";
import { AuthError } from "./auth";
import { FakeAuth } from "./fakeAuth";

async function failureOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AuthError);
    return (error as AuthError).failure;
  }
  throw new Error("Sollte scheitern");
}

function setup() {
  let now = 1_000_000;
  const codes = ["111111", "222222", "333333"];
  const auth = new FakeAuth({
    now: () => now,
    newCode: () => codes.shift() ?? "999999",
    newUserId: () => "user-1",
  });
  return { auth, advance: (minutes: number) => (now += minutes * 60_000) };
}

describe("Anmeldung (Fake, S2): Einmalcode per E-Mail", () => {
  it("Ohne Anmeldung gibt es keine Sitzung", async () => {
    expect(await setup().auth.session()).toBeNull();
  });

  it("Mit dem richtigen Code ist man angemeldet; Groß-/Kleinschreibung der Adresse zählt nicht", async () => {
    const { auth } = setup();
    await auth.requestCode("Anna@Example.org");

    const session = await auth.verifyCode("anna@example.org ", "111111");

    expect(session).toEqual({ userId: "user-1", email: "anna@example.org" });
    expect(await auth.session()).toEqual(session);
  });

  it("Eine ungültige Adresse wird abgelehnt", async () => {
    const { auth } = setup();

    expect(await failureOf(auth.requestCode("kein-at-zeichen"))).toBe("invalidEmail");
  });

  it("Ein falscher Code wird abgelehnt, der richtige danach geht noch", async () => {
    const { auth } = setup();
    await auth.requestCode("a@b.de");

    expect(await failureOf(auth.verifyCode("a@b.de", "000000"))).toBe("wrongCode");
    expect((await auth.verifyCode("a@b.de", "111111")).email).toBe("a@b.de");
  });

  it("Ein abgelaufener Code (nach 10 Minuten) wird abgelehnt", async () => {
    const { auth, advance } = setup();
    await auth.requestCode("a@b.de");

    advance(11);

    expect(await failureOf(auth.verifyCode("a@b.de", "111111"))).toBe("expiredCode");
  });

  it("Ein Code gilt nur einmal", async () => {
    const { auth } = setup();
    await auth.requestCode("a@b.de");
    await auth.verifyCode("a@b.de", "111111");

    expect(await failureOf(auth.verifyCode("a@b.de", "111111"))).toBe("expiredCode");
  });

  it("Ohne angeforderten Code gibt es nichts zu prüfen", async () => {
    expect(await failureOf(setup().auth.verifyCode("a@b.de", "111111"))).toBe("expiredCode");
  });

  it("Nach fünf falschen Versuchen ist der Code verbraucht", async () => {
    const { auth } = setup();
    await auth.requestCode("a@b.de");
    for (let tries = 0; tries < 5; tries++) {
      await failureOf(auth.verifyCode("a@b.de", "000000"));
    }

    expect(await failureOf(auth.verifyCode("a@b.de", "111111"))).toBe("tooManyTries");
    expect(await failureOf(auth.verifyCode("a@b.de", "111111"))).toBe("expiredCode");
  });

  it("Ein neuer Code macht den alten ungültig", async () => {
    const { auth } = setup();
    await auth.requestCode("a@b.de");
    await auth.requestCode("a@b.de");

    expect(await failureOf(auth.verifyCode("a@b.de", "111111"))).toBe("wrongCode");
    expect(auth.lastCode("a@b.de")).toBe("222222");
    expect((await auth.verifyCode("a@b.de", "222222")).email).toBe("a@b.de");
  });

  it("Dieselbe Adresse bekommt bei jeder Anmeldung dieselbe Benutzerkennung", async () => {
    const ids = ["user-1", "user-2"];
    const auth = new FakeAuth({ newUserId: () => ids.shift() ?? "?", newCode: () => "123456" });

    await auth.requestCode("a@b.de");
    const first = await auth.verifyCode("a@b.de", "123456");
    await auth.signOut();
    await auth.requestCode("a@b.de");
    const second = await auth.verifyCode("a@b.de", "123456");
    await auth.requestCode("c@d.de");
    const other = await auth.verifyCode("c@d.de", "123456");

    expect(second.userId).toBe(first.userId);
    expect(other.userId).toBe("user-2");
  });

  it("Der Standardcode hat sechs Ziffern", async () => {
    const auth = new FakeAuth();

    await auth.requestCode("a@b.de");

    expect(auth.lastCode("a@b.de")).toMatch(/^\d{6}$/);
  });

  it("Abmelden beendet die Sitzung und meldet es; Zuhörer lassen sich entfernen", async () => {
    const { auth } = setup();
    const seen: (string | null)[] = [];
    const stop = auth.onChange((session) => seen.push(session?.email ?? null));
    await auth.requestCode("a@b.de");
    await auth.verifyCode("a@b.de", "111111");

    await auth.signOut();
    stop();
    await auth.requestCode("a@b.de");
    await auth.verifyCode("a@b.de", "222222");

    expect(seen).toEqual(["a@b.de", null]);
    expect(await auth.session()).toMatchObject({ email: "a@b.de" });
  });
});
