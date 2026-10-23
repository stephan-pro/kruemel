// What the device remembers about the household (stage 2), next to the session:
// - the household of the signed-in person, so the app also starts without network;
// - an invite opened by its link, until the person has signed in and accepted or dismissed it
//   (signing in may reload the app on a phone, see `signInStep.ts`).

import type { HouseholdInfo } from "../auth/household";

const HOUSEHOLD_KEY = "kruemel:household";
const INVITE_KEY = "kruemel:invite";

interface Remembered {
  readonly userId: string;
  readonly household: HouseholdInfo;
}

function read(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

/** Writes `value`, or removes the entry (`undefined`). Without storage nothing is remembered. */
function write(key: string, value: unknown): void {
  try {
    if (value === undefined) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    // The app then asks the server each time.
  }
}

/** The household last seen for this person on this device. */
export function rememberedHousehold(userId: string): HouseholdInfo | undefined {
  const stored = read(HOUSEHOLD_KEY) as Partial<Remembered> | null;
  return stored?.userId === userId && typeof stored.household?.id === "string"
    ? stored.household
    : undefined;
}

export function rememberHousehold(userId: string, household: HouseholdInfo | null): void {
  write(HOUSEHOLD_KEY, household === null ? undefined : { userId, household });
}

export function forgetHousehold(): void {
  write(HOUSEHOLD_KEY, undefined);
}

/** The token of an invite that was opened but not yet accepted or dismissed. */
export function pendingInvite(): string | undefined {
  const token = read(INVITE_KEY);
  return typeof token === "string" && token !== "" ? token : undefined;
}

export function rememberInvite(token: string | undefined): void {
  write(INVITE_KEY, token);
}
