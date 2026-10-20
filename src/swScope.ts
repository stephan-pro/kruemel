// Which requests the service worker (`sw.ts`) answers: only GET requests to the app's own address.
// Everything else goes to the network untouched, above all the Supabase project (stage 2): its
// data must never come from a kept copy, and its sign-in must never be cached.

/** True if the worker answers the request; `scope` is the app's address, e.g. ".../kruemel/". */
export function isAppRequest(method: string, url: string, scope: string): boolean {
  const address = new URL(url);
  return (
    method === "GET" && address.origin === new URL(scope).origin && address.href.startsWith(scope)
  );
}
