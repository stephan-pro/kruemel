// Encrypting a push for the Edge Function `push` (`Encrypt` in core.ts), with the parts of
// `@block65/webcrypto-web-push`. Its `buildPushPayload` pads every body to 4096 bytes, which
// Mozilla refuses with 413 for Firefox on Android (`MAX_PUSH_BODY_BYTES`); so the body here is not
// padded. The push service then sees the size of the message, which it may anyway
// (docs/BENACHRICHTIGUNGEN.md, 2.3).

import { encryptNotification, vapidHeaders } from "@block65/webcrypto-web-push";
import type { Encrypt } from "./core.ts";

export const encryptPush: Encrypt = async (message, subscription, vapid) => {
  // VAPID (RFC 8292): `aud` is the push service's origin, `exp` 12 hours ahead, `sub` the subject.
  const { headers } = await vapidHeaders(subscription, vapid);
  const body = await encryptNotification(
    subscription,
    new TextEncoder().encode(JSON.stringify(message.data)),
    { pad: false },
  );
  return {
    method: "POST",
    body,
    headers: {
      ...headers,
      ttl: String(message.options.ttl),
      urgency: message.options.urgency,
      topic: message.options.topic,
      "content-encoding": "aes128gcm",
      "content-type": "application/octet-stream",
    },
  };
};
