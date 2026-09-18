import { loginSchema, signupSchema } from "@tenderpilot/shared";
export type AuthMode = "login" | "signup";
export type AuthErrors = Partial<Record<"name" | "email" | "password", string>>;
export function validateAuth(mode: AuthMode, input: { name: string; email: string; password: string }): AuthErrors {
  const result = (mode === "signup" ? signupSchema : loginSchema).safeParse(input);
  if (result.success) return {};
  const errors: AuthErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (field === "name") errors.name = "Indiquez votre nom (120 caractères maximum).";
    if (field === "email") errors.email = "Indiquez une adresse e-mail valide.";
    if (field === "password") errors.password = mode === "signup" ? "Utilisez entre 8 et 200 caractères." : "Indiquez votre mot de passe (200 caractères maximum).";
  }
  return errors;
}
