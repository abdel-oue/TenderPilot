import { describe, expect, it } from 'vitest';
import AuthService from '../../src/services/auth.service.js';

/** A user repository holding exactly these rows, keyed by email. */
function fakeUsers(existing = {}) {
  const inserted = [];
  return {
    inserted,
    async findByEmailWithHash(email) { return existing[email]; },
    async insert(values) { inserted.push(values); return { id: 'demo-user', ...values }; },
  };
}

/** Records what the clone was asked to copy, and from where. */
function fakeDemo() {
  const calls = { cloned: [], reaped: 0 };
  return {
    calls,
    async deleteExpiredDemoUsers() { calls.reaped += 1; return 0; },
    async cloneWorkspace(from, to) { calls.cloned.push({ from, to }); return {}; },
  };
}

const SEED = { 'demo@tenderpilot.local': { id: 'seed-owner', email: 'demo@tenderpilot.local' } };

describe('AuthService.startDemo', () => {
  it('mints a throwaway account rather than handing out the seeded one', async () => {
    const users = fakeUsers(SEED);
    const { user } = await new AuthService(users, fakeDemo()).startDemo();

    expect(user.id).not.toBe('seed-owner');
    expect(user.email).toMatch(/^demo-[0-9a-f]{8}@tenderpilot\.local$/);
  });

  it('clones the seeded workspace onto the new account, in that direction', async () => {
    const demo = fakeDemo();
    await new AuthService(fakeUsers(SEED), demo).startDemo();

    expect(demo.calls.cloned).toEqual([{ from: 'seed-owner', to: 'demo-user' }]);
  });

  it('reaps expired demo accounts on the way in, so nothing has to schedule it', async () => {
    const demo = fakeDemo();
    await new AuthService(fakeUsers(SEED), demo).startDemo();

    expect(demo.calls.reaped).toBe(1);
  });

  it('refuses with DEMO_UNAVAILABLE when the dataset was never seeded', async () => {
    const demo = fakeDemo();
    // An empty database is the normal state of a fresh clone - it must say so
    // rather than opening an empty workspace that looks like a broken product.
    await expect(new AuthService(fakeUsers({}), demo).startDemo()).rejects.toMatchObject({
      code: 'DEMO_UNAVAILABLE',
      status: 503,
    });
    expect(demo.calls.cloned).toHaveLength(0);
  });

  it('gives each visitor a different account', async () => {
    const users = fakeUsers(SEED);
    const service = new AuthService(users, fakeDemo());
    await service.startDemo();
    await service.startDemo();

    expect(users.inserted[0].email).not.toBe(users.inserted[1].email);
  });
});
