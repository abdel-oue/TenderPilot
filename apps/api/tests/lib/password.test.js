import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/lib/password.js';

describe('password', () => {
  it('accepts the password it hashed', async () => {
    expect(await verifyPassword('correct horse', await hashPassword('correct horse'))).toBe(true);
  });

  it('rejects a wrong password', async () => {
    expect(await verifyPassword('wrong', await hashPassword('correct horse'))).toBe(false);
  });

  it('salts: the same password hashes differently every time', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });

  it('rejects a malformed stored hash instead of throwing', async () => {
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('x', 'scrypt$zz$zz')).toBe(false);
  });
});
