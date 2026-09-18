import { describe, expect, it } from "vitest";
import { validateAuth } from "../../../lib/utils/authUtils";
describe("authentication validation", () => {
  it("rejects malformed signups before a network request", () => {
    expect(Object.keys(validateAuth("signup", { name: " ", email: "invalid", password: "short" })).sort()).toEqual(["email", "name", "password"]);
  });
  it("accepts existing login passwords without applying signup constraints", () => {
    expect(validateAuth("login", { name: "", email: "user@example.com", password: "older" })).toEqual({});
  });
  it("accepts a valid signup and rejects oversized passwords", () => {
    expect(validateAuth("signup", { name: "Samira", email: "samira@example.com", password: "long-password" })).toEqual({});
    expect(validateAuth("signup", { name: "Samira", email: "samira@example.com", password: "a".repeat(201) }).password).toBeTruthy();
  });
});
