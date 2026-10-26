import { ArrowLeft } from "lucide-preact";
import { LanguageSwitch } from "../components/LanguageSwitch";
import { LegalLinks } from "../components/LegalLinks";
import { PageTitle } from "../components/PageTitle";
import { type LegalSection, legalContent } from "../legalTexts";
import { type LegalRoute, routeHash, routeInfo } from "../route";

interface LegalPageProps {
  readonly route: LegalRoute;
}

/** Back to where the person came from; opened directly, to the start page. */
function goBack() {
  if (history.length > 1) {
    history.back();
  } else {
    location.hash = routeHash("today");
  }
}

function Section({ section }: { readonly section: LegalSection }) {
  const headingId = `rechtliches-${section.id}`;
  return (
    <section aria-labelledby={headingId}>
      <h2 class="tile__title" id={headingId}>
        {section.title}
      </h2>
      {section.blocks.map((block) =>
        block.kind === "text" ? (
          <p key={block.text}>{block.text}</p>
        ) : (
          <ul class="bullet-list" key={block.items[0]}>
            {block.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ),
      )}
    </section>
  );
}

/**
 * "Impressum" and "Datenschutzerklärung" (E2-5c, English: EN-c): text pages that open without
 * signing in, also without a connection once the app is loaded (the service worker keeps the app).
 * The English text is a translation and says so at its top; the language can be switched here.
 */
export function LegalPage({ route }: LegalPageProps) {
  const { date, words, imprint, privacy } = legalContent();
  const sections = route === "imprint" ? imprint : privacy;
  return (
    <>
      <PageTitle title={routeInfo(route).title} />
      <article class="tile tile--narrow legal">
        {words.translationNote !== undefined && <p class="legal-note">{words.translationNote}</p>}
        <p class="muted">{words.stateLabel(date)}</p>
        <p class="intro">{words.intro}</p>
        {sections.map((section) => (
          <Section key={section.id} section={section} />
        ))}
        <div class="button-row legal-back">
          <button class="btn btn--secondary" type="button" onClick={goBack}>
            <ArrowLeft size={20} />
            {words.back}
          </button>
        </div>
      </article>
      <LanguageSwitch variant="compact" />
      <LegalLinks />
    </>
  );
}
