// Central feature-flag reads for the Jev/Claude orchestration layer. Every
// flag defaults OFF (or to the conservative numeric default) so an unset
// env var never silently turns on new behavior — flipping a flag back to
// false is always enough to fully roll back this feature, with no code
// deploy needed. See docs/ai-orchestrator-setup.md for how to set these.
function readBoolFlag(name: string, defaultValue: boolean): boolean {
  const raw = Deno.env.get(name);
  if (raw === undefined) return defaultValue;
  return raw.trim().toLowerCase() === 'true';
}

function readPositiveIntFlag(name: string, defaultValue: number): number {
  const raw = Deno.env.get(name);
  if (raw === undefined) return defaultValue;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

export function isJevOrchestratorEnabled(): boolean {
  return readBoolFlag('JEV_ORCHESTRATOR_ENABLED', false);
}

export function isJevVoiceRoutingEnabled(): boolean {
  return readBoolFlag('JEV_VOICE_ROUTING_ENABLED', false);
}

/** Not read by any function yet in Phase 1 — reserved for the future, documented-only onboarding integration point. */
export function isJevOnboardingEnabled(): boolean {
  return readBoolFlag('JEV_ONBOARDING_ENABLED', false);
}

/** Used by the Phase 2 complex-task loop; exported now so flags.ts stays the one place every orchestration env var is read. */
export function getMaxOrchestratorLoops(): number {
  return readPositiveIntFlag('AI_ORCHESTRATOR_MAX_LOOPS', 3);
}
