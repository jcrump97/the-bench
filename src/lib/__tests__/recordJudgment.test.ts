import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { recordJudgment } from '../recordJudgment';
import { loadFinalResults } from '../resultArchive';
import { useGameStore } from '../../store/useGameStore';
import { webbCase } from '../demoCases/webb';
import type { Sentence } from '../../schemas/gameSchemas';

const SENTENCE: Sentence[] = [{ type: 'PRISON', unit: 'YEARS', amount: 2 }];
const AFTERMATH = 'The courthouse emptied by four.';

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() { return data.size; },
  };
}

// Walk the real state machine to the moment the judgment is recorded: the
// last instant of ACT_3_VERDICT, after the sentence is imposed.
function playToSentencing(pleaDecision: 'ACCEPT' | 'REJECT'): void {
  const store = useGameStore.getState();
  store.setActiveCase(webbCase.payload);
  store.setActivePleaNarrative(webbCase.pleaNarrative);
  store.setPhase('ACT_1_INTAKE');
  useGameStore.getState().setPleaDecision(pleaDecision);
  if (pleaDecision === 'ACCEPT') {
    useGameStore.getState().setPhase('ACT_3_VERDICT');
  } else {
    useGameStore.getState().setPhase('ACT_2_MOTIONS');
    for (const item of webbCase.payload.evidence) {
      useGameStore.getState().addMotionRuling({ evidenceId: item.id, ruling: 'ADMITTED' });
    }
    useGameStore.getState().setPhase('ACT_3_VERDICT');
    for (const charge of webbCase.payload.charges) {
      useGameStore.getState().addChargeVerdict({
        chargeId: charge.id,
        chargeName: charge.name,
        classification: charge.classification,
        verdict: 'GUILTY',
      });
    }
  }
  useGameStore.getState().setImposedSentence(SENTENCE);
  useGameStore.getState().setAftermathNarrative(AFTERMATH);
}

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage());
  useGameStore.getState().resetGameState();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('recordJudgment', () => {
  it('validates the snapshot into the store and archives the same object', () => {
    playToSentencing('ACCEPT');
    recordJudgment(AFTERMATH, SENTENCE);

    const stored = useGameStore.getState().finalResult;
    expect(stored).not.toBeNull();
    expect(stored?.resolutionPath).toBe('PLEA');
    expect(stored?.caseId).toBe(webbCase.payload.caseId);
    expect(stored?.imposedSentence).toEqual(SENTENCE);
    expect(stored?.aftermathNarrative).toBe(AFTERMATH);
    expect(useGameStore.getState().currentPhase).toBe('ACT_3_VERDICT');
    expect(loadFinalResults()).toEqual([stored]);
  });

  it('records the trial path with its rulings and verdicts', () => {
    playToSentencing('REJECT');
    recordJudgment(AFTERMATH, SENTENCE);

    const stored = useGameStore.getState().finalResult;
    if (stored?.resolutionPath !== 'TRIAL') throw new Error('expected the trial path');
    expect(stored.pleaOutcome).toBe('JUDGE_FORCED_TRIAL');
    expect(stored.motionRulings).toHaveLength(webbCase.payload.evidence.length);
    expect(stored.verdict).toHaveLength(webbCase.payload.charges.length);
  });

  it('accumulates a record across cases', () => {
    playToSentencing('ACCEPT');
    recordJudgment(AFTERMATH, SENTENCE);
    useGameStore.getState().resetGameState();
    playToSentencing('REJECT');
    recordJudgment(AFTERMATH, SENTENCE);

    expect(loadFinalResults().map((r) => r.resolutionPath)).toEqual(['TRIAL', 'PLEA']);
  });

  it('throws off-path rather than archiving a snapshot of a case that is not loaded', () => {
    expect(() => recordJudgment(AFTERMATH, SENTENCE)).toThrow(/active case/);
    expect(loadFinalResults()).toEqual([]);
  });

  it('archives nothing when the snapshot fails the store schema gate', () => {
    playToSentencing('ACCEPT');
    // An aftermath longer than AftermathNarrativeSchema allows can only get
    // this far by bypassing the store's own setter — the snapshot carries it,
    // so FinalResultSchema is the gate that catches it.
    recordJudgment('x'.repeat(4001), SENTENCE);

    expect(useGameStore.getState().finalResult).toBeNull();
    expect(useGameStore.getState().currentPhase).toBe('ERROR_STATE');
    expect(loadFinalResults()).toEqual([]);
  });
});
