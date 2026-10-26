import { EllipsisVertical, Share, SquarePlus } from "lucide-preact";
import type { ComponentChildren } from "preact";
import { t } from "../../i18n";
import type { InstallWay } from "../install";
import { Rich } from "./Rich";

interface InstallStepsProps {
  /** `ios`, `firefoxAndroid` or `other`; the browser's own question needs no steps. */
  readonly way: Exclude<InstallWay, "installed" | "prompt">;
  /** The data are the household's shared data: signing in brings them, a backup would replace them. */
  readonly shared?: boolean;
}

/**
 * How to put Krümel on the home screen by hand, step by step. Each step shows a picture of what
 * to tap, drawn like the browser shows it (decoration: the text says the same).
 */
export function InstallSteps({ way, shared = false }: InstallStepsProps) {
  const words = t().install;
  if (way === "ios") {
    return (
      <>
        <ol class="install-steps">
          <Step picture={<Share size={24} />}>
            <Rich text={words.iosShare} />
          </Step>
          <Step picture={<SquarePlus size={24} />}>
            <Rich text={words.iosAdd} />
          </Step>
          <Step picture={<span class="install-steps__word">{words.iosConfirmWord}</span>}>
            <Rich text={words.iosConfirm} />
          </Step>
        </ol>
        <p class="install-note">
          <Rich text={shared ? words.iosNoteShared : words.iosNote} />
        </p>
      </>
    );
  }
  if (way === "firefoxAndroid") {
    return (
      <>
        <ol class="install-steps">
          <Step picture={<EllipsisVertical size={24} />}>
            <Rich text={words.firefoxMenu} />
          </Step>
          <Step picture={<SquarePlus size={24} />}>
            <Rich text={words.firefoxAdd} />
          </Step>
        </ol>
        <XiaomiNote firefox />
      </>
    );
  }
  return (
    <>
      <p>
        <Rich text={words.other} />
      </p>
      {/Android/.test(navigator.userAgent) && <XiaomiNote firefox={false} />}
    </>
  );
}

function Step({
  picture,
  children,
}: {
  readonly picture: ComponentChildren;
  readonly children: ComponentChildren;
}) {
  return (
    <li class="install-steps__step">
      <span class="install-steps__picture" aria-hidden="true">
        {picture}
      </span>
      <p>{children}</p>
    </li>
  );
}

/** Seen in the device test: on Xiaomi phones nothing happens without this permission, no message. */
function XiaomiNote({ firefox }: { readonly firefox: boolean }) {
  return (
    <p class="install-note">
      <Rich text={t().install.xiaomi(firefox)} />
    </p>
  );
}
