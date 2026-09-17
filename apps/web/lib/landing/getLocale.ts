import { cookies } from "next/headers";
import { resolveLandingLocale } from "./locale";

export async function getLandingLocale(searchParams: Promise<{ lang?: string | string[] }>) {
  const params = await searchParams;
  const saved = (await cookies()).get("tenderpilot-language")?.value;
  return resolveLandingLocale(params.lang, saved);
}
