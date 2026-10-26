import type { Person } from "../../domain/task";
import { t } from "../../i18n";
import { RadioGroup } from "./fields";

interface PersonChoiceProps {
  /** Shown in the choice, in this order. */
  readonly labels: Readonly<Record<Person, string>>;
  readonly value: Person | undefined;
  readonly onChange: (person: Person) => void;
  readonly error?: string | undefined;
}

/** "Ich bin": which of the two people uses this device (F5). */
export function PersonChoice({ labels, value, onChange, error }: PersonChoiceProps) {
  return (
    <RadioGroup
      name="ich-bin"
      legend={t().names.iAm}
      choices={[
        { value: "personA", label: labels.personA },
        { value: "personB", label: labels.personB },
      ]}
      value={value}
      onChange={onChange}
      error={error}
    />
  );
}
