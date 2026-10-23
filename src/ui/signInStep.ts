// Where the sign-in stands while the person reads the mail: the address and when the code was
// sent. Kept on the device, because a phone often reloads the app after switching to the mail app;
// without it the person would land on the first step again and have to wait for a new code.

import { CODE_MINUTES } from "../auth/auth";

const STEP_KEY = "kruemel:sign-in";

export interface CodeStep {
  readonly email: string;
  /** Milliseconds since 1970. */
  readonly sentAt: number;
}

/** The step remembered on this device while its code is still valid. */
export function rememberedStep(now: number = Date.now()): CodeStep | undefined {
  try {
    const step = JSON.parse(localStorage.getItem(STEP_KEY) ?? "null") as Partial<CodeStep> | null;
    if (
      typeof step?.email === "string" &&
      typeof step.sentAt === "number" &&
      now - step.sentAt < CODE_MINUTES * 60_000
    ) {
      return { email: step.email, sentAt: step.sentAt };
    }
  } catch {
    // Unreadable or no storage: start with the address again.
  }
  return undefined;
}

/** Remembers the step, or forgets it (`undefined`). Without storage nothing is remembered. */
export function rememberStep(step: CodeStep | undefined): void {
  try {
    if (step === undefined) {
      localStorage.removeItem(STEP_KEY);
    } else {
      localStorage.setItem(STEP_KEY, JSON.stringify(step));
    }
  } catch {
    // see rememberedStep
  }
}
