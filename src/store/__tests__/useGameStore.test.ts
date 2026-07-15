import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../useGameStore';
import { validCase } from '../../lib/__tests__/fixtures';
import { CasePayloadSchema, type DialogueScript, type CasePayload } from '../../schemas/gameSchemas';

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

// A CasePayload with the same charges/evidence/witnesses as validCase
// (charge c1, evidence e1/e2/e3, witnesses w1/w2 — MODERATE prosecution band)
// but a defendant profile engineered so computePleaPostureForCase resolves
// to PENDING_JUDICIAL_REVIEW (low risk tolerance + heavy prior record push
// the defense's acceptanceLikelihood over 50): low openness, high
// conscientiousness/neuroticism, three prior felony convictions.
const acceptingDefendantCase: CasePayload = CasePayloadSchema.parse({
  ...validCase,
  defendant: {
    ...validCase.defendant,
    oceanTraits: {
      openness: 1,
      conscientiousness: 10,
      extraversion: 5,
      agreeableness: 5,
      neuroticism: 10,
    },
    pastConvictions: [
      { chargeName: 'Prior burglary', year: 2018, sentences: [{ type: 'PRISON', unit: 'YEARS', amount: 2 }] },
      { chargeName: 'Prior burglary', year: 2020, sentences: [{ type: 'PRISON', unit: 'YEARS', amount: 2 }] },
      { chargeName: 'Prior burglary', year: 2022, sentences: [{ type: 'PRISON', unit: 'YEARS', amount: 2 }] },
    ],
  },
});

const pleaNarrativeWithDefense = {
  prosecutionRationale: 'The People have a workable case.',
  defenseRationale: 'The defendant should take the deal.',
};

function makeLine(overrides: Partial<DialogueScript['openingBeat']['lines'][number]> = {}) {
  return {
    speaker: 'COURT' as const,
    characterId: null,
    text: 'The court is now in session.',
    ...overrides,
  };
}

function makeBeat(id: string, lines = [makeLine()]) {
  return { id, lines };
}

// A DialogueScript matching acceptingDefendantCase exactly (evidenceIds
// e1/e2/e3, chargeId c1) with a plea dialogue present — valid against
// PENDING_JUDICIAL_REVIEW posture.
function makeValidScript(overrides: Partial<DialogueScript> = {}): DialogueScript {
  return {
    openingBeat: makeBeat('opening'),
    plea: {
      kind: 'PLEA',
      promptBeat: makeBeat('plea-prompt'),
      options: [
        { choice: 'ACCEPT', lineText: 'The court accepts the plea.' },
        { choice: 'REJECT', lineText: 'The court rejects the plea.' },
      ],
      reactionBeats: { ACCEPT: makeBeat('plea-accept'), REJECT: makeBeat('plea-reject') },
    },
    motions: (['e1', 'e2', 'e3'] as const).map((evidenceId) => ({
      kind: 'MOTION' as const,
      evidenceId,
      promptBeat: makeBeat(`motion-${evidenceId}-prompt`),
      options: [
        { choice: 'ADMITTED' as const, lineText: 'The evidence is admitted.' },
        { choice: 'EXCLUDED' as const, lineText: 'The evidence is excluded.' },
      ],
      reactionBeats: {
        ADMITTED: makeBeat(`motion-${evidenceId}-admitted`),
        EXCLUDED: makeBeat(`motion-${evidenceId}-excluded`),
      },
    })),
    verdicts: [
      {
        kind: 'VERDICT',
        chargeId: 'c1',
        promptBeat: makeBeat('verdict-c1-prompt'),
        options: [
          { choice: 'GUILTY', lineText: 'The defendant is found guilty.' },
          { choice: 'NOT_GUILTY', lineText: 'The defendant is found not guilty.' },
        ],
        reactionBeats: { GUILTY: makeBeat('verdict-c1-guilty'), NOT_GUILTY: makeBeat('verdict-c1-not-guilty') },
      },
    ],
    ...overrides,
  };
}

describe('useGameStore — activeDialogueScript', () => {
  function hydrateAcceptingCase(): void {
    useGameStore.getState().setActiveCase(acceptingDefendantCase);
    useGameStore.getState().setActivePleaNarrative(pleaNarrativeWithDefense);
  }

  it('accepts a valid script cross-validated against activeCase + computed posture', () => {
    hydrateAcceptingCase();
    useGameStore.getState().setActiveDialogueScript(makeValidScript());
    expect(useGameStore.getState().activeDialogueScript).not.toBeNull();
    expect(useGameStore.getState().currentPhase).toBe('WELCOME');
  });

  it('force-resets to ERROR_STATE when called outside WELCOME', () => {
    hydrateAcceptingCase();
    useGameStore.getState().setPhase('ACT_1_INTAKE');
    useGameStore.getState().setActiveDialogueScript(makeValidScript());
    expect(useGameStore.getState().currentPhase).toBe('ERROR_STATE');
    expect(useGameStore.getState().activeDialogueScript).toBeNull();
  });

  it('force-resets to ERROR_STATE when activeCase is not yet hydrated', () => {
    useGameStore.getState().setActivePleaNarrative(pleaNarrativeWithDefense);
    useGameStore.getState().setActiveDialogueScript(makeValidScript());
    expect(useGameStore.getState().currentPhase).toBe('ERROR_STATE');
    expect(useGameStore.getState().activeDialogueScript).toBeNull();
  });

  it('force-resets to ERROR_STATE when activePleaNarrative is not yet hydrated', () => {
    useGameStore.getState().setActiveCase(acceptingDefendantCase);
    useGameStore.getState().setActiveDialogueScript(makeValidScript());
    expect(useGameStore.getState().currentPhase).toBe('ERROR_STATE');
    expect(useGameStore.getState().activeDialogueScript).toBeNull();
  });

  it('force-resets to ERROR_STATE on a schema-invalid script', () => {
    hydrateAcceptingCase();
    useGameStore.getState().setActiveDialogueScript({ not: 'a script' });
    expect(useGameStore.getState().currentPhase).toBe('ERROR_STATE');
    expect(useGameStore.getState().activeDialogueScript).toBeNull();
  });

  it('force-resets to ERROR_STATE on a cross-validation failure (motion for unknown evidenceId)', () => {
    hydrateAcceptingCase();
    const badScript = makeValidScript({
      motions: [
        {
          kind: 'MOTION',
          evidenceId: 'e-ghost',
          promptBeat: makeBeat('motion-ghost-prompt'),
          options: [
            { choice: 'ADMITTED', lineText: 'The evidence is admitted.' },
            { choice: 'EXCLUDED', lineText: 'The evidence is excluded.' },
          ],
          reactionBeats: { ADMITTED: makeBeat('motion-ghost-admitted'), EXCLUDED: makeBeat('motion-ghost-excluded') },
        },
      ],
    });
    useGameStore.getState().setActiveDialogueScript(badScript);
    expect(useGameStore.getState().currentPhase).toBe('ERROR_STATE');
    expect(useGameStore.getState().activeDialogueScript).toBeNull();
  });

  it('force-resets to ERROR_STATE (not a crash) when posture computation throws', () => {
    // Schema-valid but inconsistent pairing: an offering-band (MODERATE) case
    // with a narrative missing defenseRationale makes computePleaPostureForCase
    // throw. The setter is a trust boundary — the throw must become
    // ERROR_STATE, never an uncaught exception.
    useGameStore.getState().setActiveCase(acceptingDefendantCase);
    useGameStore.getState().setActivePleaNarrative({
      prosecutionRationale: 'The People have a workable case.',
    });
    expect(() => useGameStore.getState().setActiveDialogueScript(makeValidScript())).not.toThrow();
    expect(useGameStore.getState().currentPhase).toBe('ERROR_STATE');
    expect(useGameStore.getState().activeDialogueScript).toBeNull();
  });

  it('resetGameState clears activeDialogueScript back to null', () => {
    hydrateAcceptingCase();
    useGameStore.getState().setActiveDialogueScript(makeValidScript());
    useGameStore.getState().resetGameState();
    expect(useGameStore.getState().activeDialogueScript).toBeNull();
    expect(useGameStore.getState().currentPhase).toBe('WELCOME');
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
