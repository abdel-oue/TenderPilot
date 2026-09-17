import { describe, expect, it } from "vitest";
import { FR } from "../../../lib/landing/fr";
import { EN } from "../../../lib/landing/en";

function textPaths(value: unknown, path = ""): string[] {
  if (typeof value === "string") {
    expect(value.trim(), path).not.toBe("");
    return [path];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => textPaths(child, `${path}.${key}`));
}

describe("landing translations", () => {
  it("provides English content for every French label and example", () => {
    expect(textPaths(EN)).toEqual(textPaths(FR));
  });
  it("identifies the sample analysis as fictional in both languages", () => {
    expect(FR.demoSection.sample).toContain("fictif");
    expect(EN.demoSection.sample).toContain("Fictional");
  });
});
