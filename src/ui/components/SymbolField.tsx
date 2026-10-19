import { TASK_SYMBOLS, type TaskSymbolId } from "../../domain/taskSymbols";
import { ErrorMessage, errorId } from "./fields";
import { SymbolIcon } from "./TaskSymbol";

interface SymbolFieldProps {
  /** Shared `name` of the radios; the ids are `<name>-<symbol id>`, the error id `<name>-fehler`. */
  readonly name: string;
  readonly value: string;
  readonly onChange: (symbol: TaskSymbolId) => void;
  readonly error?: string | undefined;
}

/**
 * Choosing the symbol of a task (F8): a radio group under a visible legend, one tile per symbol.
 * Each radio has the symbol's name as its label (hidden text next to the picture), so screen
 * readers say what it is; the arrow keys move between the symbols as in every radio group. The
 * name of the chosen symbol is also shown as text under the tiles.
 */
export function SymbolField({ name, value, onChange, error }: SymbolFieldProps) {
  const groupErrorId = errorId(name);
  const chosen = TASK_SYMBOLS.find((symbol) => symbol.id === value);
  return (
    <fieldset class="choices" aria-describedby={error ? groupErrorId : undefined}>
      <legend class="field__label">Symbol</legend>
      {error && <ErrorMessage id={groupErrorId} message={error} />}
      <div class="symbol-grid">
        {TASK_SYMBOLS.map((symbol) => (
          <div class="symbol-choice" key={symbol.id}>
            <input
              class="symbol-choice__input"
              type="radio"
              name={name}
              id={`${name}-${symbol.id}`}
              value={symbol.id}
              checked={value === symbol.id}
              onChange={() => onChange(symbol.id)}
            />
            <label
              class={`symbol-choice__tile task-symbol--${symbol.tone}`}
              for={`${name}-${symbol.id}`}
            >
              <SymbolIcon symbol={symbol.id} size={24} />
              <span class="visually-hidden">{symbol.label}</span>
            </label>
          </div>
        ))}
      </div>
      {chosen && (
        // Repeats what the checked radio already says, for those who see the tiles.
        <p class="field__hint" aria-hidden="true">
          Gewählt: {chosen.label}
        </p>
      )}
    </fieldset>
  );
}
