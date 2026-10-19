// Form fields with the accessibility basics built in: a visible label for every field, an optional
// hint, and an error message right at the field that the field refers to (`aria-describedby`,
// `aria-invalid`). The forms of the app are made of these, so they all behave the same way.

import type { ComponentChildren } from "preact";

interface FieldProps {
  /** Id of the control; hint and error derive their ids from it. */
  readonly id: string;
  readonly label: string;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
}

function hintId(id: string): string {
  return `${id}-hinweis`;
}

function errorId(id: string): string {
  return `${id}-fehler`;
}

/** The ids of the hint and the error that exist, for `aria-describedby`. */
function describedBy({ id, hint, error }: FieldProps): string | undefined {
  const ids = [hint ? hintId(id) : undefined, error ? errorId(id) : undefined].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

function ErrorMessage({ id, message }: { readonly id: string; readonly message: string }) {
  return (
    <span class="kern-error" id={id}>
      <span class="kern-icon kern-icon--danger" aria-hidden="true" />
      <span class="kern-body">{message}</span>
    </span>
  );
}

/** Label, hint and error above the control (the order KERN shows them in). */
function FieldFrame({
  field,
  children,
}: {
  readonly field: FieldProps;
  readonly children: ComponentChildren;
}) {
  const { id, label, hint, error } = field;
  return (
    <div class="kern-form-input">
      <label class="kern-label" for={id}>
        {label}
      </label>
      {hint && (
        <span class="kern-hint" id={hintId(id)}>
          {hint}
        </span>
      )}
      {error && <ErrorMessage id={errorId(id)} message={error} />}
      {children}
    </div>
  );
}

interface TextFieldProps extends FieldProps {
  readonly value: string;
  readonly onInput: (value: string) => void;
  readonly type?: "text" | "date";
  readonly inputMode?: "numeric";
  /** For `type="date"`: earliest and latest day the picker offers. */
  readonly min?: string;
  readonly max?: string;
  /** Keeps a short value (a number) from stretching over the whole width. */
  readonly narrow?: boolean;
}

export function TextField(props: TextFieldProps) {
  const { id, value, onInput, type = "text", inputMode, min, max, narrow, error } = props;
  const common = {
    class: `kern-form-input__input${narrow ? " kern-form-input__input--width-4" : ""}${error ? " kern-form-input__input--error" : ""}`,
    id,
    value,
    inputMode,
    autocomplete: "off",
    "aria-invalid": error ? ("true" as const) : undefined,
    "aria-describedby": describedBy(props),
    onInput: (event: { currentTarget: HTMLInputElement }) => onInput(event.currentTarget.value),
  };
  return (
    <FieldFrame field={props}>
      {type === "date" ? (
        <input {...common} type="date" min={min} max={max} />
      ) : (
        <input {...common} type="text" />
      )}
    </FieldFrame>
  );
}

interface TextAreaFieldProps extends FieldProps {
  readonly value: string;
  readonly onInput: (value: string) => void;
  readonly rows?: number;
}

export function TextAreaField(props: TextAreaFieldProps) {
  const { id, value, onInput, rows = 4, error } = props;
  return (
    <FieldFrame field={props}>
      <textarea
        class={`kern-form-input__input${error ? " kern-form-input__input--error" : ""}`}
        id={id}
        rows={rows}
        value={value}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy(props)}
        onInput={(event) => onInput(event.currentTarget.value)}
      />
    </FieldFrame>
  );
}

export interface Choice<V extends string> {
  readonly value: V;
  readonly label: string;
}

interface SelectFieldProps<V extends string> extends FieldProps {
  readonly value: V;
  readonly choices: readonly Choice<V>[];
  readonly onChange: (value: V) => void;
}

export function SelectField<V extends string>(props: SelectFieldProps<V>) {
  const { id, value, choices, onChange, error } = props;
  return (
    <FieldFrame field={props}>
      <div class="kern-form-input__select-wrapper">
        <select
          class={`kern-form-input__select${error ? " kern-form-input__select--error" : ""}`}
          id={id}
          value={value}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy(props)}
          onChange={(event) => onChange(event.currentTarget.value as V)}
        >
          {choices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      </div>
    </FieldFrame>
  );
}

interface RadioGroupProps<V extends string> {
  /** Shared `name` of the radios; the ids are `<name>-<value>`, the error id `<name>-fehler`. */
  readonly name: string;
  readonly legend: string;
  readonly choices: readonly Choice<V>[];
  readonly value: V | undefined;
  readonly onChange: (value: V) => void;
  readonly error?: string | undefined;
}

/** A group of radio buttons under a visible legend; the error stands inside the group. */
export function RadioGroup<V extends string>({
  name,
  legend,
  choices,
  value,
  onChange,
  error,
}: RadioGroupProps<V>) {
  const groupErrorId = errorId(name);
  return (
    <fieldset
      class={`kern-fieldset${error ? " kern-fieldset--error" : ""}`}
      aria-describedby={error ? groupErrorId : undefined}
    >
      <legend class="kern-label">{legend}</legend>
      <div class="kern-fieldset__body">
        {error && <ErrorMessage id={groupErrorId} message={error} />}
        {choices.map((choice) => (
          <div class="kern-form-check" key={choice.value}>
            <input
              class={`kern-form-check__radio${error ? " kern-form-check__radio--error" : ""}`}
              type="radio"
              name={name}
              id={`${name}-${choice.value}`}
              value={choice.value}
              checked={value === choice.value}
              onChange={() => onChange(choice.value)}
            />
            <label class="kern-label" for={`${name}-${choice.value}`}>
              {choice.label}
            </label>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
