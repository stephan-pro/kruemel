import { describe, expect, it } from "vitest";
import { filterTasks, isMine } from "../domain/assignment";
import { type CalendarDay, calendarDay, compareDays, daysBetween } from "../domain/date";
import { doneEntries } from "../domain/done";
import { openTasks } from "../domain/task";
import { d } from "../domain/task.fixtures";
import { taskSymbol } from "../domain/taskSymbols";
import { exportData, importData } from "../storage/exportImport";
import { parseAppData } from "../storage/validate";
import { DEMO_NAMES, demoData } from "./demoData";

const today = d("2026-10-19");

describe("Beispieldaten (Q8)", () => {
  it("sind gültige App-Daten, auch nach einem Durchgang durch JSON", () => {
    const result = parseAppData(JSON.parse(JSON.stringify(demoData(today))));
    expect(result.ok).toBe(true);
  });

  it("lassen sich exportieren und wieder importieren", () => {
    const data = demoData(today);
    expect(importData(exportData(data))).toEqual({ ok: true, data });
  });

  it("EN-c gibt es auch auf Englisch: dieselben Aufgaben, Ids und Termine, nur die Wörter sind englisch", () => {
    const german = demoData(today);
    const english = demoData(today, "en");

    expect(parseAppData(JSON.parse(JSON.stringify(english))).ok).toBe(true);
    const shape = (data: typeof german) =>
      data.tasks.map((task) => ({
        id: task.id,
        dueDate: task.dueDate,
        symbol: task.symbol,
        assignee: task.assignee,
        items: task.checklist.map((item) => [item.id, item.checked]),
      }));
    expect(shape(english)).toEqual(shape(german));
    expect(english.completions).toEqual(german.completions);
    for (const [index, task] of english.tasks.entries()) {
      expect(task.title.trim(), task.id).not.toBe("");
      expect(task.title, task.id).not.toBe(german.tasks[index]?.title);
      for (const item of task.checklist) {
        expect(item.text.trim()).not.toBe("");
      }
    }
    expect(english.tasks.map((task) => task.title)).toContain("Clean the bathroom");
    // German is the default, as before.
    expect(demoData(today, "de")).toEqual(german);
  });

  it("sind gültig, egal an welchem Tag man sie erzeugt (auch Monatsende und Schaltjahr)", () => {
    for (const day of ["2026-01-31", "2028-02-29", "2026-12-31", "2026-03-01"]) {
      expect(parseAppData(demoData(calendarDay(day))).ok).toBe(true);
    }
  });

  it("verwenden die erfundenen Namen und alle drei Zuständigkeiten", () => {
    const data = demoData(today);
    expect(data.settings.personNames).toEqual(DEMO_NAMES);
    expect(new Set(data.tasks.map((task) => task.assignee))).toEqual(
      new Set(["personA", "personB", "both"]),
    );
  });

  it("haben eindeutige Ids bei Aufgaben, Erledigungen und Checklisten-Einträgen", () => {
    const data = demoData(today);
    const taskIds = data.tasks.map((task) => task.id);
    const completionIds = data.completions.map((completion) => completion.id);
    const itemIds = data.tasks.flatMap((task) => task.checklist.map((item) => item.id));
    for (const ids of [taskIds, completionIds, itemIds]) {
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("liegen relativ zu heute: Überfälliges, heute Fälliges und Kommendes sind dabei", () => {
    const open = openTasks(demoData(today).tasks);
    const offsets = open.map((task) => daysBetween(today, task.dueDate));
    expect(offsets.some((offset) => offset < 0)).toBe(true);
    expect(offsets).toContain(0);
    expect(offsets.some((offset) => offset > 0 && offset <= 6)).toBe(true);
    expect(offsets.some((offset) => offset > 6)).toBe(true);
  });

  it("verschieben sich mit heute: gleiche Aufgaben, gleiche Abstände (ohne Monatsrhythmus)", () => {
    const offsets = (day: CalendarDay) =>
      demoData(day)
        .tasks.filter((task) => task.id !== "demo-fenster")
        .map((task) => [task.id, daysBetween(day, task.dueDate)]);
    expect(offsets(calendarDay("2027-03-05"))).toEqual(offsets(today));
  });

  it("enthalten eine erledigte einmalige Aufgabe und keine Erledigung in der Zukunft", () => {
    const data = demoData(today);
    expect(data.tasks.some((task) => task.kind === "oneOff" && task.done)).toBe(true);
    for (const completion of data.completions) {
      expect(compareDays(completion.completedOn, today)).toBeLessThanOrEqual(0);
    }
  });

  it("zeigen in „Erledigt“ einen Verlauf mit beiden Personen; nur das letzte Abhaken lässt sich zurücknehmen", () => {
    const { tasks, completions } = demoData(today);
    const entries = doneEntries(tasks, completions);
    expect(entries).toHaveLength(completions.length);
    expect(new Set(entries.map((entry) => entry.completion.completedBy))).toEqual(
      new Set(["personA", "personB"]),
    );
    const undoable = entries.filter((entry) => entry.canUndo).length;
    expect(undoable).toBeLessThan(entries.length);
    expect(undoable).toBe(new Set(completions.map((completion) => completion.taskId)).size);
  });

  it("enthalten eine Übernahme „nur dieses Mal“ und Checklisten mit und ohne Häkchen", () => {
    const { tasks } = demoData(today);
    expect(tasks.some((task) => task.kind === "recurring" && task.takenOverBy !== undefined)).toBe(
      true,
    );
    const items = tasks.flatMap((task) => task.checklist);
    expect(items.some((item) => item.checked)).toBe(true);
    expect(items.some((item) => !item.checked)).toBe(true);
  });

  it("F8 haben die aktuelle schemaVersion und passende Symbole in allen drei Tönen, eine Aufgabe mit Standardsymbol", () => {
    const data = demoData(today);
    expect(data.schemaVersion).toBe(3);
    const symbols = data.tasks.map((task) => task.symbol);
    expect(symbols).toContain("standard");
    expect(new Set(symbols).size).toBeGreaterThan(data.tasks.length / 2);
    expect(new Set(symbols.map((symbol) => taskSymbol(symbol).tone))).toEqual(
      new Set(["blue", "green", "orange"]),
    );
  });

  it("geben jeder Person und dem Filter „nur meine“ etwas zu tun, aber nicht alles", () => {
    const open = openTasks(demoData(today).tasks);
    for (const person of ["personA", "personB"] as const) {
      const mine = filterTasks(open, "mine", person);
      expect(mine.length).toBeGreaterThan(0);
      expect(mine.every((task) => isMine(task, person))).toBe(true);
      expect(mine.length).toBeLessThan(open.length);
    }
  });
});
