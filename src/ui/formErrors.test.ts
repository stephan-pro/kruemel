import { afterEach, describe, expect, it } from "vitest";
import { checkPersonNames } from "../domain/personNames";
import { checkTaskForm, type TaskFormError, type TaskFormInput } from "../domain/taskForm";
import { resetLanguage, setLanguage } from "../i18n/language";
import { personNameErrorText, taskFormErrorText } from "./formErrors";

afterEach(() => resetLanguage());

const valid: TaskFormInput = {
  title: "Bad putzen",
  symbol: "standard",
  dueDate: "2026-10-19",
  assignee: "personA",
  note: "",
  interval: "2",
  unit: "week",
};

/** The sentences of the first error of each field, for a form with all of them wrong. */
function sentences(): string[] {
  const result = checkTaskForm("recurring", {
    title: "",
    symbol: "",
    dueDate: "1999-01-01",
    assignee: "",
    note: "x".repeat(501),
    interval: "9999",
    unit: "year",
    checklist: [{ id: "a", text: " ", checked: false }],
  });
  return result.ok ? [] : Object.values(result.errors).map(taskFormErrorText);
}

describe("EN-b Formularfehler in Worte gefasst", () => {
  it("Jeder Fehlercode des Aufgabenformulars hat einen Satz, mit seiner Grenze, auf Deutsch", () => {
    const all: TaskFormError[] = [
      { code: "titleEmpty" },
      { code: "titleTooLong", limit: 80 },
      { code: "dateEmpty" },
      { code: "dateInvalid" },
      { code: "dateOutOfRange" },
      { code: "symbolMissing" },
      { code: "assigneeMissing" },
      { code: "noteTooLong", limit: 500 },
      { code: "checklistTooMany", limit: 50 },
      { code: "checklistItemInvalid", limit: 80 },
      { code: "checklistTextEmpty" },
      { code: "checklistTextTooLong", limit: 80 },
      { code: "intervalEmpty" },
      { code: "intervalInvalid" },
      { code: "intervalTooBig", limit: 365 },
      { code: "unitMissing" },
    ];
    const german = all.map(taskFormErrorText);
    expect(german).toContain("Der Titel darf höchstens 80 Zeichen lang sein.");
    expect(german).toContain("Bitte ein Datum zwischen 2000 und 2100 wählen.");
    expect(german).toContain("Bitte höchstens 365 eingeben.");
    expect(new Set(german).size).toBe(all.length);

    setLanguage("en");
    const english = all.map(taskFormErrorText);
    expect(english).toContain("The title can have at most 80 characters.");
    expect(english).toContain("Please choose a date between 2000 and 2100.");
    expect(english).toContain("Please enter 365 at most.");
    expect(new Set(english).size).toBe(all.length);
    for (const [index, sentence] of english.entries()) {
      expect(sentence, all[index]?.code).not.toBe(german[index]);
    }
  });

  it("Die Fehler eines ganz falschen Formulars werden in der gewählten Sprache gesagt", () => {
    expect(checkTaskForm("recurring", valid).ok).toBe(true);
    expect(sentences()).toContain("Bitte einen Titel eingeben.");
    setLanguage("en");
    expect(sentences()).toContain("Please enter a title.");
    expect(sentences()).toHaveLength(8);
  });

  it("Namen: leer, zu lang, gleich – und die Höchstlänge steht im Satz", () => {
    const sentenceOf = (a: string, b: string) => {
      const result = checkPersonNames({ personA: a, personB: b });
      return result.ok
        ? []
        : Object.values(result.errors).map((error) => personNameErrorText(error));
    };

    expect(sentenceOf("", "Robin")).toEqual(["Bitte einen Namen eingeben."]);
    expect(sentenceOf("x".repeat(31), "Robin")).toEqual([
      "Der Name darf höchstens 30 Zeichen lang sein.",
    ]);
    expect(sentenceOf("Alex", "alex")).toEqual(["Die beiden Namen müssen sich unterscheiden."]);
    setLanguage("en");
    expect(sentenceOf("", "Robin")).toEqual(["Please enter a name."]);
    expect(sentenceOf("x".repeat(31), "Robin")).toEqual([
      "The name can have at most 30 characters.",
    ]);
    expect(sentenceOf("Alex", "alex")).toEqual(["The two names must differ."]);
  });
});
