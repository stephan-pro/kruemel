// The names of the two people (F5), chosen once on first start. Only the rules about what counts
// as a valid pair live here; where the names are kept is up to the storage.

import type { Person } from "./task";

/** Longest name accepted; longer ones would break the layout on a phone. */
export const MAX_NAME_LENGTH = 30;

export interface PersonNameInput {
  readonly personA: string;
  readonly personB: string;
}

/** One message per field that is wrong; fields that are fine are missing. */
export type PersonNameErrors = Partial<Record<Person, string>>;

export type PersonNamesResult =
  | { readonly ok: true; readonly names: PersonNameInput }
  | { readonly ok: false; readonly errors: PersonNameErrors };

function nameError(name: string): string | undefined {
  if (name === "") {
    return "Bitte einen Namen eingeben.";
  }
  if (name.length > MAX_NAME_LENGTH) {
    return `Der Name darf höchstens ${MAX_NAME_LENGTH} Zeichen lang sein.`;
  }
  return undefined;
}

/** Trims both names and checks that each is filled and that the two can be told apart. */
export function checkPersonNames(input: PersonNameInput): PersonNamesResult {
  const names = { personA: input.personA.trim(), personB: input.personB.trim() };
  const errors: { personA?: string; personB?: string } = {};
  const errorA = nameError(names.personA);
  const errorB = nameError(names.personB);
  if (errorA !== undefined) {
    errors.personA = errorA;
  }
  if (errorB !== undefined) {
    errors.personB = errorB;
  }
  if (
    errorA === undefined &&
    errorB === undefined &&
    names.personA.toLocaleLowerCase("de") === names.personB.toLocaleLowerCase("de")
  ) {
    errors.personB = "Die beiden Namen müssen sich unterscheiden.";
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, names };
}
