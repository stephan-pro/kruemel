import { Check } from "lucide-preact";
import type { Task } from "../../domain/task";
import { t } from "../../i18n";

interface ChecklistTogglesProps {
  readonly task: Task;
  /** `chips`: small, side by side, in the rows of the week. `list`: one per line, in the details. */
  readonly variant: "chips" | "list";
  /** Ticks or unticks an item; the page saves it. */
  readonly onToggle: (itemId: string, checked: boolean) => void;
}

/**
 * The checklist of a task as checkboxes (F4): a group named after the task, one labelled checkbox
 * per item. The real checkbox lies invisibly over the whole chip, so a tap anywhere on it ticks,
 * and its focus frame goes around the chip.
 */
export function ChecklistToggles({ task, variant, onToggle }: ChecklistTogglesProps) {
  return (
    <fieldset class={`check-group check-group--${variant}`}>
      <legend class="visually-hidden">{t().common.checklistOfTask(task.title)}</legend>
      {task.checklist.map((item) => (
        <label class="check" key={item.id}>
          <input
            class="check__input"
            type="checkbox"
            checked={item.checked}
            onChange={(event) => onToggle(item.id, event.currentTarget.checked)}
          />
          <span class="check__box" aria-hidden="true">
            <Check size={16} strokeWidth={3} />
          </span>
          <span class="check__text">{item.text}</span>
        </label>
      ))}
    </fieldset>
  );
}
