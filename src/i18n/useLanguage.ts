import { useEffect, useState } from "preact/hooks";
import { getLanguage, type Language, subscribeLanguage } from "./language";

/**
 * The language that is set; the component draws again when it changes. The root of the app uses
 * it, so every text below is read again with the new language (no reload, no state is lost).
 */
export function useLanguage(): Language {
  const [language, setLanguage] = useState(getLanguage);
  useEffect(() => {
    // The language may have changed between drawing and subscribing.
    setLanguage(getLanguage());
    return subscribeLanguage(() => setLanguage(getLanguage()));
  }, []);
  return language;
}
