// One series of tests that every `Auth` must pass: `FakeHttpAuth` against the fake server and
// `SupabaseAuth` against a stand-in for the service (both in `npm run check`), and `SupabaseAuth`
// against the local Supabase instance with the code from the mail catcher (`npm run check:db`, in
// CI). If all pass the same series, the fake does not drift away from the real service. Not a
// test file by itself: a test file calls `describeAuthContract`.

import { describe, expect, it } from "vitest";
import { type Auth, AuthError, type Session } from "./auth";

/** One device (its storage stays between `open` calls) and the service behind it. */
export interface AuthContractSetup {
  /** An address nobody has used yet. */
  readonly email: string;
  /** The device's `Auth`; called again, it is the app after a reload, optionally without network. */
  open(options?: { readonly offline?: boolean }): Auth;
  /** The code in the mail of the last request (waits for it if needed). */
  nextCode(email: string): Promise<string>;
  /** Lets the codes sent so far run out (more than ten minutes pass, on the service and device). */
  expireCodes(email: string): Promise<void>;
  /** Waits until the service sends a new code to the same address. */
  waitBeforeResend(): Promise<void>;
  /**
   * The service refuses the address's sessions for good (e.g. signed out everywhere), and the
   * short-lived part of the session on the device has run out, so it has to ask the service.
   */
  refuseSessions(email: string): Promise<void>;
}

async function failureOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AuthError);
    return (error as AuthError).failure;
  }
  throw new Error("Sollte scheitern");
}

/** Resolves with the next session `onChange` reports that matches. */
function reported(auth: Auth, wanted: (session: Session | null) => boolean) {
  return new Promise<Session | null>((resolve) => {
    const stop = auth.onChange((session) => {
      if (wanted(session)) {
        stop();
        resolve(session);
      }
    });
  });
}

async function signIn(setup: AuthContractSetup, auth: Auth): Promise<Session> {
  await auth.requestCode(setup.email);
  return auth.verifyCode(setup.email, await setup.nextCode(setup.email));
}

export function describeAuthContract(name: string, setup: () => Promise<AuthContractSetup>): void {
  describe(`Vertrag Anmeldung: ${name}`, () => {
    it("Mit dem richtigen Code aus der E-Mail ist man angemeldet (S2), die Sitzung wird gemeldet", async () => {
      const s = await setup();
      const auth = s.open();
      const seen: (string | null)[] = [];
      auth.onChange((session) => seen.push(session?.email ?? null));
      expect(await auth.session()).toBeNull();

      await auth.requestCode(` ${s.email.toUpperCase()} `);
      const session = await auth.verifyCode(s.email, ` ${await s.nextCode(s.email)} `);

      expect(session).toEqual({ userId: expect.any(String), email: s.email });
      expect(await auth.session()).toEqual(session);
      expect(seen).toEqual([s.email]);
    });

    it("Eine ungültige Adresse wird abgelehnt", async () => {
      const auth = (await setup()).open();

      expect(await failureOf(auth.requestCode("kein-at-zeichen"))).toBe("invalidEmail");
      expect(await failureOf(auth.verifyCode("a@b", "123456"))).toBe("invalidEmail");
    });

    it("Falscher Code: wird abgelehnt, der richtige danach geht noch", async () => {
      const s = await setup();
      const auth = s.open();
      await auth.requestCode(s.email);
      const code = await s.nextCode(s.email);
      const wrong = code === "000000" ? "111111" : "000000";

      expect(await failureOf(auth.verifyCode(s.email, wrong))).toBe("wrongCode");
      expect((await auth.verifyCode(s.email, code)).email).toBe(s.email);
    });

    it("Abgelaufener Code: nach 10 Minuten wird auch der richtige Code abgelehnt", async () => {
      const s = await setup();
      const auth = s.open();
      await auth.requestCode(s.email);
      const code = await s.nextCode(s.email);

      await s.expireCodes(s.email);

      expect(await failureOf(auth.verifyCode(s.email, code))).toBe("expiredCode");
      expect(await auth.session()).toBeNull();
    });

    it("Ein Code gilt nur einmal", async () => {
      const s = await setup();
      const auth = s.open();
      await auth.requestCode(s.email);
      const code = await s.nextCode(s.email);
      await auth.verifyCode(s.email, code);
      await auth.signOut();

      expect(await failureOf(auth.verifyCode(s.email, code))).toBe("expiredCode");
    });

    it("Ein neuer Code macht den alten ungültig", async () => {
      const s = await setup();
      const auth = s.open();
      await auth.requestCode(s.email);
      const old = await s.nextCode(s.email);
      await s.waitBeforeResend();
      await auth.requestCode(s.email);
      const fresh = await s.nextCode(s.email);

      expect(fresh).not.toBe(old);
      expect(await failureOf(auth.verifyCode(s.email, old))).toBe("wrongCode");
      expect((await auth.verifyCode(s.email, fresh)).email).toBe(s.email);
    });

    it("Zu viele Versuche: zu früh einen neuen Code anfordern wird abgelehnt", async () => {
      const s = await setup();
      const auth = s.open();
      await auth.requestCode(s.email);

      expect(await failureOf(auth.requestCode(s.email))).toBe("tooManyTries");
    });

    it("Kein Netz: Code anfordern und prüfen scheitern mit eigener Meldung", async () => {
      const s = await setup();
      const offline = s.open({ offline: true });

      expect(await failureOf(offline.requestCode(s.email))).toBe("offline");
      expect(await failureOf(offline.verifyCode(s.email, "123456"))).toBe("offline");
    });

    it("Die gemerkte Sitzung gilt nach dem Neuladen, auch ohne Netz", async () => {
      const s = await setup();
      const session = await signIn(s, s.open());

      expect(await s.open().session()).toEqual(session);
      expect(await s.open({ offline: true }).session()).toEqual(session);
    });

    it("Endgültige Ablehnung durch den Dienst meldet ab, im Hintergrund", async () => {
      const s = await setup();
      const session = await signIn(s, s.open());
      await s.refuseSessions(s.email);

      const auth = s.open();
      const signedOut = reported(auth, (current) => current === null);
      const first = await auth.session();

      expect(first === null || first.userId === session.userId).toBe(true);
      await signedOut;
      expect(await auth.session()).toBeNull();
    });

    it("Abmelden beendet die Sitzung auch ohne Netz und meldet es; Zuhörer lassen sich entfernen", async () => {
      const s = await setup();
      await signIn(s, s.open());
      const offline = s.open({ offline: true });
      const seen: (string | null)[] = [];
      const stop = offline.onChange((session) => seen.push(session?.email ?? null));

      await offline.signOut();
      stop();
      await offline.signOut();

      expect(seen).toEqual([null]);
      expect(await offline.session()).toBeNull();
      expect(await s.open().session()).toBeNull();
    });
  });
}
