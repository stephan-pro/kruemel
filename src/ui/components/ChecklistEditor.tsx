import { Plus, Trash2 } from "lucide-preact";
import { useState } from "preact/hooks";
import { addChecklistItem, type ChecklistItem, removeChecklistItem } from "../../domain/checklist";
import { checklistItemError } from "../../domain/taskForm";
import { ErrorMessage, errorId } from "./fields";

interface ChecklistEditorProps {
  /** Id of the field for a new item; its error id derives from it. */
  readonly id: string;
  readonly items: readonly ChecklistItem[];
  readonly onChange: (items: readonly ChecklistItem[]) => void;
  /** The text typed into the field for a new item but not added yet (the form adds it on save). */
  readonly draft: string;
  readonly onDraft: (text: string) => void;
  /** What is wrong with the draft, if anything; shown at the field. */
  readonly draftError: string | undefined;
  readonly onDraftError: (message: string | undefined) => void;
  /** A message about the checklist as a whole (too many items), shown at the group. */
  readonly error?: string | undefined;
}

/**
 * The checklist in the task form (F4): the items with a button to delete each, and a field to add
 * one. Enter in the field adds it too. Nothing is saved before the form is.
 */
export function ChecklistEditor({
  id,
  items,
  onChange,
  draft,
  onDraft,
  draftError,
  onDraftError,
  error,
}: ChecklistEditorProps) {
  // Read out when an item comes or goes: the list changes below the field that has the focus.
  const [announcement, setAnnouncement] = useState("");
  const groupErrorId = errorId(`${id}-gruppe`);

  function add() {
    const message = checklistItemError(draft);
    if (message !== undefined) {
      onDraftError(message);
      document.getElementById(id)?.focus();
      return;
    }
    const text = draft.trim();
    onChange(addChecklistItem({ checklist: items }, { id: crypto.randomUUID(), text }).checklist);
    onDraft("");
    setAnnouncement(`Eintrag „${text}“ hinzugefügt.`);
    document.getElementById(id)?.focus();
  }

  function remove(item: ChecklistItem) {
    onChange(removeChecklistItem({ checklist: items }, item.id).checklist);
    setAnnouncement(`Eintrag „${item.text}“ gelöscht.`);
    // The button that was pressed is gone: the focus goes to the field for the next item.
    document.getElementById(id)?.focus();
  }

  return (
    <fieldset class="choices" aria-describedby={error ? groupErrorId : undefined}>
      <legend class="field__label">Checkliste (optional)</legend>
      <span class="field__hint">
        Zum Beispiel die Schritte einer Aufgabe oder eine Einkaufsliste. Die Einträge lassen sich in
        der Wochenübersicht abhaken.
      </span>
      {error && <ErrorMessage id={groupErrorId} message={error} />}
      {items.length > 0 && (
        <ul class="checklist-editor">
          {items.map((item) => (
            <li class="checklist-editor__item" key={item.id}>
              <span class="checklist-editor__text">{item.text}</span>
              <button
                class="icon-btn"
                type="button"
                aria-label={`Eintrag löschen: ${item.text}`}
                onClick={() => remove(item)}
              >
                <Trash2 size={20} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div class="field">
        <label class="field__label" for={id}>
          Neuer Eintrag
        </label>
        {draftError && <ErrorMessage id={errorId(id)} message={draftError} />}
        <div class="checklist-editor__add">
          <input
            class="input"
            id={id}
            type="text"
            value={draft}
            autocomplete="off"
            aria-invalid={draftError ? "true" : undefined}
            aria-describedby={draftError ? errorId(id) : undefined}
            onInput={(event) => onDraft(event.currentTarget.value)}
            onKeyDown={(event) => {
              // Enter would send the whole form; here it adds the item.
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
          />
          <button class="btn btn--secondary" type="button" onClick={add}>
            <Plus size={20} />
            Hinzufügen
          </button>
        </div>
      </div>
      <div class="visually-hidden" role="status">
        {announcement}
      </div>
    </fieldset>
  );
}
