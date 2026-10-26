import { useEffect, useState } from "preact/hooks";
import { HOUSEHOLD_MESSAGES, NAME_MAX } from "../../auth/household";
import { checkPersonNames, type PersonNameError } from "../../domain/personNames";
import type { Person } from "../../domain/task";
import type { PersonNames } from "../../storage/appData";
import { errorText } from "../errorText";
import { personNameErrorText } from "../formErrors";
import { HOUSEHOLD_TEXTS } from "../householdTexts";
import { householdMessage } from "../pages/HouseholdPage";
import { ErrorAlert } from "./Alert";
import { TextField, useFieldErrorFocus } from "./fields";

interface HouseholdNamesFormProps {
  /** The household's name, `null` while it has none. */
  readonly householdName: string | null;
  readonly names: PersonNames;
  /** Who the signed-in person is: only their own name is changed here. */
  readonly me: Person;
  /** Saves the person's own name with the shared data (also offline). */
  readonly onSaveOwnName: (name: string) => Promise<void>;
  /** Sets the household's name (an empty one removes it); only online. Throws `HouseholdError`. */
  readonly onRename: (name: string) => Promise<void>;
}

const HOUSEHOLD_FIELD = "haushalt-name";
const OWN_FIELD = "eigener-name";

interface Errors {
  /** The household's name is too long. */
  household?: boolean | undefined;
  own?: PersonNameError | undefined;
}

/**
 * "Namen" in the tile "Haushalt" (E2-3g): the household's name and the person's own name. The own
 * name goes with the shared data like any other change (the other person sees it without
 * reloading, it also waits offline); the household's name is stored by the server at once.
 */
export function HouseholdNamesForm({
  householdName,
  names,
  me,
  onSaveOwnName,
  onRename,
}: HouseholdNamesFormProps) {
  const [household, setHousehold] = useState(householdName ?? "");
  const [own, setOwn] = useState(names[me]);
  /** Something was typed and not saved yet: a change from elsewhere does not overwrite it. */
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [saveError, setSaveError] = useState<{ title: string; message: string }>();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const { report, status } = useFieldErrorFocus();

  // A change by the other person (or after saving): shown unless something is being typed.
  useEffect(() => {
    if (!dirty) {
      setHousehold(householdName ?? "");
      setOwn(names[me]);
    }
  }, [householdName, names[me], dirty]);

  function edit(change: () => void) {
    change();
    setDirty(true);
    setSaved(false);
  }

  async function submit(event: Event) {
    event.preventDefault();
    if (saving) {
      return;
    }
    const other: Person = me === "personA" ? "personB" : "personA";
    const checked = checkPersonNames({ ...names, [me]: own });
    const found: Errors = {};
    if (household.trim().length > NAME_MAX) {
      found.household = true;
    }
    if (!checked.ok) {
      // The other name is valid; a message there means the two are the same.
      found.own = checked.errors[me] ?? checked.errors[other];
    }
    setErrors(found);
    setSaveError(undefined);
    setSaved(false);
    if (found.household) {
      report(HOUSEHOLD_FIELD, HOUSEHOLD_MESSAGES.invalidHouseholdName);
      return;
    }
    if (found.own !== undefined) {
      report(OWN_FIELD, personNameErrorText(found.own));
      return;
    }
    setSaving(true);
    try {
      const ownName = own.trim();
      if (ownName !== names[me]) {
        await onSaveOwnName(ownName);
      }
      if (household.trim() !== (householdName ?? "")) {
        try {
          await onRename(household);
        } catch (error) {
          // The own name (if changed) is saved; only the household's name waits for the network.
          setOwn(ownName);
          setSaveError({
            title: HOUSEHOLD_TEXTS.householdNameFailed,
            message: householdMessage(error),
          });
          return;
        }
      }
      setDirty(false);
      setSaved(true);
    } catch (error) {
      setSaveError({
        title: HOUSEHOLD_TEXTS.ownNameFailed,
        message: errorText(error),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <form class="form" onSubmit={submit} noValidate aria-labelledby="haushalt-namen">
        <h3 class="tile__subtitle" id="haushalt-namen">
          {HOUSEHOLD_TEXTS.namesTitle}
        </h3>
        <TextField
          id={HOUSEHOLD_FIELD}
          label={HOUSEHOLD_TEXTS.householdNameLabel}
          hint={HOUSEHOLD_TEXTS.householdNameHint}
          value={household}
          error={errors.household ? HOUSEHOLD_MESSAGES.invalidHouseholdName : undefined}
          onInput={(value) => edit(() => setHousehold(value))}
        />
        <TextField
          id={OWN_FIELD}
          label={HOUSEHOLD_TEXTS.ownNameLabel}
          hint={HOUSEHOLD_TEXTS.ownNameHint}
          value={own}
          error={errors.own && personNameErrorText(errors.own)}
          onInput={(value) => edit(() => setOwn(value))}
        />
        {saveError && <ErrorAlert title={saveError.title}>{saveError.message}</ErrorAlert>}
        <div class="button-row">
          <button class="btn btn--secondary" type="submit">
            {HOUSEHOLD_TEXTS.saveNames}
          </button>
        </div>
        <p class="form-status" role="status">
          {saved ? HOUSEHOLD_TEXTS.namesSaved : ""}
        </p>
      </form>
      {status}
    </>
  );
}
