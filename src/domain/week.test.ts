import { describe, expect, it } from "vitest";
import type { Completion, Task } from "./task";
import { d, oneOffTask, recurringTask, stateOf, tickOff } from "./task.fixtures";
import { type WeekEntry, type WeekViewInput, weekView } from "./week";

// Wednesday 21.10.2026; the current week is Monday 19.10. to Sunday 25.10.
const today = d("2026-10-21");

function view(tasks: readonly Task[], overrides: Partial<WeekViewInput> = {}) {
  return weekView({
    tasks,
    completions: [],
    shownDay: today,
    today,
    filter: "all",
    person: "personA",
    ...overrides,
  });
}

function ids(entries: readonly WeekEntry[]): string[] {
  return entries.map((entry) => entry.task.id);
}

function entriesOn(result: ReturnType<typeof view>, day: string): string[] {
  return ids(result.days.find((candidate) => candidate.day === day)?.entries ?? []);
}

describe("F6 Wochenübersicht: die Woche", () => {
  it("F6 Die Woche zeigt Montag bis Sonntag, auch wenn man einen anderen Tag der Woche übergibt", () => {
    const fromWednesday = view([]);
    const fromSunday = view([], { shownDay: d("2026-10-25") });

    const expected = [
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ];
    expect(fromWednesday.days.map((day) => day.day)).toEqual(expected);
    expect(fromSunday.days.map((day) => day.day)).toEqual(expected);
  });

  it("F6 Jede fällige Aufgabe steht an ihrem Tag", () => {
    const result = view([
      recurringTask({ id: "mo", dueDate: d("2026-10-26") }),
      recurringTask({ id: "mi", dueDate: d("2026-10-21") }),
      oneOffTask({ id: "so", dueDate: d("2026-10-25") }),
    ]);

    expect(entriesOn(result, "2026-10-21")).toEqual(["mi"]);
    expect(entriesOn(result, "2026-10-25")).toEqual(["so"]);
    // Montag der nächsten Woche gehört nicht mehr zu dieser Woche.
    expect(result.days.flatMap((day) => ids(day.entries))).toEqual(["mi", "so"]);
  });

  it("F6 Der heutige Tag ist hervorgehoben, kein anderer", () => {
    const result = view([]);

    expect(result.days.filter((day) => day.isToday).map((day) => day.day)).toEqual(["2026-10-21"]);
  });

  it("F6 In einer anderen Woche ist kein Tag der heutige", () => {
    expect(view([], { shownDay: d("2026-10-28") }).days.some((day) => day.isToday)).toBe(false);
  });

  it("F6 Innerhalb eines Tages stehen die Aufgaben nach Titel sortiert", () => {
    const result = view([
      oneOffTask({ id: "z", title: "Zeitung holen", dueDate: today }),
      oneOffTask({ id: "a", title: "Äpfel kaufen", dueDate: today }),
      oneOffTask({ id: "b", title: "Bad putzen", dueDate: today }),
    ]);

    expect(entriesOn(result, today)).toEqual(["a", "b", "z"]);
  });

  it("F6 Die übergebenen Aufgaben werden nicht verändert", () => {
    const tasks = [
      oneOffTask({ id: "b", title: "B", dueDate: today }),
      oneOffTask({ id: "a", title: "A", dueDate: today }),
    ];

    view(tasks);

    expect(tasks.map((task) => task.id)).toEqual(["b", "a"]);
  });
});

describe("F6 Wochenübersicht: Überfälliges steht oben", () => {
  it("F6 Eine überfällige Aufgabe steht im Überfällig-Block und nicht an ihrem alten Tag", () => {
    const result = view([recurringTask({ id: "bad", dueDate: d("2026-10-19") })]);

    expect(ids(result.overdue)).toEqual(["bad"]);
    expect(entriesOn(result, "2026-10-19")).toEqual([]);
  });

  it("F6 Der Block nennt, wie viele Tage die Aufgabe überfällig ist", () => {
    const result = view([
      recurringTask({ id: "alt", dueDate: d("2026-10-01") }),
      recurringTask({ id: "gestern", dueDate: d("2026-10-20") }),
    ]);

    expect(result.overdue.map((entry) => entry.daysOverdue)).toEqual([20, 1]);
  });

  it("F6 Der Block steht in der laufenden Woche, auch für Aufgaben aus früheren Wochen", () => {
    const result = view([oneOffTask({ id: "alt", dueDate: d("2026-09-15") })]);

    expect(result.position).toBe("current");
    expect(ids(result.overdue)).toEqual(["alt"]);
  });

  it("F6 Die älteste überfällige Aufgabe steht zuerst, bei gleichem Tag nach Titel", () => {
    const result = view([
      oneOffTask({ id: "neu", title: "A", dueDate: d("2026-10-20") }),
      oneOffTask({ id: "b", title: "B", dueDate: d("2026-10-10") }),
      oneOffTask({ id: "a", title: "A", dueDate: d("2026-10-10") }),
    ]);

    expect(ids(result.overdue)).toEqual(["a", "b", "neu"]);
  });

  it("F6 Was heute fällig ist, ist nicht überfällig", () => {
    const result = view([oneOffTask({ id: "heute", dueDate: today })]);

    expect(result.overdue).toEqual([]);
    expect(entriesOn(result, today)).toEqual(["heute"]);
  });

  it("F6 In einer künftigen Woche gibt es keinen Überfällig-Block", () => {
    const result = view([oneOffTask({ id: "alt", dueDate: d("2026-10-01") })], {
      shownDay: d("2026-10-28"),
    });

    expect(result.position).toBe("future");
    expect(result.overdue).toEqual([]);
    expect(result.days.flatMap((day) => day.entries)).toEqual([]);
  });

  it("F6 In einer vergangenen Woche bleibt eine unerledigte Aufgabe an ihrem Tag, als überfällig markiert", () => {
    const result = view([recurringTask({ id: "bad", dueDate: d("2026-10-13") })], {
      shownDay: d("2026-10-14"),
    });

    expect(result.position).toBe("past");
    expect(result.overdue).toEqual([]);
    const entry = result.days.flatMap((day) => day.entries)[0];
    expect(entry).toMatchObject({ kind: "open", daysOverdue: 8 });
  });
});

describe("F6 Wochenübersicht: blättern", () => {
  const tasks = [
    recurringTask({ id: "diese", dueDate: d("2026-10-22") }),
    recurringTask({ id: "naechste", dueDate: d("2026-10-27") }),
    oneOffTask({ id: "danach", dueDate: d("2026-11-03") }),
  ];

  it("F6 Die nächste Woche zeigt ihre Aufgaben", () => {
    const result = view(tasks, { shownDay: d("2026-10-28") });

    expect(result.position).toBe("future");
    expect(result.days.flatMap((day) => ids(day.entries))).toEqual(["naechste"]);
  });

  it("F6 Zwei Wochen weiter zeigt wieder andere Aufgaben", () => {
    const result = view(tasks, { shownDay: d("2026-11-04") });

    expect(result.days.flatMap((day) => ids(day.entries))).toEqual(["danach"]);
  });

  it("F6 Die Stellung der Woche zu heute: vergangen, laufend, künftig", () => {
    expect(view([], { shownDay: d("2026-10-18") }).position).toBe("past");
    expect(view([], { shownDay: d("2026-10-19") }).position).toBe("current");
    expect(view([], { shownDay: d("2026-10-25") }).position).toBe("current");
    expect(view([], { shownDay: d("2026-10-26") }).position).toBe("future");
  });
});

describe("F6 Wochenübersicht: wiederkehrende Aufgaben nur am nächsten Termin", () => {
  it("F6 Eine wöchentliche Aufgabe steht genau einmal da, keine Vorschau weiterer Termine", () => {
    const task = recurringTask({ id: "bad", dueDate: d("2026-10-22") });

    const thisWeek = view([task]);
    const nextWeek = view([task], { shownDay: d("2026-10-28") });

    expect(thisWeek.days.flatMap((day) => ids(day.entries))).toEqual(["bad"]);
    expect(nextWeek.days.flatMap((day) => ids(day.entries))).toEqual([]);
  });

  it("F6 Nach dem Abhaken steht die Aufgabe an ihrem neuen Termin", () => {
    const done = tickOff(
      stateOf(recurringTask({ id: "bad", dueDate: d("2026-10-21") })),
      "2026-10-21",
    );

    const thisWeek = view([done.task], { completions: done.completions });
    const nextWeek = view([done.task], {
      completions: done.completions,
      shownDay: d("2026-10-28"),
    });

    expect(thisWeek.days.flatMap((day) => day.entries)).toEqual([]);
    expect(entriesOn(nextWeek, "2026-10-28")).toEqual(["bad"]);
  });
});

describe("F3 Erledigte einmalige Aufgaben verschwinden aus der Woche", () => {
  it("F3 Eine abgehakte einmalige Aufgabe steht nicht mehr in der laufenden Woche", () => {
    const done = tickOff(
      stateOf(oneOffTask({ id: "paket", dueDate: d("2026-10-22") })),
      "2026-10-21",
    );

    const result = view([done.task], { completions: done.completions });

    expect(result.days.flatMap((day) => day.entries)).toEqual([]);
    expect(result.overdue).toEqual([]);
  });

  it("F3 Eine abgehakte einmalige Aufgabe steht auch nicht in einer künftigen Woche", () => {
    const done = tickOff(
      stateOf(oneOffTask({ id: "paket", dueDate: d("2026-10-29") })),
      "2026-10-21",
    );

    const result = view([done.task], { completions: done.completions, shownDay: d("2026-10-28") });

    expect(result.days.flatMap((day) => day.entries)).toEqual([]);
  });
});

describe("F6 Wochenübersicht: vergangene Wochen zeigen Erledigtes", () => {
  // Bad putzen was due Monday 12.10. and ticked off on Wednesday 14.10. by person B.
  const bad = tickOff(
    stateOf(recurringTask({ id: "bad", title: "Bad putzen", dueDate: d("2026-10-12") })),
    "2026-10-14",
    "c-bad",
    "personB",
  );
  const lastWeek = { shownDay: d("2026-10-15"), completions: bad.completions };

  it("F6 Eine vergangene Woche zeigt erledigte Aufgaben an dem Tag, an dem sie fällig waren", () => {
    const result = view([bad.task], lastWeek);

    expect(result.position).toBe("past");
    expect(entriesOn(result, "2026-10-12")).toEqual(["bad"]);
  });

  it("F6 Ein erledigter Eintrag nennt die Erledigung, aus der sich „erledigt von“ ergibt", () => {
    const result = view([bad.task], lastWeek);

    const entry = result.days.flatMap((day) => day.entries)[0] as WeekEntry;
    expect(entry.kind).toBe("done");
    expect((entry as { completion: Completion }).completion).toMatchObject({
      completedBy: "personB",
      completedOn: "2026-10-14",
    });
  });

  it("F6 Bei einer täglichen Aufgabe stehen alle Durchgänge der Woche da", () => {
    const first = tickOff(
      stateOf(
        recurringTask({
          id: "muell",
          recurrence: { unit: "day", interval: 1 },
          dueDate: d("2026-10-12"),
        }),
      ),
      "2026-10-12",
      "c-1",
    );
    const second = tickOff(first, "2026-10-13", "c-2");
    const third = tickOff(second, "2026-10-14", "c-3");

    const result = view([third.task], {
      completions: third.completions,
      shownDay: d("2026-10-12"),
    });

    expect(entriesOn(result, "2026-10-12")).toEqual(["muell"]);
    expect(entriesOn(result, "2026-10-13")).toEqual(["muell"]);
    expect(entriesOn(result, "2026-10-14")).toEqual(["muell"]);
  });

  it("F6 Eine erledigte einmalige Aufgabe steht in ihrer vergangenen Woche", () => {
    const paket = tickOff(
      stateOf(oneOffTask({ id: "paket", dueDate: d("2026-10-13") })),
      "2026-10-13",
    );

    const result = view([paket.task], {
      completions: paket.completions,
      shownDay: d("2026-10-13"),
    });

    expect(entriesOn(result, "2026-10-13")).toEqual(["paket"]);
  });

  it("F6 Offene Aufgaben stehen vor den erledigten, danach nach Titel", () => {
    const open = recurringTask({ id: "z", title: "Zimmer", dueDate: d("2026-10-12") });

    const result = view([bad.task, open], lastWeek);

    expect(entriesOn(result, "2026-10-12")).toEqual(["z", "bad"]);
  });

  it("F6 Eine Erledigung, deren Aufgabe fehlt, wird übersprungen", () => {
    const result = view([], lastWeek);

    expect(result.days.flatMap((day) => day.entries)).toEqual([]);
  });

  it("F6 Eine Erledigung aus einer anderen Woche erscheint dort nicht", () => {
    const result = view([bad.task], { ...lastWeek, shownDay: d("2026-10-05") });

    expect(result.days.flatMap((day) => day.entries)).toEqual([]);
  });
});

describe("F6 Wochenübersicht: Stand der Woche (erledigt / fällig)", () => {
  it("F6 Fällig sind alle offenen Aufgaben mit Termin in der Woche, Überfälliges aus früheren Wochen nicht", () => {
    const result = view([
      oneOffTask({ id: "heute", dueDate: today }),
      recurringTask({ id: "montag", dueDate: d("2026-10-19") }),
      recurringTask({ id: "alt", dueDate: d("2026-10-12") }),
      recurringTask({ id: "naechste", dueDate: d("2026-10-26") }),
    ]);

    expect(result.progress).toEqual({ done: 0, due: 2 });
  });

  it("F6 Erledigte Durchgänge zählen als erledigt und als fällig, auch in der laufenden Woche", () => {
    const first = tickOff(
      stateOf(
        recurringTask({
          id: "muell",
          recurrence: { unit: "day", interval: 1 },
          dueDate: d("2026-10-19"),
        }),
      ),
      "2026-10-19",
      "c-1",
    );
    const second = tickOff(first, "2026-10-20", "c-2");
    const paket = tickOff(stateOf(oneOffTask({ id: "paket", dueDate: today })), "2026-10-21", "p");

    const result = view([second.task, paket.task], {
      completions: [...second.completions, ...paket.completions],
    });

    // Müll: Mo und Di erledigt, Mi offen; Paket: erledigt.
    expect(result.progress).toEqual({ done: 3, due: 4 });
  });

  it("F6 Jeder Tag zählt seine fälligen und erledigten Durchgänge, auch wenn die Liste sie nicht zeigt", () => {
    const first = tickOff(
      stateOf(
        recurringTask({
          id: "muell",
          recurrence: { unit: "day", interval: 1 },
          dueDate: d("2026-10-19"),
        }),
      ),
      "2026-10-19",
      "c-1",
    );
    // Mo erledigt, Di offen und überfällig (steht im Überfällig-Block, nicht auf dem Tag).
    const result = view([first.task, oneOffTask({ id: "fr", dueDate: d("2026-10-23") })], {
      completions: first.completions,
    });
    const counts = result.days.map((day) => `${day.doneCount}/${day.dueCount}`);

    expect(counts).toEqual(["1/1", "0/1", "0/0", "0/0", "0/1", "0/0", "0/0"]);
    expect(result.days[0]?.entries).toEqual([]);
  });

  it("F6 Eine verspätet erledigte Aufgabe zählt in der Woche, in der sie fällig war", () => {
    const bad = tickOff(
      stateOf(recurringTask({ id: "bad", dueDate: d("2026-10-16") })),
      "2026-10-20",
    );

    expect(view([bad.task], { completions: bad.completions }).progress).toEqual({
      done: 0,
      due: 0,
    });
    expect(
      view([bad.task], { completions: bad.completions, shownDay: d("2026-10-14") }).progress,
    ).toEqual({ done: 1, due: 1 });
  });

  it("F6 Der Stand folgt dem Filter „nur meine“", () => {
    const tasks = [
      recurringTask({ id: "a", assignee: "personA", dueDate: today }),
      recurringTask({ id: "b", assignee: "personB", dueDate: today }),
    ];

    expect(view(tasks, { filter: "mine" }).progress).toEqual({ done: 0, due: 1 });
    expect(view(tasks).progress).toEqual({ done: 0, due: 2 });
  });
});

describe("F6 Wochenübersicht: Filter alle / nur meine", () => {
  const tasks = [
    recurringTask({ id: "a", assignee: "personA", dueDate: today }),
    recurringTask({ id: "b", assignee: "personB", dueDate: today }),
    recurringTask({ id: "beide", assignee: "both", dueDate: today }),
    recurringTask({ id: "alt-b", assignee: "personB", dueDate: d("2026-10-19") }),
    recurringTask({ id: "alt-a", assignee: "personA", dueDate: d("2026-10-19") }),
  ];

  it("F6 „Alle“ zeigt jede Aufgabe", () => {
    const result = view(tasks);

    expect(entriesOn(result, today).sort()).toEqual(["a", "b", "beide"]);
    expect(ids(result.overdue).sort()).toEqual(["alt-a", "alt-b"]);
  });

  it("F6 „Nur meine“ zeigt die eigenen Aufgaben und die für beide, auch im Überfällig-Block", () => {
    const result = view(tasks, { filter: "mine", person: "personA" });

    expect(entriesOn(result, today).sort()).toEqual(["a", "beide"]);
    expect(ids(result.overdue)).toEqual(["alt-a"]);
  });

  it("F5 Eine Aufgabe für beide erscheint bei „nur meine“ für beide Personen", () => {
    const forB = view(tasks, { filter: "mine", person: "personB" });

    expect(entriesOn(forB, today).sort()).toEqual(["b", "beide"]);
  });

  it("F5 Eine Übernahme „nur dieses Mal“ verschiebt die Aufgabe zur übernehmenden Person", () => {
    const taken = recurringTask({
      id: "fenster",
      assignee: "personB",
      takenOverBy: "personA",
      dueDate: today,
    });

    expect(entriesOn(view([taken], { filter: "mine", person: "personA" }), today)).toEqual([
      "fenster",
    ]);
    expect(entriesOn(view([taken], { filter: "mine", person: "personB" }), today)).toEqual([]);
  });

  it("F6 Der Filter gilt auch für erledigte Aufgaben vergangener Wochen", () => {
    const bad = tickOff(
      stateOf(recurringTask({ id: "bad", assignee: "personB", dueDate: d("2026-10-12") })),
      "2026-10-12",
    );
    const lastWeek = { shownDay: d("2026-10-12"), completions: bad.completions };

    expect(entriesOn(view([bad.task], { ...lastWeek, filter: "mine" }), "2026-10-12")).toEqual([]);
    expect(entriesOn(view([bad.task], lastWeek), "2026-10-12")).toEqual(["bad"]);
  });
});
