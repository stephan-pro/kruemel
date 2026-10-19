import { describe, expect, it } from "vitest";
import {
  DEFAULT_TAKE_OVER_MODE,
  effectiveAssignee,
  filterTasks,
  isMine,
  needsTakeOverChoice,
  reassign,
  takeOver,
} from "./assignment";
import {
  createOneOffTask,
  createRecurringTask,
  isAssignee,
  isPerson,
  undoCompletion,
} from "./task";
import { d, oneOffTask, recurringTask, stateOf, tickOff } from "./task.fixtures";

describe("F5 Zuständigkeit", () => {
  it("Jede Aufgabe ist fest Person A, Person B oder beiden zugewiesen", () => {
    for (const assignee of ["personA", "personB", "both"] as const) {
      const recurring = createRecurringTask({
        id: "t-1",
        title: "Staubsaugen",
        recurrence: { unit: "week", interval: 1 },
        assignee,
        dueDate: d("2026-10-19"),
      });
      const oneOff = createOneOffTask({
        id: "t-2",
        title: "Paket abholen",
        assignee,
        dueDate: d("2026-10-19"),
      });

      expect(effectiveAssignee(recurring)).toBe(assignee);
      expect(effectiveAssignee(oneOff)).toBe(assignee);
    }
  });

  it("(Entscheidung F5) Intern heißen die Personen personA und personB, nicht wie echte Menschen", () => {
    expect(isPerson("personA")).toBe(true);
    expect(isPerson("personB")).toBe(true);
    expect(isPerson("both")).toBe(false);
    expect(isPerson("Anna")).toBe(false);
    expect(isAssignee("both")).toBe(true);
    expect(isAssignee("Anna")).toBe(false);
  });

  it("Die Zuweisung ist jederzeit änderbar", () => {
    const recurring = reassign(recurringTask({ assignee: "personA" }), "personB");
    const oneOff = reassign(oneOffTask({ assignee: "personB" }), "both");

    expect(recurring.assignee).toBe("personB");
    expect(oneOff.assignee).toBe("both");
  });

  it("Eine ungültige Zuweisung wird abgelehnt", () => {
    expect(() => reassign(recurringTask(), "nobody" as unknown as "both")).toThrow(RangeError);
  });

  it("Eine neue feste Zuweisung beendet eine gerade laufende einmalige Übernahme", () => {
    const taken = takeOver(recurringTask({ assignee: "personA" }), "personB");

    const reassigned = reassign(taken, "both");

    expect(effectiveAssignee(reassigned)).toBe("both");
    expect(reassigned).not.toHaveProperty("takenOverBy");
  });

  describe("Übernehmen", () => {
    it("Die Vorauswahl beim Übernehmen ist „nur dieses Mal“", () => {
      const task = recurringTask({ assignee: "personA" });

      expect(DEFAULT_TAKE_OVER_MODE).toBe("once");
      expect(takeOver(task, "personB")).toEqual(takeOver(task, "personB", "once"));
      expect(effectiveAssignee(takeOver(task, "personB"))).toBe("personB");
    });

    it("„Nur dieses Mal“: beim nächsten Zyklus gilt wieder die feste Zuweisung", () => {
      const taken = takeOver(recurringTask({ assignee: "personA" }), "personB", "once");
      expect(taken.assignee).toBe("personA");
      expect(effectiveAssignee(taken)).toBe("personB");

      const ticked = tickOff(stateOf(taken), "2026-10-21", "c-1", "personB");

      expect(effectiveAssignee(ticked.task)).toBe("personA");
      expect(ticked.task).not.toHaveProperty("takenOverBy");
    });

    it("„Dauerhaft“: die Person wird fest zugewiesen und bleibt es nach dem Abhaken", () => {
      const taken = takeOver(recurringTask({ assignee: "personA" }), "personB", "permanently");
      expect(taken.assignee).toBe("personB");

      const ticked = tickOff(stateOf(taken), "2026-10-21", "c-1", "personB");

      expect(effectiveAssignee(ticked.task)).toBe("personB");
    });

    it("„Dauerhaft“ ersetzt auch eine „nur dieses Mal“ laufende Übernahme", () => {
      const once = takeOver(recurringTask({ assignee: "personA" }), "personB", "once");

      const permanent = takeOver(once, "personA", "permanently");

      expect(permanent.assignee).toBe("personA");
      expect(permanent).not.toHaveProperty("takenOverBy");
    });

    it("„Nur dieses Mal“ durch die fest zugewiesene Person beendet die Übernahme einer anderen", () => {
      const once = takeOver(recurringTask({ assignee: "personA" }), "personB", "once");

      const back = takeOver(once, "personA", "once");

      expect(effectiveAssignee(back)).toBe("personA");
      expect(back).not.toHaveProperty("takenOverBy");
    });

    it("Wer eine Aufgabe für „beide“ nur dieses Mal übernimmt, ist allein zuständig", () => {
      const taken = takeOver(recurringTask({ assignee: "both" }), "personB", "once");

      expect(effectiveAssignee(taken)).toBe("personB");
      expect(taken.assignee).toBe("both");
    });

    it("Rückgängig stellt eine „nur dieses Mal“ übernommene Aufgabe wieder her", () => {
      const before = stateOf(takeOver(recurringTask({ assignee: "personA" }), "personB"));
      const ticked = tickOff(before, "2026-10-21", "c-1", "personB");

      const restored = undoCompletion(ticked, "c-1");

      expect(restored).toEqual(before);
      expect(effectiveAssignee(restored.task)).toBe("personB");
    });

    it("(Entscheidung F3/F5) Übernehmen weist eine einmalige Aufgabe ohne Rückfrage um", () => {
      const task = oneOffTask({ assignee: "personA" });

      expect(needsTakeOverChoice(task)).toBe(false);
      expect(takeOver(task, "personB").assignee).toBe("personB");
      expect(takeOver(task, "personB", "once").assignee).toBe("personB");
      expect(takeOver(task, "personB", "permanently").assignee).toBe("personB");
    });

    it("Bei einer wiederkehrenden Aufgabe fragt „Übernehmen“ nach: nur dieses Mal oder dauerhaft", () => {
      expect(needsTakeOverChoice(recurringTask())).toBe(true);
    });

    it("Übernehmen kann nur Person A oder Person B, nicht „beide“", () => {
      expect(() => takeOver(recurringTask(), "both" as unknown as "personA")).toThrow(RangeError);
    });
  });

  describe("Erledigt von", () => {
    it("Beim Abhaken wird gespeichert, wer die Aufgabe erledigt hat", () => {
      const byA = tickOff(stateOf(recurringTask()), "2026-10-21", "c-1", "personA");
      const byB = tickOff(stateOf(oneOffTask()), "2026-10-21", "c-2", "personB");

      expect(byA.completions[0]?.completedBy).toBe("personA");
      expect(byB.completions[0]?.completedBy).toBe("personB");
    });

    it("Wer eine Aufgabe erledigt, muss nicht die zuständige Person sein", () => {
      const ticked = tickOff(
        stateOf(recurringTask({ assignee: "personA" })),
        "2026-10-21",
        "c-1",
        "personB",
      );

      expect(ticked.completions[0]?.completedBy).toBe("personB");
    });
  });

  describe("Beide", () => {
    it("(Entscheidung F5) Bei „beide“ reicht ein Abhaken; es zählt als ein Durchgang", () => {
      const task = recurringTask({ assignee: "both" });

      const ticked = tickOff(stateOf(task), "2026-10-21", "c-1", "personB");

      expect(ticked.completions).toHaveLength(1);
      expect(ticked.task.dueDate).toBe("2026-10-28");
      expect(ticked.completions[0]?.completedBy).toBe("personB");
    });

    it("(Entscheidung F5) Eine Aufgabe für „beide“ erscheint bei „nur meine“ für beide Personen", () => {
      const both = oneOffTask({ id: "both", assignee: "both" });

      expect(isMine(both, "personA")).toBe(true);
      expect(isMine(both, "personB")).toBe(true);
      expect(filterTasks([both], "mine", "personA")).toEqual([both]);
      expect(filterTasks([both], "mine", "personB")).toEqual([both]);
    });
  });

  describe("Filter alle / nur meine", () => {
    const a = recurringTask({ id: "a", assignee: "personA" });
    const b = oneOffTask({ id: "b", assignee: "personB" });
    const both = recurringTask({ id: "both", assignee: "both" });
    const tasks = [a, b, both];

    it("„Alle“ zeigt jede Aufgabe, „nur meine“ die der gewählten Person", () => {
      expect(filterTasks(tasks, "all", "personA").map((task) => task.id)).toEqual([
        "a",
        "b",
        "both",
      ]);
      expect(filterTasks(tasks, "mine", "personA").map((task) => task.id)).toEqual(["a", "both"]);
      expect(filterTasks(tasks, "mine", "personB").map((task) => task.id)).toEqual(["b", "both"]);
    });

    it("Eine „nur dieses Mal“ übernommene Aufgabe erscheint bei der übernehmenden Person, nicht mehr bei der bisherigen", () => {
      const taken = takeOver(a, "personB", "once");

      expect(filterTasks([taken], "mine", "personB")).toEqual([taken]);
      expect(filterTasks([taken], "mine", "personA")).toEqual([]);
    });
  });
});
