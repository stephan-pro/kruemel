import { useEffect, useRef, useState } from "preact/hooks";
import type { HouseholdApi, HouseholdInfo } from "../auth/household";
import { forgetHousehold, rememberedHousehold, rememberHousehold } from "./householdMemory";

export type HouseholdState =
  | { readonly status: "loading" }
  /** `household` is `null` while the person has none. */
  | { readonly status: "ready"; readonly household: HouseholdInfo | null }
  /** Not readable and none remembered on this device; `cause` becomes a sentence when drawn. */
  | { readonly status: "failed"; readonly cause: unknown };

/**
 * The household of the signed-in person (stage 2). The one remembered on the device is shown at
 * once (also offline); the server is asked in the background and its answer wins. Without `api`
 * or without a session it stays "loading" and is not used. When the server says the person has no
 * household any more while one is shown (removed, or left on another device; E2-5a), `onGone`
 * decides what happens instead of showing "none" at once.
 */
export function useHousehold(
  api: HouseholdApi | undefined,
  userId: string | undefined,
  onGone?: () => void,
) {
  const [state, setState] = useState<HouseholdState>({ status: "loading" });
  /** Counts the households shown; an answer to an older question must not undo a newer one. */
  const shown = useRef(0);
  const current = useRef<HouseholdInfo | null>(null);
  const gone = useRef(onGone);
  gone.current = onGone;

  function show(household: HouseholdInfo | null) {
    shown.current += 1;
    current.current = household;
    if (userId !== undefined) {
      rememberHousehold(userId, household);
    }
    setState({ status: "ready", household });
  }

  async function refresh() {
    if (api === undefined || userId === undefined) {
      return;
    }
    const asked = shown.current;
    try {
      const household = await api.current();
      if (shown.current !== asked) {
        return;
      }
      if (household === null && current.current !== null && gone.current !== undefined) {
        gone.current();
      } else {
        show(household);
      }
    } catch (error) {
      // Offline with a remembered household: keep showing it.
      setState((current) =>
        current.status === "ready" ? current : { status: "failed", cause: error },
      );
    }
  }

  useEffect(() => {
    if (api === undefined || userId === undefined) {
      current.current = null;
      setState({ status: "loading" });
      return;
    }
    const remembered = rememberedHousehold(userId);
    current.current = remembered ?? null;
    setState(
      remembered === undefined ? { status: "loading" } : { status: "ready", household: remembered },
    );
    void refresh();
  }, [api, userId]);

  /** Asks again, showing "loading" while nothing is known (after "Erneut versuchen"). */
  function retry() {
    setState((current) => (current.status === "failed" ? { status: "loading" } : current));
    void refresh();
  }

  return { state, show, refresh, retry, forget: forgetHousehold };
}
