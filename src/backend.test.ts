import { describe, expect, it } from "vitest";
import { backendMode, checkPublishableKey } from "./backend";

describe("Speicher-Modus (local, fake, supabase)", () => {
  it("Ohne Angabe bleibt es local; nur der Build-Modus e2e nimmt den Fake-Server", () => {
    expect(backendMode("production", undefined)).toBe("local");
    expect(backendMode("development", "")).toBe("local");
    expect(backendMode("demo", undefined)).toBe("local");
    expect(backendMode("e2e", undefined)).toBe("fake");
  });

  it("VITE_BACKEND geht dem Build-Modus vor", () => {
    expect(backendMode("production", "supabase")).toBe("supabase");
    expect(backendMode("production", " fake ")).toBe("fake");
    expect(backendMode("e2e", "local")).toBe("local");
  });

  it("Ein unbekannter Wert bricht den Build mit einer klaren Meldung ab", () => {
    expect(() => backendMode("production", "firebase")).toThrow(
      "VITE_BACKEND=firebase ist unbekannt. Erlaubt: supabase, fake, local (oder leer).",
    );
  });

  it("Ein Supabase-Build braucht den Publishable Key und nimmt keinen anderen Schlüssel", () => {
    expect(() => checkPublishableKey(" sb_publishable_abc ")).not.toThrow();
    expect(() => checkPublishableKey(undefined)).toThrow(/VITE_SUPABASE_PUBLISHABLE_KEY fehlt/);
    expect(() => checkPublishableKey(" ")).toThrow(/VITE_SUPABASE_PUBLISHABLE_KEY fehlt/);
    expect(() => checkPublishableKey("sb_secret_abc")).toThrow(/nie der Secret Key/);
  });
});
