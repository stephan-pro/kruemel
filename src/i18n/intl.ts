// Dates, times, numbers and plurals through `Intl` in the chosen language. The sentences around
// them (patterns, abbreviations) are in the language files, so a pattern is never glued together
// from pieces in code.

import type { CalendarDay } from "../domain/date";
import type { Language } from "./language";

/** The locale used for each language. English uses the British forms: 24-hour clock, day first. */
const LOCALES: Readonly<Record<Language, string>> = { de: "de-DE", en: "en-GB" };

const formatters = new Map<string, Intl.DateTimeFormat>();

function dateFormatter(language: Language, options: Intl.DateTimeFormatOptions) {
  const key = `${language}:${JSON.stringify(options)}`;
  let formatter = formatters.get(key);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat(LOCALES[language], options);
    formatters.set(key, formatter);
  }
  return formatter;
}

/** A calendar day as a moment that reads the same in every time zone. */
function utcMoment(day: CalendarDay): number {
  return Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
}

/** "Montag" / "Monday" */
export function weekdayLong(language: Language, day: CalendarDay): string {
  return dateFormatter(language, { weekday: "long", timeZone: "UTC" }).format(utcMoment(day));
}

/** "Oktober" / "October" for a month of 1 to 12. */
export function monthLong(language: Language, month: number): string {
  return dateFormatter(language, { month: "long", timeZone: "UTC" }).format(
    Date.UTC(2000, month - 1, 1),
  );
}

/** "08:12" – the local time of day. */
export function timeOfDay(language: Language, moment: Date): string {
  return dateFormatter(language, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    moment,
  );
}

const numberFormatters = new Map<Language, Intl.NumberFormat>();

/** "1.234" / "1,234" */
export function formatNumber(language: Language, value: number): string {
  let formatter = numberFormatters.get(language);
  if (formatter === undefined) {
    formatter = new Intl.NumberFormat(LOCALES[language]);
    numberFormatters.set(language, formatter);
  }
  return formatter.format(value);
}

/** The texts of a count: `{n}` is replaced by the number. `zero` is for a count of 0, if given. */
export interface PluralForms {
  readonly zero?: string;
  readonly one: string;
  readonly other: string;
}

const rules = new Map<Language, Intl.PluralRules>();

/**
 * Picks the form of a count by the language's own plural rules: "1 Aufgabe" / "3 Aufgaben",
 * "1 task" / "3 tasks". Whole sentences, so no language has to follow the other's word order.
 */
export function plural(language: Language, count: number, forms: PluralForms): string {
  let selector = rules.get(language);
  if (selector === undefined) {
    selector = new Intl.PluralRules(LOCALES[language]);
    rules.set(language, selector);
  }
  const form =
    count === 0 && forms.zero !== undefined
      ? forms.zero
      : selector.select(count) === "one"
        ? forms.one
        : forms.other;
  return form.replace("{n}", formatNumber(language, count));
}
