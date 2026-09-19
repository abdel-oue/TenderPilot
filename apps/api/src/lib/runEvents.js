/**
 * Live run events, over the Redis that BullMQ already needs.
 *
 * The durable trace stays in `analysis_runs.node_trace`; this is a mirror with a
 * shorter latency, nothing more. The worker publishes, the api's SSE route
 * subscribes and forwards, and if Redis or the stream drops, the screen falls
 * back to the poll it has always had. Nothing here is a source of truth, which
 * is why every failure below is swallowed rather than surfaced: a dropped event
 * costs a second of freshness, and killing an analysis over it would be worse.
 *
 * Why a tool event exists at all: `traced()` writes one trace row per NODE, so a
 * node that calls six tools over twenty seconds is silent and then says
 * everything at once. The tool event fires from the dispatch site the moment one
 * tool returns, which is the only way the reader sees the agent working rather
 * than the agent having worked.
 */
import Redis from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

/** @param {string} runId @returns {string} */
function channel(runId) {
  return 'run:' + runId;
}

// One publisher for the process. A subscriber is created per stream instead,
// because a Redis connection in subscriber mode may not issue other commands -
// sharing one would mean every listener receiving every run's events.
let publisher = null;

/** @returns {import('ioredis').Redis} */
function getPublisher() {
  if (publisher) return publisher;
  publisher = new Redis(env.REDIS_URL, {
    // `enableOfflineQueue: false` is the load-bearing one. By default ioredis
    // BUFFERS commands issued while it is not connected and resolves them if it
    // ever reconnects - so on an unreachable Redis this publish never settles,
    // and since it is awaited from inside the tool dispatch, every tool call
    // hangs with it. Telemetry must fail instantly, not hold up the agent.
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    connectTimeout: 2_000,
  });
  // An unreachable Redis emits 'error' on the connection itself, which is an
  // unhandled event and therefore a crashed process if nobody listens. Attached
  // exactly once, here inside the construction: hanging it off every call to
  // this function adds a listener per published event.
  publisher.on('error', (error) => {
    logger.debug({ err: error.message }, 'runEvents: publisher connection error');
  });
  return publisher;
}

/**
 * Fire-and-forget. Never awaited by a caller that matters and never throws.
 *
 * @param {string|null|undefined} runId no-op when absent, so a caller outside a run needs no guard
 * @param {object} event already the public shape - see runEventSchema in packages/shared
 * @returns {Promise<void>}
 */
export async function publishRunEvent(runId, event) {
  if (!runId) return;
  try {
    await getPublisher().publish(channel(runId), JSON.stringify(event));
  } catch (error) {
    logger.debug({ runId, err: error.message }, 'runEvents: publish failed');
  }
}

/**
 * Subscribes one listener to one run. The caller owns the returned function and
 * must call it, or the connection leaks for as long as the process lives.
 *
 * @param {string} runId
 * @param {(event: object) => void} onEvent called with the parsed event; a malformed payload is dropped
 * @returns {Promise<() => Promise<void>>} unsubscribe
 */
export async function subscribeRunEvents(runId, onEvent) {
  const subscriber = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  await subscriber.subscribe(channel(runId));
  subscriber.on('message', (_channel, payload) => {
    try {
      onEvent(JSON.parse(payload));
    } catch {
      // A payload we cannot parse is a bug on the publishing side, not a reason
      // to tear down a stream that is otherwise delivering.
    }
  });
  return async () => {
    try {
      await subscriber.quit();
    } catch {
      subscriber.disconnect();
    }
  };
}

/** @returns {Promise<void>} */
export async function closeRunEvents() {
  if (!publisher) return;
  const closing = publisher;
  publisher = null;
  await closing.quit().catch(() => closing.disconnect());
}
