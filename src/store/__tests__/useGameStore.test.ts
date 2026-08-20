import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../useGameStore';
import { validCase } from '../../lib/__tests__/fixtures';
import type { GamePhase } from '../../schemas/gameSchemas';

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

describe('useGameStore — aftermathNarrative', () => {
  function advanceToAct3(): void {
    useGameStore.getState().setActiveCase(validCase);
    useGameStore.getState().setPhase('ACT_1_INTAKE');
    useGameStore.getState().setPleaDecision('ACCEPT');
    useGameStore.getState().setPhase('ACT_3_VERDICT');
  }

  it('accepts a valid narrative while at ACT_3_VERDICT', () => {
    advanceToAct3();
    useGameStore.getState().setAftermathNarrative('The press had a field day.');
    expect(useGameStore.getState().aftermathNarrative).toBe('The press had a field day.');
    expect(useGameStore.getState().currentPhase).toBe('ACT_3_VERDICT');
  });

  it('force-resets to ERROR_STATE when written outside ACT_3_VERDICT', () => {
    useGameStore.getState().setAftermathNarrative('Too early.');
    expect(useGameStore.getState().currentPhase).toBe('ERROR_STATE');
    expect(useGameStore.getState().aftermathNarrative).toBeNull();
  });

  it('force-resets to ERROR_STATE on a malformed narrative', () => {
    advanceToAct3();
    useGameStore.getState().setAftermathNarrative('');
    expect(useGameStore.getState().currentPhase).toBe('ERROR_STATE');
    expect(useGameStore.getState().aftermathNarrative).toBeNull();
  });

  it('resetGameState clears aftermathNarrative back to null', () => {
    advanceToAct3();
    useGameStore.getState().setAftermathNarrative('An ending.');
    useGameStore.getState().resetGameState();
    expect(useGameStore.getState().aftermathNarrative).toBeNull();
  });
});

describe('useGameStore — addMotionRuling phase gate', () => {
  function advanceToAct2(): void {
    useGameStore.getState().setActiveCase(validCase);
    useGameStore.getState().setPhase('ACT_1_INTAKE');
    useGameStore.getState().setPhase('ACT_2_MOTIONS');
  }

  it('accepts and dedupes rulings by evidenceId during ACT_2_MOTIONS', () => {
    advanceToAct2();
    useGameStore.getState().addMotionRuling({ evidenceId: 'e1', ruling: 'ADMITTED' });
    useGameStore.getState().addMotionRuling({ evidenceId: 'e2', ruling: 'EXCLUDED' });
    useGameStore.getState().addMotionRuling({ evidenceId: 'e1', ruling: 'EXCLUDED' });
    expect(useGameStore.getState().motionRulings).toEqual([
      { evidenceId: 'e2', ruling: 'EXCLUDED' },
      { evidenceId: 'e1', ruling: 'EXCLUDED' },
    ]);
  });

  it('force-resets to ERROR_STATE when a ruling is made outside ACT_2_MOTIONS', () => {
    useGameStore.getState().addMotionRuling({ evidenceId: 'e1', ruling: 'ADMITTED' });
    expect(useGameStore.getState().currentPhase).toBe('ERROR_STATE');
    expect(useGameStore.getState().motionRulings).toEqual([]);
  });
});

describe('useGameStore — addChargeVerdict', () => {
  const guilty = {
    chargeId: 'c1',
    chargeName: 'Second-degree burglary',
    classification: 'FELONY',
    verdict: 'GUILTY',
  };

  function advanceToAct3(): void {
    useGameStore.getState().setActiveCase(validCase);
    useGameStore.getState().setPhase('ACT_1_INTAKE');
    useGameStore.getState().setPleaDecision('ACCEPT');
    useGameStore.getState().setPhase('ACT_3_VERDICT');
  }

  it('accepts a verdict per charge during ACT_3_VERDICT and upserts by chargeId', () => {
    advanceToAct3();
    useGameStore.getState().addChargeVerdict(guilty);
    useGameStore.getState().addChargeVerdict({ ...guilty, verdict: 'NOT_GUILTY' });
    expect(useGameStore.getState().chargeVerdicts).toEqual([{ ...guilty, verdict: 'NOT_GUILTY' }]);
  });

  it('force-resets to ERROR_STATE when a verdict is entered outside ACT_3_VERDICT', () => {
    useGameStore.getState().addChargeVerdict(guilty);
    expect(useGameStore.getState().currentPhase).toBe('ERROR_STATE');
    expect(useGameStore.getState().chargeVerdicts).toEqual([]);
  });

  it('force-resets to ERROR_STATE on a malformed verdict', () => {
    advanceToAct3();
    useGameStore.getState().addChargeVerdict({ ...guilty, verdict: 'MAYBE' });
    expect(useGameStore.getState().currentPhase).toBe('ERROR_STATE');
    expect(useGameStore.getState().chargeVerdicts).toEqual([]);
  });
});

describe('useGameStore — spokenJudgeLines / recordSpokenJudgeLine', () => {
  it('records a line under a valid plea decision id', () => {
    useGameStore.getState().recordSpokenJudgeLine('plea', 'The court accepts the plea.');
    expect(useGameStore.getState().spokenJudgeLines).toEqual({ plea: 'The court accepts the plea.' });
  });

  it('records a line under a valid motion-<evidenceId> id', () => {
    useGameStore.getState().recordSpokenJudgeLine('motion-e1', 'Admitted.');
    expect(useGameStore.getState().spokenJudgeLines).toEqual({ 'motion-e1': 'Admitted.' });
  });

  it('records a line under a valid verdict-<chargeId> id', () => {
    useGameStore.getState().recordSpokenJudgeLine('verdict-c1', 'Guilty.');
    expect(useGameStore.getState().spokenJudgeLines).toEqual({ 'verdict-c1': 'Guilty.' });
  });

  it('overwrites the line on re-recording the same decision id', () => {
    useGameStore.getState().recordSpokenJudgeLine('plea', 'First phrasing.');
    useGameStore.getState().recordSpokenJudgeLine('plea', 'Second phrasing.');
    expect(useGameStore.getState().spokenJudgeLines).toEqual({ plea: 'Second phrasing.' });
  });

  it('force-resets to ERROR_STATE on an invalid decision id shape', () => {
    useGameStore.getState().recordSpokenJudgeLine('not-a-real-id', 'Some line.');
    expect(useGameStore.getState().currentPhase).toBe('ERROR_STATE');
    expect(useGameStore.getState().spokenJudgeLines).toEqual({});
  });

  it('force-resets to ERROR_STATE on empty lineText', () => {
    useGameStore.getState().recordSpokenJudgeLine('plea', '');
    expect(useGameStore.getState().currentPhase).toBe('ERROR_STATE');
    expect(useGameStore.getState().spokenJudgeLines).toEqual({});
  });

  it('force-resets to ERROR_STATE on lineText over 300 chars', () => {
    useGameStore.getState().recordSpokenJudgeLine('plea', 'x'.repeat(301));
    expect(useGameStore.getState().currentPhase).toBe('ERROR_STATE');
    expect(useGameStore.getState().spokenJudgeLines).toEqual({});
  });

  it('resetGameState clears spokenJudgeLines back to {}', () => {
    useGameStore.getState().recordSpokenJudgeLine('plea', 'A line.');
    useGameStore.getState().resetGameState();
    expect(useGameStore.getState().spokenJudgeLines).toEqual({});
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

// ---------------------------------------------------------------------------
// Characterization coverage for the transition matrix itself.
//
// ALLOWED_PHASE_TRANSITIONS is the state machine's whole contract, and until
// now nothing exercised it directly — the suite covered the individual
// actions' phase gates but never the table they all depend on. These tests
// pin every (from, to) pair so the matrix cannot be widened, narrowed, or
// reordered without a failure naming the exact pair that moved.
// ---------------------------------------------------------------------------
const ALL_PHASES = [
  'WELCOME',
  'ACT_1_INTAKE',
  'ACT_2_MOTIONS',
  'ACT_3_VERDICT',
  'END_STATE',
  'ERROR_STATE',
] as const satisfies readonly GamePhase[];

// The matrix as the store declares it, restated here on purpose: a test that
// imported the real table would pass no matter how the table changed.
const EXPECTED_TRANSITIONS: Record<GamePhase, readonly GamePhase[]> = {
  WELCOME: ['ACT_1_INTAKE', 'ERROR_STATE'],
  ACT_1_INTAKE: ['ACT_2_MOTIONS', 'ACT_3_VERDICT', 'ERROR_STATE'],
  ACT_2_MOTIONS: ['ACT_3_VERDICT', 'ERROR_STATE'],
  ACT_3_VERDICT: ['END_STATE', 'ERROR_STATE'],
  END_STATE: ['ERROR_STATE'],
  ERROR_STATE: ['WELCOME'],
};

// Every phase is reachable only by walking legal transitions — the store
// offers no back door, which is the point. ERROR_STATE is reached the way the
// app reaches it: by attempting something illegal.
function driveTo(phase: GamePhase): void {
  useGameStore.getState().resetGameState();
  if (phase === 'ERROR_STATE') {
    useGameStore.getState().setPhase('END_STATE'); // illegal from WELCOME
    return;
  }
  // Loaded even for the WELCOME case: entering ACT_1_INTAKE is gated on an
  // active case, and that guard has its own test below. Without this, the
  // matrix table would be re-testing the guard instead of the matrix.
  useGameStore.getState().setActiveCase(validCase);
  if (phase === 'WELCOME') return;
  useGameStore.getState().setPhase('ACT_1_INTAKE');
  if (phase === 'ACT_1_INTAKE') return;
  if (phase === 'ACT_2_MOTIONS') {
    useGameStore.getState().setPhase('ACT_2_MOTIONS');
    return;
  }
  useGameStore.getState().setPhase('ACT_3_VERDICT');
  if (phase === 'ACT_3_VERDICT') return;
  useGameStore.getState().setPhase('END_STATE');
}

describe('useGameStore — ALLOWED_PHASE_TRANSITIONS', () => {
  it('driveTo reaches every phase, so the table below is actually exercised', () => {
    for (const phase of ALL_PHASES) {
      driveTo(phase);
      expect(useGameStore.getState().currentPhase).toBe(phase);
    }
  });

  for (const from of ALL_PHASES) {
    for (const to of ALL_PHASES) {
      const legal = EXPECTED_TRANSITIONS[from].includes(to);

      it(`${legal ? 'allows' : 'blocks'} ${from} -> ${to}`, () => {
        driveTo(from);
        useGameStore.getState().setPhase(to);

        if (legal) {
          expect(useGameStore.getState().currentPhase).toBe(to);
        } else {
          // An illegal transition does not merely refuse — it force-resets.
          expect(useGameStore.getState().currentPhase).toBe('ERROR_STATE');
          expect(useGameStore.getState().activeCase).toBeNull();
        }
      });
    }
  }

  it('a legal transition into ERROR_STATE preserves state; an illegal one wipes it', () => {
    // Both land on ERROR_STATE, so the phase alone cannot tell them apart.
    // The difference is the payload: `set({ currentPhase })` on the legal
    // path vs. ERROR_RESET on the illegal one.
    driveTo('ACT_1_INTAKE');
    useGameStore.getState().setPhase('ERROR_STATE');
    expect(useGameStore.getState().currentPhase).toBe('ERROR_STATE');
    expect(useGameStore.getState().activeCase).not.toBeNull();

    driveTo('ACT_1_INTAKE');
    useGameStore.getState().setPhase('WELCOME');
    expect(useGameStore.getState().currentPhase).toBe('ERROR_STATE');
    expect(useGameStore.getState().activeCase).toBeNull();
  });

  it('force-resets to ERROR_STATE on a phase value outside the schema', () => {
    useGameStore.getState().setPhase('ADJOURNED');
    expect(useGameStore.getState().currentPhase).toBe('ERROR_STATE');
  });

  it('blocks entry to ACT_1_INTAKE when no case is loaded', () => {
    // A legal transition by the matrix, refused by the guard: the intake act
    // has nothing to arraign without a case.
    expect(useGameStore.getState().currentPhase).toBe('WELCOME');
    useGameStore.getState().setPhase('ACT_1_INTAKE');
    expect(useGameStore.getState().currentPhase).toBe('ERROR_STATE');
  });
});

describe('useGameStore — setPleaDecision', () => {
  it('accepts ACCEPT and REJECT', () => {
    useGameStore.getState().setPleaDecision('ACCEPT');
    expect(useGameStore.getState().pleaDecision).toBe('ACCEPT');
    useGameStore.getState().setPleaDecision('REJECT');
    expect(useGameStore.getState().pleaDecision).toBe('REJECT');
  });

  it('force-resets to ERROR_STATE on a value outside the closed vocabulary', () => {
    useGameStore.getState().setPleaDecision('MAYBE');
    expect(useGameStore.getState().currentPhase).toBe('ERROR_STATE');
    expect(useGameStore.getState().pleaDecision).toBeNull();
  });
});

describe('useGameStore — setImposedSentence', () => {
  it('accepts a valid sentence array', () => {
    useGameStore.getState().setImposedSentence([{ type: 'JAIL', unit: 'MONTHS', amount: 6 }]);
    expect(useGameStore.getState().imposedSentence).toEqual([
      { type: 'JAIL', unit: 'MONTHS', amount: 6 },
    ]);
  });

  it('accepts an empty array', () => {
    useGameStore.getState().setImposedSentence([]);
    expect(useGameStore.getState().imposedSentence).toEqual([]);
  });

  it('force-resets to ERROR_STATE on a malformed sentence', () => {
    // Fractional amount: SentenceSchema requires a positive whole number.
    useGameStore.getState().setImposedSentence([{ type: 'JAIL', unit: 'MONTHS', amount: 1.5 }]);
    expect(useGameStore.getState().currentPhase).toBe('ERROR_STATE');
    expect(useGameStore.getState().imposedSentence).toEqual([]);
  });

  it('force-resets to ERROR_STATE when a unit contradicts the sentence type', () => {
    // The correlated-unit constraint: a FINE is in DOLLARS, never YEARS.
    useGameStore.getState().setImposedSentence([{ type: 'FINE', unit: 'YEARS', amount: 500 }]);
    expect(useGameStore.getState().currentPhase).toBe('ERROR_STATE');
  });
});
