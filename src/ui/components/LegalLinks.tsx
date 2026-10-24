import { LEGAL_TEXTS } from "../legalTexts";
import { routeHash } from "../route";

/** Links to "Impressum" and "Datenschutzerklärung" (E2-5c), below the sign-in pages and so on. */
export function LegalLinks() {
  return (
    <nav class="legal-links" aria-label={LEGAL_TEXTS.linksLabel}>
      <a href={routeHash("imprint")}>{LEGAL_TEXTS.imprintLink}</a>
      <a href={routeHash("privacy")}>{LEGAL_TEXTS.privacyLink}</a>
    </nav>
  );
}
