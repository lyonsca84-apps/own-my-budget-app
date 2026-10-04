import { isKnownTool, TOOL_REGISTRY } from '../toolRegistry';

describe('TOOL_REGISTRY', () => {
  it('every registered tool is read-only (non-consequential) in this phase', () => {
    for (const tool of Object.values(TOOL_REGISTRY)) {
      expect(tool.isConsequential).toBe(false);
    }
  });

  it('every tool has a non-empty description', () => {
    for (const tool of Object.values(TOOL_REGISTRY)) {
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });
});

describe('isKnownTool', () => {
  it('accepts a registered tool name', () => {
    expect(isKnownTool('lookup_matching_bill')).toBe(true);
  });

  it('rejects an arbitrary client-supplied tool name — the allowlist guarantee', () => {
    expect(isKnownTool('delete_all_bills')).toBe(false);
    expect(isKnownTool('run_sql')).toBe(false);
    expect(isKnownTool(42)).toBe(false);
    expect(isKnownTool(null)).toBe(false);
  });
});
