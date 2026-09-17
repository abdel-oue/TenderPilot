import { z } from 'zod';

/** What the api ever sends back about a user. No hash, ever. */
export const userSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string().min(1).max(120),
  createdAt: z.coerce.date(),
});

export const signupSchema = z.object({
  email: z.email(),
  name: z.string().trim().min(1).max(120),
  password: z.string().min(8).max(200),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(200),
});

export const sessionSchema = z.object({ user: userSchema });

/** @typedef {import('zod').infer<typeof userSchema>} User */
/** @typedef {import('zod').infer<typeof signupSchema>} SignupInput */
/** @typedef {import('zod').infer<typeof loginSchema>} LoginInput */
