// The Content Security Policy of the built page (stage 2, S6): scripts, styles, fonts and images
// only from the app's own address, connections only to the app itself plus the server of the
// storage mode (the fake server in the end-to-end tests, the Supabase project in the real app).
// `vite.config.ts` puts it into index.html as `<meta http-equiv>`; GitHub Pages cannot send headers.

/** The policy; `inlineScripts` are `'sha256-…'` sources of the inline scripts of the page. */
export function contentSecurityPolicy(
  inlineScripts: readonly string[],
  connectTo: readonly string[],
): string {
  return [
    "default-src 'self'",
    ["script-src 'self'", ...inlineScripts].join(" "),
    "style-src 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    // `blob:`: a downloaded backup is a blob address of the page itself.
    ["connect-src 'self' blob:", ...connectTo].join(" "),
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

/** The addresses of a Supabase project the app talks to: the API (https) and realtime (wss). */
export function supabaseSources(projectUrl: string | undefined): string[] {
  if (projectUrl === undefined || projectUrl.trim() === "") {
    throw new Error("VITE_SUPABASE_URL fehlt (Adresse des Supabase-Projekts, siehe .env.example).");
  }
  const url = new URL(projectUrl.trim());
  if (url.protocol !== "https:" && url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    throw new Error(`VITE_SUPABASE_URL muss mit https:// beginnen: ${projectUrl}`);
  }
  const socket = url.protocol === "https:" ? "wss:" : "ws:";
  return [url.origin, `${socket}//${url.host}`];
}

/** `'sha256-…'` of an inline script, the way browsers compare it with the policy. */
export async function scriptHash(source: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  return `'sha256-${btoa(String.fromCharCode(...new Uint8Array(digest)))}'`;
}
