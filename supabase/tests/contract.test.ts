import { describeRemoteContract } from "../../src/sync/remote.contract";
import { rpcRemote } from "./rpcRemote";
import { couple } from "./setup";

// The same series of tests as for the fake (`FakeRemote`, fake server): all conflict rules,
// repeated delivery, tombstones, overlapping pulls, replacing everything. Two people of one
// household are the two devices. Realtime hints follow with the app's `Remote` in E2-3.
describeRemoteContract(
  "Datenbankfunktionen (lokale Supabase-Instanz)",
  async () => {
    const { a, b } = await couple();
    return { a: rpcRemote(a.client), b: rpcRemote(b.client) };
  },
  { hints: false },
);
