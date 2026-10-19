// The symbols a task can carry (F8): a fixed list of household symbols, each with a colour tone.
// The domain only knows id, label and tone; which picture belongs to an id is decided in `src/ui/`.

/** Colour of the symbol tile; the colours themselves are tokens in `src/ui/tokens.css`. */
export type SymbolTone = "blue" | "green" | "orange";

export const SYMBOL_TONES: readonly SymbolTone[] = ["blue", "green", "orange"];

export interface TaskSymbolInfo {
  readonly id: string;
  /** Name of the symbol; screen readers announce it in the form. */
  readonly label: string;
  readonly tone: SymbolTone;
}

/** All symbols in the order the form offers them; the first one is the default. */
export const TASK_SYMBOLS = [
  { id: "standard", label: "Standard (Haus)", tone: "blue" },
  { id: "broom", label: "Besen", tone: "orange" },
  { id: "cleaner", label: "Sprühflasche", tone: "green" },
  { id: "bath", label: "Badewanne", tone: "blue" },
  { id: "shower", label: "Dusche", tone: "blue" },
  { id: "laundry", label: "Waschmaschine", tone: "blue" },
  { id: "clothes", label: "Hemd", tone: "green" },
  { id: "bed", label: "Bett", tone: "green" },
  { id: "cooking", label: "Kochtopf", tone: "orange" },
  { id: "dishes", label: "Besteck", tone: "orange" },
  { id: "fridge", label: "Kühlschrank", tone: "blue" },
  { id: "trash", label: "Mülleimer", tone: "blue" },
  { id: "recycling", label: "Recycling", tone: "green" },
  { id: "plant", label: "Pflanze", tone: "green" },
  { id: "pet", label: "Pfote", tone: "green" },
  { id: "shopping", label: "Einkaufswagen", tone: "orange" },
  { id: "parcel", label: "Paket", tone: "orange" },
  { id: "gift", label: "Geschenk", tone: "orange" },
  { id: "phone", label: "Telefon", tone: "blue" },
  { id: "car", label: "Auto", tone: "blue" },
  { id: "tools", label: "Werkzeug", tone: "orange" },
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

/** Label and tone of a symbol. */
export function taskSymbol(id: TaskSymbolId): TaskSymbolInfo {
  return BY_ID.get(id) as TaskSymbolInfo;
}
