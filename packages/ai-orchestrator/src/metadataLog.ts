import type { OrchestrationLogEntry } from './types';

/**
 * Builds a log line from a strict, explicit field allowlist — the function
 * signature itself is the safety mechanism. A caller cannot accidentally
 * spread a raw request body, prompt, financial message, or API key into a
 * log line here, because this function never accepts anything but the
 * named `OrchestrationLogEntry` fields. Compare to `console.error(error)`
 * elsewhere in this codebase, which is fine for a generic error (no PII by
 * construction) but would be the wrong tool for anything touching a Jev or
 * Claude call.
 */
export function buildLogEntry(entry: OrchestrationLogEntry): OrchestrationLogEntry {
  return {
    requestId: entry.requestId,
    userId: entry.userId,
    workflowName: entry.workflowName,
    model: entry.model,
    decision: entry.decision,
    confidence: entry.confidence,
    latencyMs: entry.latencyMs,
    tokensUsed: entry.tokensUsed,
    costUsd: entry.costUsd,
    iteration: entry.iteration,
    status: entry.status,
    userCorrected: entry.userCorrected,
  };
}

/** JSON-serializes an already-built log entry for `console.log`. */
export function formatLogLine(entry: OrchestrationLogEntry): string {
  return JSON.stringify(buildLogEntry(entry));
}
