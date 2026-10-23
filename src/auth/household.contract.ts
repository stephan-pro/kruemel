// One series of tests that every `HouseholdApi` must pass: `FakeHttpHousehold` against the fake
// server (in `npm run check`) and `SupabaseHousehold` against the local Supabase instance
// (`npm run check:db`, in CI). If both pass the same series, the fake does not drift away from the
// rules of the database. Not a test file by itself: a test file calls `describeHouseholdContract`.

import { describe, expect, it } from "vitest";
import { type HouseholdApi, HouseholdError } from "./household";

export interface HouseholdContractSetup {
  /** A new person, signed in, without a household. */
  newPerson(): Promise<HouseholdApi>;
  /** Lets every open invite of the household run out (more than seven days pass). */
  expireInvites(householdId: string): Promise<void>;
}

async function failureOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(HouseholdError);
    return (error as HouseholdError).failure;
  }
  throw new Error("Sollte scheitern");
}

const NAMES = { personA: "Alex", personB: "Robin" };

export function describeHouseholdContract(
  name: string,
  setup: () => Promise<HouseholdContractSetup>,
): void {
  describe(`Vertrag Haushalt: ${name}`, () => {
    it("Wer sich neu angemeldet hat, hat noch keinen Haushalt; Anlegen macht die Person zu A mit gekürzten Namen", async () => {
      const s = await setup();
      const alex = await s.newPerson();
      expect(await alex.current()).toBeNull();

      const created = await alex.create({ personA: "  Alex ", personB: "Robin  " });

      expect(created).toMatchObject({
        me: "personA",
        names: NAMES,
        name: null,
        members: ["personA"],
      });
      expect(await alex.current()).toEqual(created);
      // The second place stays free until someone accepts: inviting works, nobody joins by it.
      await alex.createInvite();
      expect(await alex.current()).toEqual(created);
    });

    it("Leere oder zu lange Namen werden abgelehnt und legen nichts an; ein zweiter Haushalt geht nicht", async () => {
      const s = await setup();
      const alex = await s.newPerson();

      expect(await failureOf(alex.create({ personA: " ", personB: "Robin" }))).toBe("invalidNames");
      expect(await failureOf(alex.create({ personA: "Alex", personB: "x".repeat(31) }))).toBe(
        "invalidNames",
      );
      expect(await alex.current()).toBeNull();

      await alex.create(NAMES);
      expect(await failureOf(alex.create(NAMES))).toBe("alreadyMember");
    });

    it("Ohne Haushalt kann man niemanden einladen", async () => {
      const s = await setup();
      const alex = await s.newPerson();

      expect(await failureOf(alex.createInvite())).toBe("noHousehold");
    });

    it("Die zweite Person nimmt die Einladung an: sie wird B, beide sehen beide Mitglieder und die Namen", async () => {
      const s = await setup();
      const alex = await s.newPerson();
      const robin = await s.newPerson();
      await alex.create(NAMES);

      const invite = await alex.createInvite();
      const joined = await robin.acceptInvite(invite.token);

      expect(invite.token.length).toBeGreaterThanOrEqual(20);
      expect(Number.isNaN(Date.parse(invite.expiresAt))).toBe(false);
      expect(joined).toMatchObject({
        me: "personB",
        names: NAMES,
        members: ["personA", "personB"],
      });
      expect(await alex.current()).toMatchObject({
        me: "personA",
        members: ["personA", "personB"],
      });
      expect((await alex.current())?.id).toBe(joined.id);
    });

    it("Eine Einladung gilt nur einmal; ein Haushalt mit zwei Personen lädt niemanden mehr ein", async () => {
      const s = await setup();
      const [alex, robin, sam] = [await s.newPerson(), await s.newPerson(), await s.newPerson()];
      await alex.create(NAMES);
      const invite = await alex.createInvite();
      await robin.acceptInvite(invite.token);

      expect(await failureOf(sam.acceptInvite(invite.token))).toBe("inviteUsed");
      expect(await sam.current()).toBeNull();
      expect(await failureOf(alex.createInvite())).toBe("householdFull");
    });

    it("Unbekannte, abgelaufene und überholte Einladungen haben eigene Fehler", async () => {
      const s = await setup();
      const [alex, robin] = [await s.newPerson(), await s.newPerson()];
      const { id } = await alex.create(NAMES);

      expect(await failureOf(robin.acceptInvite("gibt-es-nicht"))).toBe("inviteUnknown");

      const old = await alex.createInvite();
      const fresh = await alex.createInvite();
      expect(fresh.token).not.toBe(old.token);
      expect(await failureOf(robin.acceptInvite(old.token))).toBe("inviteUnknown");

      await s.expireInvites(id);
      expect(await failureOf(robin.acceptInvite(fresh.token))).toBe("inviteExpired");
      expect(await robin.current()).toBeNull();

      const again = await alex.createInvite();
      expect((await robin.acceptInvite(again.token)).me).toBe("personB");
    });

    it("E2-3g Den Namen des Haushalts ändert jedes Mitglied für beide; leer entfernt ihn, zu lang wird abgelehnt", async () => {
      const s = await setup();
      const [alex, robin, sam] = [await s.newPerson(), await s.newPerson(), await s.newPerson()];
      await alex.create(NAMES);
      await robin.acceptInvite((await alex.createInvite()).token);
      await sam.create({ personA: "Sam", personB: "Kim" });

      expect(await alex.rename("  WG Sonnenweg ")).toMatchObject({ name: "WG Sonnenweg" });
      expect((await robin.current())?.name).toBe("WG Sonnenweg");
      expect((await robin.rename("Zuhause")).name).toBe("Zuhause");
      expect((await alex.current())?.name).toBe("Zuhause");

      expect(await failureOf(alex.rename("x".repeat(31)))).toBe("invalidHouseholdName");
      expect((await alex.current())?.name).toBe("Zuhause");
      // Nur der eigene Haushalt: der fremde behält seinen Zustand, die Namen der Personen bleiben.
      expect((await sam.current())?.name).toBeNull();
      expect((await alex.current())?.names).toEqual(NAMES);

      expect((await alex.rename("  ")).name).toBeNull();
      expect((await robin.current())?.name).toBeNull();
      expect(await failureOf((await s.newPerson()).rename("Ohne Haushalt"))).toBe("noHousehold");
    });

    it("Wer schon einen Haushalt hat, kann keiner Einladung folgen, auch nicht der eigenen", async () => {
      const s = await setup();
      const [alex, robin] = [await s.newPerson(), await s.newPerson()];
      await alex.create(NAMES);
      await robin.create({ personA: "Robin", personB: "Sam" });
      const invite = await alex.createInvite();

      expect(await failureOf(robin.acceptInvite(invite.token))).toBe("alreadyMember");
      expect(await failureOf(alex.acceptInvite(invite.token))).toBe("alreadyMember");
      expect((await robin.current())?.names).toEqual({ personA: "Robin", personB: "Sam" });
    });
  });
}
