/**
 * Server-controlled registry of protected tools the orchestration loop may
 * invoke. Neither Claude nor Jev selects a tool or a database command
 * directly — a workflow names one of these keys, and only code in
 * supabase/functions/ai-orchestrate implements what it actually does.
 * Every entry here is currently read-only by design — see
 * ai-orchestrate/index.ts's doc comment for why this phase never performs
 * the actual financial-record write.
 */
export type ToolName = 'lookup_matching_bill';

export interface ToolDefinition {
  isConsequential: boolean;
  description: string;
}

export const TOOL_REGISTRY: Record<ToolName, ToolDefinition> = {
  lookup_matching_bill: {
    isConsequential: false,
    description:
      "Read-only lookup against the caller's own bills to find a name match for a proposed payment. Never writes.",
  },
};

export function isKnownTool(value: unknown): value is ToolName {
  return typeof value === 'string' && value in TOOL_REGISTRY;
}
