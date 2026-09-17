import { loginSchema, signupSchema, userSchema } from "@tenderpilot/shared";
import type { z } from "zod";

export type User = z.infer<typeof userSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

async function request(path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(`${API_URL}${path}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "include",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 204) return null;
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const shape = payload as { error?: string; code?: string } | null;
    throw new ApiError(shape?.error ?? "Le service est indisponible.", shape?.code ?? "NETWORK_ERROR");
  }
  return payload;
}

function parseUser(payload: unknown): User {
  return userSchema.parse((payload as { user: unknown }).user);
}

export async function signup(input: SignupInput): Promise<User> {
  return parseUser(await request("/auth/signup", input));
}

export async function login(input: LoginInput): Promise<User> {
  return parseUser(await request("/auth/login", input));
}

export async function logout(): Promise<void> {
  await request("/auth/logout", {});
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
