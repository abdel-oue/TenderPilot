import { describe, expect, it } from 'vitest';
import { loginSchema, signupSchema, userSchema } from '@tenderpilot/shared';

describe('auth schemas', () => {
  it('accepts a well-formed signup body', () => {
    expect(signupSchema.safeParse({ email: 'a@b.fr', name: 'Amine', password: 'longenough' }).success).toBe(true);
  });

  it('refuses a signup with a password under 8 characters', () => {
    expect(signupSchema.safeParse({ email: 'a@b.fr', name: 'Amine', password: 'short' }).success).toBe(false);
  });

  it('refuses a signup with a malformed email', () => {
    expect(signupSchema.safeParse({ email: 'not-an-email', name: 'Amine', password: 'longenough' }).success).toBe(false);
  });

  it('refuses a login missing the password entirely', () => {
    expect(loginSchema.safeParse({ email: 'a@b.fr' }).success).toBe(false);
  });

  it('refuses a user payload that leaks a password hash field only by keeping it out', () => {
    const parsed = userSchema.parse({ id: '11111111-1111-4111-8111-111111111111', email: 'a@b.fr', name: 'Amine', createdAt: new Date(), passwordHash: 'leak' });
    expect(parsed).not.toHaveProperty('passwordHash');
  });
});
