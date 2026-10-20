import { describe, expect, it } from "vitest";
import {
  previousRangeOf,
  rangeOf,
  STATISTICS_PERIODS,
  type StatisticsInput,
  statistics,
  streakWeeks,
} from "./statistics";
import type { Completion, Task } from "./task";
import { d, oneOffTask, recurringTask, stateOf, tickOff } from "./task.fixtures";

// Wednesday 21.10.2026; the current week is Monday 19.10. to Sunday 25.10.
const today = d("2026-10-21");

/** A completion of its own, to place at a day exactly (the task logic is tested elsewhere). */
function done(
  taskId: string,
  completedOn: string,
  completedBy: "personA" | "personB" = "personA",
  extra: Partial<Completion> = {},
): Completion {
  return {
    id: `${taskId}-${completedOn}-${completedBy}`,
    taskId,
    completedOn: d(completedOn),
    completedBy,
    previousDueDate: d(completedOn),
    checkedItemIds: [],
    ...extra,
  };
}

function stats(overrides: Partial<StatisticsInput> = {}) {
  return statistics({ tasks: [], completions: [], today, period: "week", ...overrides });
}

describe("Statistik: Zeiträume", () => {
  it("Statistik Woche, Monat und Jahr sind die Woche, der Monat und das Jahr von heute", () => {
    expect(STATISTICS_PERIODS).toEqual(["week", "month", "year"]);
    expect(rangeOf("week", today)).toEqual({ start: "2026-10-19", end: "2026-10-25" });
    expect(rangeOf("month", today)).toEqual({ start: "2026-10-01", end: "2026-10-31" });
    expect(rangeOf("year", today)).toEqual({ start: "2026-01-01", end: "2026-12-31" });
  });

  it("Statistik Der Monat endet auch im Februar und im Schaltjahr am richtigen Tag", () => {
    expect(rangeOf("month", d("2026-02-10")).end).toBe("2026-02-28");
    expect(rangeOf("month", d("2028-02-10")).end).toBe("2028-02-29");
    expect(rangeOf("month", d("2026-12-31")).end).toBe("2026-12-31");
  });

  it("Statistik Der Vorzeitraum liegt direkt davor und ist so lang wie ein ganzer Zeitraum, auch über den Jahreswechsel", () => {
    expect(previousRangeOf("week", rangeOf("week", today))).toEqual({
      start: "2026-10-12",
      end: "2026-10-18",
    });
    expect(previousRangeOf("month", rangeOf("month", d("2026-01-15")))).toEqual({
      start: "2025-12-01",
      end: "2025-12-31",
    });
    expect(previousRangeOf("year", rangeOf("year", today))).toEqual({
      start: "2025-01-01",
      end: "2025-12-31",
    });
    expect(previousRangeOf("week", rangeOf("week", d("2026-01-01")))).toEqual({
      start: "2025-12-22",
      end: "2025-12-28",
    });
  });
});

describe("Statistik: gemeinsam erledigt", () => {
  const completions = [
    done("a", "2026-10-12"),
    done("a", "2026-10-18", "personB"),
    done("b", "2026-10-19"),
    done("b", "2026-10-20", "personB"),
    done("c", "2026-10-21"),
    done("c", "2026-09-30"),
  ];

  it("Statistik Gezählt wird, was im Zeitraum abgehakt wurde, von beiden zusammen", () => {
    expect(stats({ completions }).total).toBe(3);
    expect(stats({ completions, period: "month" }).total).toBe(5);
    expect(stats({ completions, period: "year" }).total).toBe(6);
    expect(stats().total).toBe(0);
  });

  it("Statistik Der Vergleich nennt, was im Vorzeitraum erledigt wurde", () => {
    expect(stats({ completions }).previousTotal).toBe(2);
    expect(stats({ completions, period: "month" }).previousTotal).toBe(1);
    expect(stats({ completions, period: "year" }).previousTotal).toBe(0);
  });

  it("Statistik Die Balken zeigen die Woche Tag für Tag, den Monat Tag für Tag und das Jahr Monat für Monat", () => {
    const week = stats({ completions });
    expect(week.barUnit).toBe("day");
    expect(week.bars.map((bar) => bar.start)).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ]);
    expect(week.bars.map((bar) => bar.count)).toEqual([1, 1, 1, 0, 0, 0, 0]);

    const month = stats({ completions, period: "month" });
    expect(month.barUnit).toBe("day");
    expect(month.bars).toHaveLength(31);
    expect(month.bars.reduce((sum, bar) => sum + bar.count, 0)).toBe(month.total);

    const year = stats({ completions, period: "year" });
    expect(year.barUnit).toBe("month");
    expect(year.bars).toHaveLength(12);
    expect(year.bars[0]?.start).toBe("2026-01-01");
    expect(year.bars.slice(8, 10).map((bar) => bar.count)).toEqual([1, 5]);
    expect(year.bars.reduce((sum, bar) => sum + bar.count, 0)).toBe(year.total);
  });
});

describe("Statistik: Teamwork", () => {
  it("Statistik Teamwork zählt, wer wie viel abgehakt hat; zusammen ergibt es das Ganze", () => {
    const result = stats({
      completions: [
        done("a", "2026-10-19", "personA"),
        done("b", "2026-10-20", "personB"),
        done("c", "2026-10-21", "personB"),
        done("d", "2026-10-10", "personA"),
      ],
    });

    expect(result.byPerson).toEqual({ personA: 1, personB: 2 });
    expect(result.byPerson.personA + result.byPerson.personB).toBe(result.total);
  });

  it("Statistik „Füreinander übernommen“ zählt nur, wenn eine andere Person als die Zuständige abgehakt hat", () => {
    const result = stats({
      completions: [
        // Robin macht, was Alex zugeteilt war: zählt.
        done("a", "2026-10-19", "personB", { assigneeAtCompletion: "personA" }),
        // Alex macht seine eigene Aufgabe: zählt nicht.
        done("b", "2026-10-19", "personA", { assigneeAtCompletion: "personA" }),
        // „Beide“ zählt nie, egal wer es macht.
        done("c", "2026-10-20", "personA", { assigneeAtCompletion: "both" }),
        done("d", "2026-10-20", "personB", { assigneeAtCompletion: "both" }),
        // Aus Etappe 1: unbekannt, wird nicht gezählt.
        done("e", "2026-10-21", "personB"),
        // Alex macht, was Robin zugeteilt war: zählt.
        done("f", "2026-10-21", "personA", { assigneeAtCompletion: "personB" }),
        // Außerhalb des Zeitraums.
        done("g", "2026-10-12", "personB", { assigneeAtCompletion: "personA" }),
      ],
    });

    expect(result.takenOver).toBe(2);
  });
});

describe("Statistik: am häufigsten erledigt", () => {
  const tasks: Task[] = [
    recurringTask({ id: "bad", title: "Bad putzen" }),
    recurringTask({ id: "muell", title: "Müll rausbringen" }),
    recurringTask({ id: "staub", title: "Staubsaugen" }),
    recurringTask({ id: "fenster", title: "Fenster putzen" }),
    // Gleicher Titel wie „Bad putzen“, aber eine andere Aufgabe: wird für sich gezählt.
    oneOffTask({ id: "bad2", title: "Bad putzen" }),
  ];

  it("Statistik Die ersten drei stehen nach Anzahl, bei Gleichstand nach Titel", () => {
    const completions = [
      ...["19", "20", "21"].map((day) => done("muell", `2026-10-${day}`)),
      ...["19", "20"].map((day) => done("staub", `2026-10-${day}`)),
      ...["19", "20"].map((day) => done("bad", `2026-10-${day}`)),
      done("fenster", "2026-10-21"),
    ];

    const top = stats({ tasks, completions }).top;

    expect(top.map((entry) => [entry.task.id, entry.count])).toEqual([
      ["muell", 3],
      ["bad", 2],
      ["staub", 2],
    ]);
  });

  it("Statistik Gezählt wird pro Aufgabe, nicht pro Titel, und nur im Zeitraum", () => {
    const completions = [
      done("bad", "2026-10-19"),
      done("bad2", "2026-10-20"),
      done("bad", "2026-10-05"),
    ];

    expect(stats({ tasks, completions }).top.map((entry) => [entry.task.id, entry.count])).toEqual([
      ["bad", 1],
      ["bad2", 1],
    ]);
    expect(stats({ tasks, completions, period: "month" }).top[0]).toMatchObject({
      task: { id: "bad" },
      count: 2,
    });
  });

  it("Statistik Eine Erledigung ohne Aufgabe (gelöscht) taucht nicht auf", () => {
    const top = stats({
      tasks,
      completions: [done("weg", "2026-10-19"), done("bad", "2026-10-19")],
    }).top;

    expect(top.map((entry) => entry.task.id)).toEqual(["bad"]);
  });
});

describe("Statistik: Serie", () => {
  /** A weekly task ticked off on each of the given days, in order; returns the state afterwards. */
  function weekly(id: string, firstDue: string, tickedOn: readonly string[]) {
    let state = stateOf(recurringTask({ id, dueDate: d(firstDue) }));
    tickedOn.forEach((day, index) => {
      state = tickOff(state, day, `${id}-${index}`);
    });
    return state;
  }

  it("Statistik Ohne Daten gibt es keine Serie", () => {
    expect(streakWeeks([], [], today)).toBe(0);
  });

  it("Statistik Wochen, in denen alles Fällige erledigt wurde, zählen in Folge; die laufende, noch offene Woche bricht sie nicht", () => {
    const state = weekly("a", "2026-09-30", ["2026-09-30", "2026-10-07", "2026-10-14"]);

    // Fällig am Mi 21.10. ist noch offen, die drei Wochen davor sind erledigt.
    expect(streakWeeks([state.task], state.completions, today)).toBe(3);
  });

  it("Statistik Ist auch die laufende Woche erledigt, zählt sie mit", () => {
    const state = weekly("a", "2026-09-30", [
      "2026-09-30",
      "2026-10-07",
      "2026-10-14",
      "2026-10-21",
    ]);

    expect(streakWeeks([state.task], state.completions, today)).toBe(4);
  });

  it("Statistik Eine vergangene Woche mit Offenem beendet die Serie", () => {
    const state = weekly("a", "2026-09-30", ["2026-09-30", "2026-10-07", "2026-10-14"]);
    // Fällig am 7.10. und nie erledigt: die Woche vom 5.10. ist nicht ganz erledigt.
    const open = recurringTask({ id: "b", dueDate: d("2026-10-07") });

    expect(streakWeeks([state.task, open], state.completions, today)).toBe(1);
  });

  it("Statistik Eine Woche ohne Fälliges zählt nicht und bricht nicht", () => {
    const x = tickOff(
      stateOf(oneOffTask({ id: "x", dueDate: d("2026-09-30") })),
      "2026-09-30",
      "x",
    );
    const y = tickOff(
      stateOf(oneOffTask({ id: "y", dueDate: d("2026-10-14") })),
      "2026-10-14",
      "y",
    );

    // Wochen vom 28.9. und 12.10. erledigt, die vom 5.10. und die laufende leer.
    expect(streakWeeks([x.task, y.task], [...x.completions, ...y.completions], today)).toBe(2);
  });

  it("Statistik Die Serie steht in der Statistik, unabhängig vom gewählten Zeitraum", () => {
    const state = weekly("a", "2026-09-30", ["2026-09-30", "2026-10-07", "2026-10-14"]);
    const input = { tasks: [state.task], completions: state.completions };

    expect(stats({ ...input, period: "week" }).streakWeeks).toBe(3);
    expect(stats({ ...input, period: "year" }).streakWeeks).toBe(3);
  });
});
