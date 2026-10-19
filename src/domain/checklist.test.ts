import { describe, expect, it } from "vitest";
import {
  addChecklistItem,
  checkedItemIds,
  removeChecklistItem,
  resetChecklistChecks,
  restoreChecklistChecks,
  setChecklistItemChecked,
} from "./checklist";
import { type RecurringTask, undoCompletion } from "./task";
import { oneOffTask, recurringTask, stateOf, tickOff } from "./task.fixtures";

/** Bad putzen with three steps; "Toilette" is ticked. */
function bathroom(): RecurringTask {
  return recurringTask({
    checklist: [
      { id: "i-1", text: "Waschbecken", checked: false },
      { id: "i-2", text: "Toilette", checked: true },
      { id: "i-3", text: "Dusche", checked: false },
    ],
  });
}

describe("F4 Checklisten", () => {
  it("Jede Aufgabe kann eine Checkliste haben, einmalige wie wiederkehrende", () => {
    const shopping = addChecklistItem(oneOffTask(), { id: "i-1", text: "Milch" });
    const cleaning = addChecklistItem(recurringTask(), { id: "i-1", text: "Waschbecken" });

    expect(shopping.checklist).toEqual([{ id: "i-1", text: "Milch", checked: false }]);
    expect(cleaning.checklist).toEqual([{ id: "i-1", text: "Waschbecken", checked: false }]);
  });

  it("Einträge werden am Ende hinzugefügt und der Text wird gekürzt", () => {
    const task = addChecklistItem(bathroom(), { id: "i-4", text: "  Spiegel " });

    expect(task.checklist.map((item) => item.text)).toEqual([
      "Waschbecken",
      "Toilette",
      "Dusche",
      "Spiegel",
    ]);
  });

  it("Ein Eintrag ohne Text oder mit doppelter Kennung wird abgelehnt", () => {
    expect(() => addChecklistItem(bathroom(), { id: "i-4", text: "   " })).toThrow(RangeError);
    expect(() => addChecklistItem(bathroom(), { id: "i-1", text: "Noch mal" })).toThrow(RangeError);
  });

  it("Einträge lassen sich einzeln abhaken, ohne die anderen zu ändern", () => {
    const task = setChecklistItemChecked(bathroom(), "i-1", true);

    expect(task.checklist.map((item) => item.checked)).toEqual([true, true, false]);
  });

  it("Ein abgehakter Eintrag lässt sich wieder abwählen", () => {
    const task = setChecklistItemChecked(bathroom(), "i-2", false);

    expect(task.checklist.map((item) => item.checked)).toEqual([false, false, false]);
  });

  it("Einträge lassen sich löschen, die übrigen behalten Reihenfolge und Häkchen", () => {
    const task = removeChecklistItem(bathroom(), "i-1");

    expect(task.checklist).toEqual([
      { id: "i-2", text: "Toilette", checked: true },
      { id: "i-3", text: "Dusche", checked: false },
    ]);
  });

  it("Abhaken oder Löschen eines unbekannten Eintrags wird abgelehnt", () => {
    expect(() => setChecklistItemChecked(bathroom(), "gibt-es-nicht", true)).toThrow(RangeError);
    expect(() => removeChecklistItem(bathroom(), "gibt-es-nicht")).toThrow(RangeError);
  });

  it("Die Änderungen an einer Checkliste verändern die übergebene Aufgabe nicht", () => {
    const before = bathroom();

    setChecklistItemChecked(before, "i-1", true);
    addChecklistItem(before, { id: "i-4", text: "Spiegel" });
    removeChecklistItem(before, "i-3");

    expect(before).toEqual(bathroom());
  });

  it("(Entscheidung F4) Beim Abhaken einer wiederkehrenden Aufgabe werden alle Häkchen zurückgesetzt, die Einträge bleiben", () => {
    const before = setChecklistItemChecked(bathroom(), "i-3", true);
    expect(checkedItemIds(before)).toEqual(["i-2", "i-3"]);

    const ticked = tickOff(stateOf(before), "2026-10-21");

    expect(ticked.task.checklist).toEqual([
      { id: "i-1", text: "Waschbecken", checked: false },
      { id: "i-2", text: "Toilette", checked: false },
      { id: "i-3", text: "Dusche", checked: false },
    ]);
  });

  it("Bei einer einmaligen Aufgabe bleiben die Häkchen nach dem Abhaken erhalten", () => {
    const shopping = setChecklistItemChecked(
      addChecklistItem(addChecklistItem(oneOffTask(), { id: "i-1", text: "Milch" }), {
        id: "i-2",
        text: "Brot",
      }),
      "i-1",
      true,
    );

    const ticked = tickOff(stateOf(shopping), "2026-10-21");

    expect(ticked.task.checklist.map((item) => item.checked)).toEqual([true, false]);
  });

  it("(Entscheidung F4) Rückgängig stellt die Häkchen einer wiederkehrenden Aufgabe wieder her", () => {
    const before = stateOf(bathroom());
    const ticked = tickOff(before, "2026-10-21");

    const restored = undoCompletion(ticked, "c-1");

    expect(restored).toEqual(before);
    expect(checkedItemIds(restored.task)).toEqual(["i-2"]);
  });

  it("Rückgängig stellt nur Häkchen für Einträge wieder her, die es noch gibt", () => {
    const ticked = tickOff(stateOf(bathroom()), "2026-10-21");
    const edited = {
      ...ticked,
      task: removeChecklistItem(ticked.task, "i-2"),
    };

    const restored = undoCompletion(edited, "c-1");

    expect(restored.task.checklist.map((item) => item.id)).toEqual(["i-1", "i-3"]);
    expect(checkedItemIds(restored.task)).toEqual([]);
  });

  it("Die Häkchen lassen sich auch ohne Abhaken zurücksetzen und gezielt setzen", () => {
    expect(checkedItemIds(resetChecklistChecks(bathroom()))).toEqual([]);
    expect(checkedItemIds(restoreChecklistChecks(bathroom(), ["i-1", "i-3", "weg"]))).toEqual([
      "i-1",
      "i-3",
    ]);
  });
});
