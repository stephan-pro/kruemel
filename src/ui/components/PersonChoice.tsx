import type { Person } from "../../domain/task";

interface PersonChoiceProps {
  /** Shown in the choice, in this order. */
  readonly labels: Readonly<Record<Person, string>>;
  readonly value: Person | undefined;
  readonly onChange: (person: Person) => void;
  readonly error?: string | undefined;
}

/** "Ich bin": which of the two people uses this device (F5). */
export function PersonChoice({ labels, value, onChange, error }: PersonChoiceProps) {
  const errorId = "ich-bin-fehler";
  const people: readonly Person[] = ["personA", "personB"];
  return (
    <fieldset
      class={`kern-fieldset${error ? " kern-fieldset--error" : ""}`}
      aria-describedby={error ? errorId : undefined}
    >
      <legend class="kern-label">Ich bin</legend>
      <div class="kern-fieldset__body">
        {error && (
          <span class="kern-error" id={errorId}>
            <span class="kern-icon kern-icon--danger" aria-hidden="true" />
            <span class="kern-body">{error}</span>
          </span>
        )}
        {people.map((person) => (
          <div class="kern-form-check" key={person}>
            <input
              class={`kern-form-check__radio${error ? " kern-form-check__radio--error" : ""}`}
              type="radio"
              name="ich-bin"
              id={`ich-bin-${person}`}
              value={person}
              checked={value === person}
              onChange={() => onChange(person)}
            />
            <label class="kern-label" for={`ich-bin-${person}`}>
              {labels[person]}
            </label>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
