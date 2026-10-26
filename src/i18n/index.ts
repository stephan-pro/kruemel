// The texts of the app in the chosen language (EN-a). `t()` gives the texts of the language that is
// set right now; a component that calls it while drawing shows the new language when the app draws
// again after `setLanguage` (see `useLanguage`).
//
// To add a text: write it in `de.ts`, then in `en.ts` (the type checker insists). To add a language:
// add its code to `Language` in `language.ts`, write its file like `en.ts` and list it in
// `DICTIONARIES` below; the switch and the tests pick it up from `LANGUAGES`.

import { de, type Messages } from "./de";
import { en } from "./en";
import { getLanguage, type Language } from "./language";

export type { Messages } from "./de";

export const DICTIONARIES: Readonly<Record<Language, Messages>> = { de, en };

/** The texts in the language that is set. */
export function t(): Messages {
  return DICTIONARIES[getLanguage()];
}
