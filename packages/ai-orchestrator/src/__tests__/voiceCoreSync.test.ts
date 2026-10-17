import { readFileSync } from 'fs';
import path from 'path';

// supabase/functions/_shared/voice-core.ts is what actually runs in
// production (Deno can't import this workspace package), while voice.ts is
// what voice.test.ts exercises. This is what makes those tests mean
// anything about the deployed code: the two files must be identical.
describe('voice core (Deno copy)', () => {
  it('is byte-identical to packages/ai-orchestrator/src/voice.ts', () => {
    const source = readFileSync(path.join(__dirname, '..', 'voice.ts'), 'utf8');
    const denoCopy = readFileSync(
      path.join(
        __dirname,
        '..',
        '..',
        '..',
        '..',
        'supabase',
        'functions',
        '_shared',
        'voice-core.ts'
      ),
      'utf8'
    );
    expect(denoCopy).toBe(source);
  });

  it('has no imports, so the same file runs unchanged on Deno and Node', () => {
    const source = readFileSync(path.join(__dirname, '..', 'voice.ts'), 'utf8');
    expect(source).not.toMatch(/^\s*import\s/m);
  });
});
