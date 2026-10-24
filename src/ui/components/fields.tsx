// Form fields with the accessibility basics built in: a visible label for every field, an optional
// hint, and an error message right at the field that the field refers to (`aria-describedby`,
// `aria-invalid`). The forms of the app are made of these, so they all behave the same way.

import { ChevronDown, CircleAlert } from "lucide-preact";
import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";

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

export function errorId(id: string): string {
  return `${id}-fehler`;
}

/** The ids of the hint and the error that exist, for `aria-describedby`. */
function describedBy({ id, hint, error }: FieldProps): string | undefined {
  const ids = [hint ? hintId(id) : undefined, error ? errorId(id) : undefined].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

export function ErrorMessage({ id, message }: { readonly id: string; readonly message: string }) {
  return (
    <span class="field__error" id={id}>
      <CircleAlert class="field__error-icon" size={18} />
      <span>{message}</span>
    </span>
  );
}

interface FieldFailure {
  readonly fieldId: string;
  readonly message: string;
  /** Counts the refused submits, so the same message twice is read twice. */
  readonly count: number;
}

/**
 * After a submit with errors: `report` moves the focus to the field with the (first) error once
 * the message is drawn, so it is read with the field. If that field has the focus already (Enter
 * in the field), a focus that does not move is not read again: the hidden `status` line reads the
 * message out instead. Put `status` into the form once.
 */
export function useFieldErrorFocus() {
  const [failure, setFailure] = useState<FieldFailure>();
  const [announced, setAnnounced] = useState<string>();

  useEffect(() => {
    if (failure === undefined) {
      return;
    }
    const field = document.getElementById(failure.fieldId);
    if (field !== null && document.activeElement === field) {
      setAnnounced(failure.message);
    } else {
      setAnnounced(undefined);
      field?.focus();
    }
  }, [failure]);

  function report(fieldId: string, message: string) {
    setFailure((last) => ({ fieldId, message, count: (last?.count ?? 0) + 1 }));
  }

  const status = (
    <p class="visually-hidden" role="status">
      {announced && <span key={failure?.count}>{announced}</span>}
    </p>
  );
  return { report, status };
}

/** Label, hint and error above the control, so they are read and seen before it. */
function FieldFrame({
  field,
  children,
}: {
  readonly field: FieldProps;
  readonly children: ComponentChildren;
}) {
  const { id, label, hint, error } = field;
  return (
    <div class="field">
      <label class="field__label" for={id}>
        {label}
      </label>
      {hint && (
        <span class="field__hint" id={hintId(id)}>
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
  readonly type?: "text" | "date" | "email" | "time";
  readonly inputMode?: "numeric";
  /** What the browser may fill in ("email", "one-time-code"); default nothing. */
  readonly autocomplete?: string;
  /** For `type="date"`: earliest and latest day the picker offers. */
  readonly min?: string;
  readonly max?: string;
  /** Keeps a short value (a number) from stretching over the whole width. */
  readonly narrow?: boolean;
}

export function TextField(props: TextFieldProps) {
  const {
    id,
    value,
    onInput,
    type = "text",
    inputMode,
    autocomplete = "off",
    min,
    max,
    narrow,
  } = props;
  const common = {
    class: `input${narrow ? " input--narrow" : ""}`,
    id,
    value,
    inputMode,
    autocomplete,
    "aria-invalid": props.error ? ("true" as const) : undefined,
    "aria-describedby": describedBy(props),
    onInput: (event: { currentTarget: HTMLInputElement }) => onInput(event.currentTarget.value),
  };
  return (
    <FieldFrame field={props}>
      {type === "date" ? (
        <input {...common} type="date" min={min} max={max} />
      ) : type === "email" ? (
        <input {...common} type="email" spellcheck={false} />
      ) : type === "time" ? (
        <input {...common} type="time" />
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
        class="input input--area"
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
      <div class="select">
        <select
          class="input select__control"
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
        <ChevronDown class="select__icon" size={20} />
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
  /** Puts the choices side by side where there is room (short labels). */
  readonly inline?: boolean;
}

/** A group of radio buttons under a visible legend; the error stands inside the group. */
export function RadioGroup<V extends string>({
  name,
  legend,
  choices,
  value,
  onChange,
  error,
  inline,
}: RadioGroupProps<V>) {
  const groupErrorId = errorId(name);
  return (
    <fieldset class="choices" aria-describedby={error ? groupErrorId : undefined}>
      <legend class="field__label">{legend}</legend>
      {error && <ErrorMessage id={groupErrorId} message={error} />}
      <div class={`choices__list${inline ? " choices__list--inline" : ""}`}>
        {choices.map((choice) => (
          <div class="choice" key={choice.value}>
            <input
              class="choice__input"
              type="radio"
              name={name}
              id={`${name}-${choice.value}`}
              value={choice.value}
              checked={value === choice.value}
              onChange={() => onChange(choice.value)}
            />
            <label class="choice__label" for={`${name}-${choice.value}`}>
              {choice.label}
            </label>
          </div>
        ))}
      </div>
    </fieldset>
  );
}

/** A group of fields under a visible legend (e.g. "Rhythmus": interval and unit). */
export function FieldGroup({
  legend,
  children,
}: {
  readonly legend: string;
  readonly children: ComponentChildren;
}) {
  return (
    <fieldset class="choices">
      <legend class="field__label">{legend}</legend>
      <div class="field-row">{children}</div>
    </fieldset>
  );
}
