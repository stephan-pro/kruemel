import { t } from "../../i18n";
import { getLanguage, LANGUAGE_NAMES, LANGUAGES, setLanguage } from "../../i18n/language";

interface LanguageSwitchProps {
  /**
   * `tile`: the tile in "Darstellung". `compact`: a row for the pages without an account (sign-in,
   * invites); its label names both languages, so it can be found in the one that is not understood.
   */
  readonly variant: "tile" | "compact";
}

/**
 * "Deutsch | English" (EN-a): two buttons, the pressed one is the language in use. Each name is in
 * its own language and marked with `lang`, so a screen reader pronounces it right. The change
 * takes effect at once and is kept on this device.
 */
export function LanguageSwitch({ variant }: LanguageSwitchProps) {
  const current = getLanguage();
  const words = t().language;
  const buttons = LANGUAGES.map((language) => (
    <button
      key={language}
      class="segmented__option"
      type="button"
      lang={language}
      aria-pressed={current === language}
      onClick={() => setLanguage(language)}
    >
      {LANGUAGE_NAMES[language]}
    </button>
  ));
  if (variant === "compact") {
    return (
      <fieldset class="language-switch">
        <legend class="language-switch__label">{words.label}</legend>
        <div class="segmented">{buttons}</div>
      </fieldset>
    );
  }
  return (
    <section class="tile tile--narrow form" aria-labelledby="sprache">
      <h2 class="tile__title" id="sprache">
        {words.title}
      </h2>
      <p class="muted">{words.hint}</p>
      <fieldset class="segmented language-switch__buttons">
        <legend class="visually-hidden">{words.title}</legend>
        {buttons}
      </fieldset>
    </section>
  );
}
