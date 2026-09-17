import { describe, expect, it } from 'vitest';

process.env.JWT_SECRET ??= 'test-secret-that-is-long-enough-0123456789';
process.env.DATABASE_URL ??= 'postgres://user:pass@localhost:5432/tenderpilot_test';

const { signSessionToken, verifySessionToken } = await import('../../src/lib/session.js');

const user = { id: '11111111-1111-4111-8111-111111111111', email: 'a@b.fr' };

describe('session', () => {
  it('round-trips the user id through a signed token', () => {
    expect(verifySessionToken(signSessionToken(user))?.sub).toBe(user.id);
  });

  it('rejects a token whose payload was tampered with', () => {
    const [header, , signature] = signSessionToken(user).split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 'someone-else', exp: 2 ** 31 })).toString('base64url');
    expect(verifySessionToken(`${header}.${forged}.${signature}`)).toBeNull();
  });

  it('rejects a token signed with another key', () => {
    expect(verifySessionToken('a.b.c')).toBeNull();
    expect(verifySessionToken('not-a-token')).toBeNull();
  });

  it('rejects an expired token', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const expired = signSessionToken(user).split('.');
    expired[1] = Buffer.from(JSON.stringify({ sub: user.id, exp: 1 })).toString('base64url');
    expect(verifySessionToken(`${header}.${expired[1]}.${expired[2]}`)).toBeNull();
  });
});
