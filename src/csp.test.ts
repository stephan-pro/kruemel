import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, scriptHash, supabaseSources } from "./csp";
import { isAppRequest } from "./swScope";

// S6 (stage 2): the page only loads its own files and only talks to its own address and the
// Supabase project; the service worker keeps out of everything that is not the app.

const scope = "https://stephan-pro.github.io/kruemel/";
const project = "https://abcdefghijklmnop.supabase.co";

describe("S6 Content Security Policy", () => {
  it("S6 Verbindungen nur zur eigenen Adresse und zum Supabase-Projekt, Skripte nur eigene und gehashte", async () => {
    const hash = await scriptHash("console.log(1)");
    const policy = contentSecurityPolicy([hash], supabaseSources(project));
    const directive = (name: string) =>
      policy
        .split("; ")
        .find((entry) => entry.startsWith(`${name} `))
        ?.split(" ")
        .slice(1);

    expect(directive("connect-src")).toEqual([
      "'self'",
      "blob:",
      project,
      "wss://abcdefghijklmnop.supabase.co",
    ]);
    expect(directive("script-src")).toEqual(["'self'", hash]);
    expect(directive("default-src")).toEqual(["'self'"]);
    expect(directive("object-src")).toEqual(["'none'"]);
    expect(policy).not.toContain("unsafe");
    // The value browsers compute for this script (SHA-256, base64).
    expect(hash).toBe("'sha256-CihokcEcBW4atb/CW/XWsvWwbTjqwQlE9nj9ii5ww5M='");
  });

  it("S6 Ohne Projektadresse oder mit http:// bricht der Build ab", () => {
    expect(() => supabaseSources(undefined)).toThrow(/VITE_SUPABASE_URL fehlt/);
    expect(() => supabaseSources(" ")).toThrow(/VITE_SUPABASE_URL fehlt/);
    expect(() => supabaseSources("http://abc.supabase.co")).toThrow(/https/);
    expect(supabaseSources("http://127.0.0.1:54321")).toEqual([
      "http://127.0.0.1:54321",
      "ws://127.0.0.1:54321",
    ]);
  });
});

describe("S6 Service Worker", () => {
  it("S6 Der Service Worker fasst Supabase nicht an, nur GET-Anfragen an die eigene Adresse", () => {
    expect(isAppRequest("GET", `${project}/rest/v1/rpc/pull_changes`, scope)).toBe(false);
    expect(isAppRequest("POST", `${project}/auth/v1/otp`, scope)).toBe(false);
    expect(isAppRequest("GET", "wss://abcdefghijklmnop.supabase.co/realtime/v1", scope)).toBe(
      false,
    );
    expect(isAppRequest("GET", "https://stephan-pro.github.io/anderes/", scope)).toBe(false);
    expect(isAppRequest("POST", `${scope}index.html`, scope)).toBe(false);

    expect(isAppRequest("GET", scope, scope)).toBe(true);
    expect(isAppRequest("GET", `${scope}assets/index-abc.js`, scope)).toBe(true);
  });
});
