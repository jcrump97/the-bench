import { describe, it, expect, vi } from 'vitest';
import { selectCaseSource } from '../useCaseSource';
import { DEMO_CASES } from '../../lib/demoCases';

// createGameService opens no connection at construction time, but stub it
// anyway so this test can assert *which* source was chosen without depending
// on the real client's shape.
vi.mock('../../lib/llm/gameService', () => ({
  createGameService: vi.fn((apiKey: string) => ({
    generateCase: () => Promise.reject(new Error('stub')),
    generateAftermath: () => Promise.reject(new Error('stub')),
    __apiKey: apiKey,
  })),
}));

import { createGameService } from '../../lib/llm/gameService';

// Fixture, not a credential — see the note in useSecurityStore.test.ts for
// why this is 34 characters and not a real key's 39.
const VALID_KEY = 'AIzaNotARealKey_ExampleOnly_000000';
const bundle = DEMO_CASES[0]!;

describe('selectCaseSource', () => {
  it('returns null with neither a bundle nor a key', () => {
    // Off-path: an active case belonging to no known source. Callers force
    // ERROR_STATE on this rather than silently doing nothing.
    expect(selectCaseSource(undefined, null)).toBeNull();
  });

  it('resolves a demo bundle offline', async () => {
    const source = selectCaseSource(bundle, null);
    expect(source).not.toBeNull();
    expect(vi.mocked(createGameService)).not.toHaveBeenCalled();

    const generated = await source!.generateCase();
    expect(generated.payload).toBe(bundle.payload);
    expect(generated.pleaNarrative).toBe(bundle.pleaNarrative);
  });

  it('builds a GameService source from a vaulted key', () => {
    const source = selectCaseSource(undefined, VALID_KEY);
    expect(source).not.toBeNull();
    expect(vi.mocked(createGameService)).toHaveBeenCalledWith(VALID_KEY);
  });

  it('prefers the demo bundle when both are available', async () => {
    // The precedence that matters financially: a hand-authored demo case must
    // not be regenerated through the player's own API quota just because they
    // also happen to have a key vaulted.
    vi.mocked(createGameService).mockClear();

    const source = selectCaseSource(bundle, VALID_KEY);
    expect(vi.mocked(createGameService)).not.toHaveBeenCalled();

    const generated = await source!.generateCase();
    expect(generated.payload).toBe(bundle.payload);
  });
});
