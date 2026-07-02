import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../useGameStore';
import { validCase } from '../../lib/__tests__/fixtures';

beforeEach(() => {
  useGameStore.getState().resetGameState();
});

describe('useGameStore — activePleaNarrative', () => {
  it('accepts a valid narrative while at WELCOME', () => {
    useGameStore.getState().setActivePleaNarrative({
      prosecutionRationale: 'The evidence is strong.',
      defenseRationale: 'The defense disagrees.',
    });
    expect(useGameStore.getState().activePleaNarrative).toEqual({
      prosecutionRationale: 'The evidence is strong.',
      defenseRationale: 'The defense disagrees.',
    });
    expect(useGameStore.getState().currentPhase).toBe('WELCOME');
  });

  it('accepts a narrative with no defenseRationale (WEAK/NO_OFFER shape)', () => {
    useGameStore.getState().setActivePleaNarrative({
      prosecutionRationale: 'The People decline to offer.',
    });
    expect(useGameStore.getState().activePleaNarrative).toEqual({
      prosecutionRationale: 'The People decline to offer.',
    });
  });

  it('force-resets to ERROR_STATE on a malformed narrative', () => {
    useGameStore.getState().setActivePleaNarrative({ prosecutionRationale: '' });
    expect(useGameStore.getState().currentPhase).toBe('ERROR_STATE');
    expect(useGameStore.getState().activePleaNarrative).toBeNull();
  });

  it('force-resets to ERROR_STATE when called outside WELCOME', () => {
    useGameStore.getState().setActiveCase(validCase);
    useGameStore.getState().setPhase('ACT_1_INTAKE');

    useGameStore.getState().setActivePleaNarrative({ prosecutionRationale: 'Too late.' });
    expect(useGameStore.getState().currentPhase).toBe('ERROR_STATE');
    expect(useGameStore.getState().activePleaNarrative).toBeNull();
  });

  it('resetGameState clears activePleaNarrative back to null', () => {
    useGameStore.getState().setActivePleaNarrative({ prosecutionRationale: 'Some rationale.' });
    useGameStore.getState().resetGameState();
    expect(useGameStore.getState().activePleaNarrative).toBeNull();
    expect(useGameStore.getState().currentPhase).toBe('WELCOME');
  });
});

describe('useGameStore — case + narrative load atomically at WELCOME', () => {
  it('loads case then narrative then transitions to ACT_1_INTAKE without error', () => {
    useGameStore.getState().setActiveCase(validCase);
    useGameStore.getState().setActivePleaNarrative({ prosecutionRationale: 'Ready for intake.' });
    useGameStore.getState().setPhase('ACT_1_INTAKE');

    expect(useGameStore.getState().currentPhase).toBe('ACT_1_INTAKE');
    expect(useGameStore.getState().activeCase).not.toBeNull();
    expect(useGameStore.getState().activePleaNarrative).toEqual({ prosecutionRationale: 'Ready for intake.' });
  });
});
