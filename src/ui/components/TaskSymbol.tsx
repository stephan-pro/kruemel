import { House } from "lucide-preact";

/**
 * The symbol tile in front of a task (DESIGN.md section 6). Until tasks get their own symbols (F8,
 * package R2) every task shows the default symbol. Decoration only: the title says what it is.
 */
export function TaskSymbol() {
  return (
    <span class="task-symbol task-symbol--blue" aria-hidden="true">
      <House size={22} />
    </span>
  );
}
