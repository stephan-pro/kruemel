// What a form error code says to the person, in the language set when it is shown. The domain
// reports codes (with the number a sentence speaks of); the pages keep the code and call these
// functions when drawing, so a switch of the language changes a message that is on the screen.

import type { PersonNameError } from "../domain/personNames";
import { MAX_DUE_DATE, MIN_DUE_DATE, type TaskFormError } from "../domain/taskForm";
import { t } from "../i18n";

/** The sentence for an error of the task form. */
export function taskFormErrorText({ code, limit = 0 }: TaskFormError): string {
  const texts = t().formErrors;
  switch (code) {
    case "titleEmpty":
      return texts.titleEmpty;
    case "titleTooLong":
      return texts.titleTooLong(limit);
    case "dateEmpty":
      return texts.dateEmpty;
    case "dateInvalid":
      return texts.dateInvalid;
    case "dateOutOfRange":
      return texts.dateOutOfRange(MIN_DUE_DATE.slice(0, 4), MAX_DUE_DATE.slice(0, 4));
    case "symbolMissing":
      return texts.symbolMissing;
    case "assigneeMissing":
      return texts.assigneeMissing;
    case "noteTooLong":
      return texts.noteTooLong(limit);
    case "checklistTooMany":
      return texts.checklistTooMany(limit);
    case "checklistItemInvalid":
      return texts.checklistItemInvalid(limit);
    case "checklistTextEmpty":
      return texts.checklistTextEmpty;
    case "checklistTextTooLong":
      return texts.checklistTextTooLong(limit);
    case "intervalEmpty":
      return texts.intervalEmpty;
    case "intervalInvalid":
      return texts.intervalInvalid;
    case "intervalTooBig":
      return texts.intervalTooBig(limit);
    case "unitMissing":
      return texts.unitMissing;
  }
}

/** The sentence for an error of a name. */
export function personNameErrorText({ code, limit = 0 }: PersonNameError): string {
  const texts = t().formErrors;
  switch (code) {
    case "nameEmpty":
      return texts.nameEmpty;
    case "nameTooLong":
      return texts.nameTooLong(limit);
    case "namesEqual":
      return texts.namesEqual;
  }
}
