import { describe, expect, it } from "vitest";
import { calendarDay } from "../domain/date";
import { assigneeLabel, describeRecurrence, describeResponsibility, formatDay } from "./format";

const names = { personA: "Alex", personB: "Robin" };

describe("Anzeige der Aufgabenliste (F1)", () => {
  it("F1 Ein Tag wird mit Wochentag im deutschen Format gezeigt", () => {
    expect(formatDay(calendarDay("2026-10-19"))).toBe("Mo, 19.10.2026");
    expect(formatDay(calendarDay("2026-10-25"))).toBe("So, 25.10.2026");
  });

  it("F1 Der Rhythmus wird in Worten gezeigt, auch „alle N“", () => {
    expect(describeRecurrence({ unit: "day", interval: 1 })).toBe("täglich");
    expect(describeRecurrence({ unit: "week", interval: 1 })).toBe("wöchentlich");
    expect(describeRecurrence({ unit: "month", interval: 1 })).toBe("monatlich");
    expect(describeRecurrence({ unit: "day", interval: 3 })).toBe("alle 3 Tage");
    expect(describeRecurrence({ unit: "week", interval: 2 })).toBe("alle 2 Wochen");
    expect(describeRecurrence({ unit: "month", interval: 6 })).toBe("alle 6 Monate");
  });

  it("F5 Die Zuständigkeit zeigt den Namen der Person oder „Beide“", () => {
    expect(assigneeLabel("personA", names)).toBe("Alex");
    expect(assigneeLabel("personB", names)).toBe("Robin");
    expect(assigneeLabel("both", names)).toBe("Beide");
  });

  it("F5 Eine Übernahme „nur dieses Mal“ nennt auch die feste Zuständigkeit", () => {
    expect(describeResponsibility("personB", undefined, names)).toBe("Robin");
    expect(describeResponsibility("personB", "personA", names)).toBe(
      "Alex (nur dieses Mal übernommen; sonst Robin)",
    );
  });
});
