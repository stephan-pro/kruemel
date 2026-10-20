import { describe, expect, it } from "vitest";
import { d, oneOffTask, recurringTask, stateOf, tickOff } from "./task.fixtures";
import { type DayListInput, dayList } from "./today";

// Wednesday 21.10.2026.
const today = d("2026-10-21");

function list(overrides: Partial<DayListInput> = {}) {
  return dayList({
    tasks: [],
    completions: [],
    day: today,
    today,
    filter: "all",
    person: "personA",
    ...overrides,
  });
}

const ids = (entries: readonly { task: { id: string } }[]) => entries.map((e) => e.task.id);

describe("Heute: die Aufgaben des Tages", () => {
  it("Heute Überfälliges steht vor dem, was heute fällig ist, das Älteste zuerst", () => {
    const result = list({
      tasks: [
        recurringTask({ id: "heute-b", title: "B", dueDate: d("2026-10-21") }),
        recurringTask({ id: "heute-a", title: "A", dueDate: d("2026-10-21") }),
        recurringTask({ id: "neu", title: "Neu", dueDate: d("2026-10-20") }),
        recurringTask({ id: "alt", title: "Alt", dueDate: d("2026-10-17") }),
        recurringTask({ id: "spaeter", dueDate: d("2026-10-22") }),
      ],
    });

    expect(ids(result.open)).toEqual(["alt", "neu", "heute-a", "heute-b"]);
    expect(result.open.map((entry) => entry.daysOverdue)).toEqual([4, 1, 0, 0]);
  });

  it("Heute Ein anderer Tag zeigt nur, was an ihm fällig ist; Früheres ist dort überfällig markiert", () => {
    const tasks = [
      recurringTask({ id: "gestern", dueDate: d("2026-10-20") }),
      oneOffTask({ id: "morgen", dueDate: d("2026-10-22") }),
    ];

    expect(ids(list({ tasks, day: d("2026-10-22") }).open)).toEqual(["morgen"]);
    const yesterday = list({ tasks, day: d("2026-10-20") }).open;
    expect(ids(yesterday)).toEqual(["gestern"]);
    expect(yesterday[0]?.daysOverdue).toBe(1);
  });

  it("Heute Erledigtes steht an dem Tag, an dem es abgehakt wurde, auch wenn es früher fällig war", () => {
    const task = recurringTask({ id: "bad", dueDate: d("2026-10-19") });
    const done = tickOff(stateOf(task), "2026-10-21");
    const result = list({ tasks: [done.task], completions: done.completions });

    expect(ids(result.done)).toEqual(["bad"]);
    expect(result.done[0]?.completion.completedOn).toBe("2026-10-21");
    expect(
      list({ tasks: [done.task], completions: done.completions, day: d("2026-10-20") }).done,
    ).toEqual([]);
    // Das abgehakte Bad hat einen neuen Termin und ist nicht mehr offen.
    expect(result.open).toEqual([]);
  });

  it("Heute „Meine“ behält die eigenen Aufgaben und die für beide, auch beim Erledigten", () => {
    const mine = recurringTask({ id: "mine", title: "Bad", dueDate: today, assignee: "personA" });
    const both = recurringTask({ id: "both", title: "Alles", dueDate: today, assignee: "both" });
    const theirs = recurringTask({
      id: "theirs",
      title: "Zimmer",
      dueDate: today,
      assignee: "personB",
    });
    const doneTheirs = tickOff(stateOf(oneOffTask({ id: "x", dueDate: today })), "2026-10-21");
    const input = {
      tasks: [mine, both, theirs, doneTheirs.task],
      completions: doneTheirs.completions,
    };

    expect(ids(list({ ...input, filter: "mine" }).open)).toEqual(["both", "mine"]);
    expect(ids(list({ ...input, filter: "mine" }).done)).toEqual([]);
    expect(ids(list({ ...input, filter: "all" }).open)).toEqual(["both", "mine", "theirs"]);
    expect(ids(list({ ...input, filter: "all" }).done)).toEqual(["x"]);
  });

  it("Heute Eine Erledigung ohne Aufgabe wird übersprungen", () => {
    const done = tickOff(stateOf(oneOffTask({ id: "weg", dueDate: today })), "2026-10-21");

    expect(list({ tasks: [], completions: done.completions }).done).toEqual([]);
  });
});
