// "App installieren": which way this browser offers to put Putzplan on the home screen, and the
// browser's own install question (`beforeinstallprompt`, Chromium only), caught early so the app
// can ask it from its own button later.

import { useEffect, useState } from "preact/hooks";

/**
 * - `installed`: already running as the installed app (nothing to offer).
 * - `prompt`: the browser can ask itself (Chrome, Edge, Samsung Internet): one button.
 * - `ios`: iPhone and iPad: only by hand, over "Teilen" → "Zum Home-Bildschirm".
 * - `firefoxAndroid`: Firefox on Android: by hand, over its menu (and on Xiaomi phones only with
 *   the permission "Startbildschirm-Verknüpfungen").
 * - `other`: nothing known (Firefox on a PC, Chrome before it is ready, …): a general hint.
 */
export type InstallWay = "installed" | "prompt" | "ios" | "firefoxAndroid" | "other";

export interface BrowserTraits {
  readonly userAgent: string;
  /** iPads pretend to be a Mac; only the touch screen gives them away. */
  readonly maxTouchPoints: number;
  /** Running from the home screen (`display-mode: standalone`, `navigator.standalone` on iOS). */
  readonly standalone: boolean;
  /** The browser has offered its install question (`beforeinstallprompt`). */
  readonly canPrompt: boolean;
}

export function isIos({ userAgent, maxTouchPoints }: BrowserTraits): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

export function installWay(traits: BrowserTraits): InstallWay {
  if (traits.standalone) {
    return "installed";
  }
  if (traits.canPrompt) {
    return "prompt";
  }
  if (isIos(traits)) {
    return "ios";
  }
  if (/Android/.test(traits.userAgent) && /Firefox\//.test(traits.userAgent)) {
    return "firefoxAndroid";
  }
  return "other";
}

/** The ways for which the week view offers its small hint; for `other` there is nothing to show. */
export function offersInstallHint(way: InstallWay): boolean {
  return way === "prompt" || way === "ios" || way === "firefoxAndroid";
}

/** Chromium's install question; not in the TypeScript DOM types. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ readonly outcome: "accepted" | "dismissed" }>;
}

let promptEvent: InstallPromptEvent | undefined;
let installedNow = false;
const listeners = new Set<() => void>();

function changed() {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Catches the browser's install question. Called in `main.tsx` before the app is drawn: the
 * browser may ask right after loading. `preventDefault` keeps Chrome's own bar on Android away;
 * the app offers its quieter hint instead.
 */
export function watchInstallPrompt(): void {
  addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    promptEvent = event as InstallPromptEvent;
    changed();
  });
  addEventListener("appinstalled", () => {
    promptEvent = undefined;
    installedNow = true;
    changed();
  });
}

function currentTraits(): BrowserTraits {
  return {
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone:
      installedNow ||
      matchMedia("(display-mode: standalone)").matches ||
      (navigator as { standalone?: boolean }).standalone === true,
    canPrompt: promptEvent !== undefined,
  };
}

/**
 * Asks the browser's install question. Resolves `true` if it was accepted. The question can be
 * asked only once; afterwards the way falls back to the hint for the browser's menu.
 */
async function askToInstall(): Promise<boolean> {
  const event = promptEvent;
  if (event === undefined) {
    return false;
  }
  promptEvent = undefined;
  await event.prompt();
  const { outcome } = await event.userChoice;
  installedNow = installedNow || outcome === "accepted";
  changed();
  return outcome === "accepted";
}

/** The install way of this browser right now, and its install question (for `prompt`). */
export function useInstallWay(): {
  readonly way: InstallWay;
  readonly install: () => Promise<boolean>;
} {
  const [way, setWay] = useState(() => installWay(currentTraits()));
  useEffect(() => {
    const update = () => setWay(installWay(currentTraits()));
    listeners.add(update);
    // The question may have come between the first drawing and now.
    update();
    return () => {
      listeners.delete(update);
    };
  }, []);
  return { way, install: askToInstall };
}
