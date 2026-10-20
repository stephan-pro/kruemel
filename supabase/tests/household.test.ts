import { describeHouseholdContract } from "../../src/auth/household.contract";
import { SupabaseHousehold } from "../../src/auth/supabaseHousehold";
import { admin, signedIn } from "./setup";

// The same series of tests as for the fake server (`src/auth/fakeHttpHousehold.test.ts`), against
// the real database functions: one household per person, two people at most, invites that work
// once. Every person here is a new user signed in by `signedIn`.
describeHouseholdContract("Datenbankfunktionen (lokale Supabase-Instanz)", async () => ({
  newPerson: async () => new SupabaseHousehold((await signedIn()).client),
  expireInvites: async (householdId) => {
    // Moves the end of the open invites into the past (the app cannot, only the service role).
    const { error } = await admin
      .from("invites")
      .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq("household_id", householdId)
      .is("used_at", null);
    if (error) {
      throw error;
    }
  },
}));
