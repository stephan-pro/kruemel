// Checklists (F4): any task can carry a list of items that can be added, ticked and deleted.
// The functions work on anything that has a `checklist`, so they stay independent of the task types.

export interface ChecklistItem {
  readonly id: string;
  readonly text: string;
  readonly checked: boolean;
}

export interface HasChecklist {
  readonly checklist: readonly ChecklistItem[];
}

export interface NewChecklistItem {
  /** Created by the caller (the domain has no id source). */
  readonly id: string;
  readonly text: string;
}

function findItem(owner: HasChecklist, itemId: string): ChecklistItem {
  const item = owner.checklist.find((candidate) => candidate.id === itemId);
  if (item === undefined) {
    throw new RangeError(`Checklisten-Eintrag nicht gefunden: ${itemId}`);
  }
  return item;
}

/** Appends an unticked item at the end. The text is trimmed and must not be empty. */
export function addChecklistItem<T extends HasChecklist>(owner: T, input: NewChecklistItem): T {
  const text = input.text.trim();
  if (text === "") {
    throw new RangeError("Ein Checklisten-Eintrag braucht einen Text");
  }
  if (owner.checklist.some((item) => item.id === input.id)) {
    throw new RangeError(`Checklisten-Eintrag existiert bereits: ${input.id}`);
  }
  return { ...owner, checklist: [...owner.checklist, { id: input.id, text, checked: false }] };
}

/** Ticks or unticks one item; the others stay as they are. */
export function setChecklistItemChecked<T extends HasChecklist>(
  owner: T,
  itemId: string,
  checked: boolean,
): T {
  findItem(owner, itemId);
  return {
    ...owner,
    checklist: owner.checklist.map((item) => (item.id === itemId ? { ...item, checked } : item)),
  };
}

export function removeChecklistItem<T extends HasChecklist>(owner: T, itemId: string): T {
  findItem(owner, itemId);
  return { ...owner, checklist: owner.checklist.filter((item) => item.id !== itemId) };
}

/** Unticks every item; the items themselves stay. */
export function resetChecklistChecks<T extends HasChecklist>(owner: T): T {
  return { ...owner, checklist: owner.checklist.map((item) => ({ ...item, checked: false })) };
}

/** Ids of the ticked items, in list order. */
export function checkedItemIds(owner: HasChecklist): string[] {
  return owner.checklist.filter((item) => item.checked).map((item) => item.id);
}

/** Ticks exactly the items with these ids; ids that no longer exist are ignored. */
export function restoreChecklistChecks<T extends HasChecklist>(
  owner: T,
  ids: readonly string[],
): T {
  return {
    ...owner,
    checklist: owner.checklist.map((item) => ({ ...item, checked: ids.includes(item.id) })),
  };
}
