// The symbols a task can carry (F8): a fixed list of household symbols, each with a colour tone.
// The domain only knows id and tone; the name of a symbol is a text (`t().symbols[id]`, one per
// language) and which picture belongs to an id is decided in `src/ui/`.

/** Colour of the symbol tile; the colours themselves are tokens in `src/ui/tokens.css`. */
export type SymbolTone = "blue" | "green" | "orange";

export const SYMBOL_TONES: readonly SymbolTone[] = ["blue", "green", "orange"];

export interface TaskSymbolInfo {
  readonly id: string;
  readonly tone: SymbolTone;
}

/** All symbols in the order the form offers them; the first one is the default. */
export const TASK_SYMBOLS = [
  { id: "standard", tone: "blue" },
  { id: "broom", tone: "orange" },
  { id: "cleaner", tone: "green" },
  { id: "bath", tone: "blue" },
  { id: "shower", tone: "blue" },
  { id: "laundry", tone: "blue" },
  { id: "clothes", tone: "green" },
  { id: "bed", tone: "green" },
  { id: "cooking", tone: "orange" },
  { id: "dishes", tone: "orange" },
  { id: "fridge", tone: "blue" },
  { id: "trash", tone: "blue" },
  { id: "recycling", tone: "green" },
  { id: "plant", tone: "green" },
  { id: "pet", tone: "green" },
  { id: "shopping", tone: "orange" },
  { id: "parcel", tone: "orange" },
  { id: "gift", tone: "orange" },
  { id: "phone", tone: "blue" },
  { id: "car", tone: "blue" },
  { id: "tools", tone: "orange" },
] as const satisfies readonly TaskSymbolInfo[];

export type TaskSymbolId = (typeof TASK_SYMBOLS)[number]["id"];

/** The symbol of a task nobody chose one for (and of tasks from before F8). */
export const DEFAULT_TASK_SYMBOL: TaskSymbolId = "standard";

const BY_ID: ReadonlyMap<string, TaskSymbolInfo> = new Map(
  TASK_SYMBOLS.map((symbol) => [symbol.id, symbol]),
);

export function isTaskSymbolId(value: unknown): value is TaskSymbolId {
  return typeof value === "string" && BY_ID.has(value);
}

/** Id and tone of a symbol. */
export function taskSymbol(id: TaskSymbolId): TaskSymbolInfo {
  return BY_ID.get(id) as TaskSymbolInfo;
}
