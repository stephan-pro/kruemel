import { describeRemoteContract } from "../../src/sync/remote.contract";
import { SupabaseRemote } from "../../src/sync/supabaseRemote";
import { couple } from "./setup";

// The same series of tests as for the fake (`FakeRemote`, fake server), with the app's own
// `SupabaseRemote` against the real database functions: all conflict rules, repeated delivery,
// tombstones, overlapping pulls, replacing everything, version protection, taking over, and the
// hints over Realtime. Two people of one household are the two devices.
describeRemoteContract(
  "SupabaseRemote (lokale Supabase-Instanz)",
  async () => {
    const { a, b } = await couple();
    return {
      a: new SupabaseRemote(a.client),
      b: new SupabaseRemote(b.client),
      device: (person, schemaVersion) =>
        new SupabaseRemote((person === "a" ? a : b).client, { schemaVersion }),
    };
  },
  { hintOnConnect: true },
);
