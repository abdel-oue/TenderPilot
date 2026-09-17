/**
 * Per-request context, carried on an AsyncLocalStorage.
 *
 * Token usage has to be attributable to the request that caused it, but the calls
 * that spend the tokens happen deep inside the graph - eight frames below the
 * route handler. Threading a correlation id through every node signature would
 * put plumbing in the signature of every agent, and the one place someone forgets
 * to pass it is the one call that silently stops being counted.
 *
 * AsyncLocalStorage is a Node built-in and survives await boundaries, so the
 * store set in the route is still readable from inside a BullMQ job's promise
 * chain without anyone passing anything.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

const storage = new AsyncLocalStorage();

/**
 * Runs `fn` with a fresh context. Everything awaited inside sees it.
 * @template T
 * @param {{ requestId?: string, runId?: string|null, tenderId?: string|null }} context
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export function runWithContext(context, fn) {
  return storage.run(
    { requestId: context.requestId ?? randomUUID(), runId: null, tenderId: null, ...context },
    fn,
  );
}

/**
 * The active context, or a standalone one when there is none - a script or a test
 * calling an agent directly still produces attributable usage rows rather than
 * crashing or writing null.
 * @returns {{ requestId: string, runId: string|null, tenderId: string|null }}
 */
export function getContext() {
  return storage.getStore() ?? { requestId: 'detached', runId: null, tenderId: null };
}

/**
 * Merges fields into the active context, e.g. the runId once the graph run row
 * exists. A no-op when there is no active context.
 * @param {{ runId?: string|null, tenderId?: string|null }} patch
 * @returns {void}
 */
export function setContext(patch) {
  const store = storage.getStore();
  if (store) Object.assign(store, patch);
}
