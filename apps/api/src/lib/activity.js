import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { isGraphBubbleUp } from '@langchain/langgraph';
import { publishRunEvent } from './runEvents.js';

export const nodeActivity = new AsyncLocalStorage();

// Measure the operation itself, excluding persistence and event delivery.
// Persist each transition so polling and reconnects see the same tools as SSE.
export async function observeTool(name, raison, operation, describe = () => 'Terminé', fallback = {}) {
  const activity = nodeActivity.getStore();
  const context = activity ?? fallback;
  const startedAt = new Date().toISOString();
  const tool = { id: randomUUID(), name, raison: raison ?? null, startedAt, at: startedAt, status: 'running', outcome: 'En cours…' };
  const emit = async () => {
    if (activity) await activity.record(tool);
    await publishRunEvent(context.runId, { type: 'tool', node: context.node ?? 'inconnu', ...tool });
  };
  await emit();
  const start = performance.now();
  try {
    const result = await operation();
    Object.assign(tool, { status: result?.error ? 'error' : 'ok', outcome: describe(result), ms: Math.round(performance.now() - start), at: new Date().toISOString() });
    await emit();
    return result;
  } catch (error) {
    Object.assign(tool, { status: isGraphBubbleUp(error) ? 'paused' : 'error', outcome: isGraphBubbleUp(error) ? 'En attente de votre réponse' : error.message, ms: Math.round(performance.now() - start), at: new Date().toISOString() });
    await emit();
    throw error;
  }
}
