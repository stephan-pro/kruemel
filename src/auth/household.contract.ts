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
  /** Lets the friend invite run out (more than seven days pass, E2-5b). */
  expireFriendInvite(token: string): Promise<void>;
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

    it("E2-5a Person entfernen: der Platz ist wieder frei und neu einladbar; doppelt ändert nichts, sich selbst nicht", async () => {
      const s = await setup();
      const [alex, robin, sam] = [await s.newPerson(), await s.newPerson(), await s.newPerson()];
      const { id } = await alex.create(NAMES);
      await robin.acceptInvite((await alex.createInvite()).token);

      const left = await alex.removeMember("personB");

      expect(left).toMatchObject({ id, me: "personA", names: NAMES, members: ["personA"] });
      expect(await robin.current()).toBeNull();
      expect(await alex.removeMember("personB")).toEqual(left);
      expect(await failureOf(alex.removeMember("personA"))).toBe("invalidMember");
      expect(await failureOf(robin.removeMember("personA"))).toBe("noHousehold");
      expect(await alex.current()).toEqual(left);

      // The name stays with the place; whoever comes next takes it over.
      const joined = await sam.acceptInvite((await alex.createInvite()).token);
      expect(joined).toMatchObject({ id, me: "personB", names: NAMES });
      // The removed person may start over: a household of their own.
      expect((await robin.create({ personA: "Robin", personB: "Kim" })).me).toBe("personA");
    });

    it("E2-5a Haushalt verlassen: die andere Person bleibt mit Namen; der freie Platz (auch A) lässt sich neu einladen", async () => {
      const s = await setup();
      const [alex, robin, sam] = [await s.newPerson(), await s.newPerson(), await s.newPerson()];
      const { id } = await alex.create(NAMES);
      await robin.acceptInvite((await alex.createInvite()).token);
      await alex.rename("WG Sonnenweg");

      await alex.leave();

      expect(await alex.current()).toBeNull();
      expect(await failureOf(alex.leave())).toBe("noHousehold");
      expect(await robin.current()).toEqual({
        id,
        me: "personB",
        names: NAMES,
        name: "WG Sonnenweg",
        members: ["personB"],
      });
      const joined = await sam.acceptInvite((await robin.createInvite()).token);
      expect(joined).toMatchObject({ id, me: "personA", members: ["personA", "personB"] });
    });

    it("E2-5a Die letzte Person nimmt den Haushalt mit: er ist samt Einladung weg", async () => {
      const s = await setup();
      const [alex, robin] = [await s.newPerson(), await s.newPerson()];
      await alex.create(NAMES);
      const open = await alex.createInvite();

      await alex.leave();

      expect(await alex.current()).toBeNull();
      expect(await failureOf(robin.acceptInvite(open.token))).toBe("inviteUnknown");
      expect(await failureOf(alex.createInvite())).toBe("noHousehold");
      expect((await alex.create(NAMES)).members).toEqual(["personA"]);
    });

    it("E2-5a Konto löschen: die Person ist aus dem Haushalt, der für die andere bleibt; allein löscht es ihn mit", async () => {
      const s = await setup();
      const [alex, robin, sam] = [await s.newPerson(), await s.newPerson(), await s.newPerson()];
      const { id } = await alex.create(NAMES);
      await robin.acceptInvite((await alex.createInvite()).token);
      await sam.create({ personA: "Sam", personB: "Kim" });
      const samsInvite = await sam.createInvite();

      await robin.deleteAccount();

      expect(await alex.current()).toMatchObject({ id, names: NAMES, members: ["personA"] });
      await alex.createInvite();

      await sam.deleteAccount();
      expect(await failureOf((await s.newPerson()).acceptInvite(samsInvite.token))).toBe(
        "inviteUnknown",
      );
    });

    it("E2-5b Freunde einladen: nur mit Haushalt; offene Links stehen in der Liste, bis sie zurückgezogen werden oder ablaufen", async () => {
      const s = await setup();
      const [alex, sam] = [await s.newPerson(), await s.newPerson()];
      expect(await failureOf(alex.createFriendInvite())).toBe("noHousehold");
      await alex.create(NAMES);
      await sam.create({ personA: "Sam", personB: "Kim" });

      const first = await alex.createFriendInvite();
      const second = await alex.createFriendInvite();

      expect(first.token.length).toBeGreaterThanOrEqual(20);
      expect(second.token).not.toBe(first.token);
      expect(Number.isNaN(Date.parse(first.expiresAt))).toBe(false);
      expect(await alex.friendInvites()).toEqual([first, second]);
      expect(await sam.friendInvites()).toEqual([]);

      // Fremde Links zieht niemand zurück; der eigene geht, zweimal ändert nichts.
      await sam.cancelFriendInvite(first.token);
      expect((await alex.friendInvites()).length).toBe(2);
      await alex.cancelFriendInvite(first.token);
      await alex.cancelFriendInvite(first.token);
      expect(await alex.friendInvites()).toEqual([second]);

      await s.expireFriendInvite(second.token);
      expect(await alex.friendInvites()).toEqual([]);
      // Ein Haushalts-Link bleibt davon unberührt.
      expect((await alex.createInvite()).token).not.toBe(second.token);
    });

    it("E2-5b Höchstens 5 offene Freundes-Einladungen und 10 neue am Tag, zurückgezogene zählen mit", async () => {
      const s = await setup();
      const alex = await s.newPerson();
      await alex.create(NAMES);
      const made = [];
      for (let count = 0; count < 5; count++) {
        made.push(await alex.createFriendInvite());
      }

      expect(await failureOf(alex.createFriendInvite())).toBe("friendInvitesOpen");
      for (const invite of made) {
        await alex.cancelFriendInvite(invite.token);
      }
      for (let count = 0; count < 5; count++) {
        await alex.createFriendInvite();
      }
      await alex.cancelFriendInvite((await alex.friendInvites())[0]?.token ?? "");
      expect(await failureOf(alex.createFriendInvite())).toBe("friendInvitesToday");
      expect((await alex.friendInvites()).length).toBe(4);
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
