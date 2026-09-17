import { describe, expect, it } from "vitest";
import { resolveLandingLocale } from "../../../lib/landing/locale";

describe("landing language preference", () => {
  it("defaults to French for first-time visitors", () => {
    expect(resolveLandingLocale(undefined)).toBe("fr");
  });
  it("uses a saved language when the URL does not specify one", () => {
    expect(resolveLandingLocale(undefined, "en")).toBe("en");
  });
  it("lets an explicit URL override the saved preference", () => {
    expect(resolveLandingLocale("fr", "en")).toBe("fr");
    expect(resolveLandingLocale("en", "fr")).toBe("en");
  });
  it("rejects unsupported and repeated language parameters", () => {
    expect(resolveLandingLocale("de", "invalid")).toBe("fr");
    expect(resolveLandingLocale(["en", "fr"])).toBe("fr");
    expect(resolveLandingLocale("invalid", "en")).toBe("en");
  });
});
