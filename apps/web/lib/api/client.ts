// The one fetch wrapper. Every lib/api/[entity].ts file goes through it, so the
// credentials mode, the error shape and the JSON handling are defined once.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

/** The api's error shape, verbatim: `{ error, code }`. */
export class ApiError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  /** A plain object is sent as JSON; a FormData is sent as-is, for uploads. */
  body?: unknown;
}

export async function request(path: string, options: RequestOptions = {}): Promise<unknown> {
  const isFormData = options.body instanceof FormData;
  const method = options.method ?? (options.body === undefined ? "GET" : "POST");

  const response = await fetch(`${API_URL}${path}`, {
    method,
    // The session is an httpOnly cookie on another origin (web :3100 -> api :3000).
    credentials: "include",
    // Never set content-type on a FormData: the browser has to add the multipart
    // boundary itself, and an explicit header overwrites it with a broken one.
    headers: options.body === undefined || isFormData ? undefined : { "content-type": "application/json" },
    body: options.body === undefined || isFormData ? (options.body as BodyInit) : JSON.stringify(options.body),
  });

  if (response.status === 204) return null;

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const shape = payload as { error?: string; code?: string } | null;
    throw new ApiError(shape?.error ?? "Le service est indisponible.", shape?.code ?? "NETWORK_ERROR");
  }
  return payload;
}

/** An absolute api URL, for links the browser follows itself (PDF, DOCX). */
export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}
