import { describe, it, expect } from 'vitest';
import { BYOKSchema } from '../../schemas/gameSchemas';

// Smoke test: proves the Vitest runner and module resolution work end to end.
describe('vitest smoke', () => {
  it('parses a valid demo-mode vault', () => {
    expect(BYOKSchema.safeParse({ isDemo: true }).success).toBe(true);
  });

  it('rejects a malformed live vault', () => {
    expect(BYOKSchema.safeParse({ isDemo: false, apiKey: 'too-short' }).success).toBe(false);
  });
});
