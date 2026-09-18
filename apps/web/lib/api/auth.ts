import { loginSchema, signupSchema, userSchema } from "@tenderpilot/shared";
import type { z } from "zod";
import { ApiError, request } from "./client";

export type User = z.infer<typeof userSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

function parseUser(payload: unknown): User {
  return userSchema.parse((payload as { user: unknown }).user);
}

export async function signup(input: SignupInput): Promise<User> {
  return parseUser(await request("/auth/signup", { body: input }));
}

export async function login(input: LoginInput): Promise<User> {
  return parseUser(await request("/auth/login", { body: input }));
}

export async function logout(): Promise<void> {
  await request("/auth/logout", { method: "POST" });
}

/** Returns null when there is no session, so the query itself is not an error state. */
export async function fetchMe(): Promise<User | null> {
  try {
    return parseUser(await request("/auth/me"));
  } catch (error) {
    if (error instanceof ApiError && error.code === "UNAUTHORIZED") return null;
    throw error;
  }
}

// Re-exported so callers that already import from here keep working.
export { ApiError };
