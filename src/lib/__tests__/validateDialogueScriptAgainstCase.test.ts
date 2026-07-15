import { describe, it, expect } from 'vitest';
import { validateDialogueScriptAgainstCase } from '../validateDialogueScriptAgainstCase';
import { validCase } from './fixtures';
import type {
  TranscriptLine,
  DialogueBeat,
  PleaDialogue,
  MotionDialogue,
  VerdictDialogue,
  DialogueScript,
  PleaPosture,
} from '../../schemas/gameSchemas';

// validCase (src/lib/__tests__/fixtures.ts) has evidence ids e1/e2/e3,
// charge id c1, witness ids w1/w2.

// ---------- fixture helpers (mirrors src/schemas/__tests__/dialogueScript.test.ts) ----------

function makeLine(overrides: Partial<TranscriptLine> = {}): TranscriptLine {
  return {
    speaker: 'COURT',
    characterId: null,
    text: 'The court is now in session.',
    ...overrides,
  };
}

function makeBeat(overrides: Partial<DialogueBeat> = {}): DialogueBeat {
  return {
    id: 'beat-1',
    lines: [makeLine()],
    ...overrides,
  };
}

function makePlea(overrides: Partial<PleaDialogue> = {}): PleaDialogue {
  return {
    kind: 'PLEA',
    promptBeat: makeBeat({ id: 'plea-prompt' }),
    options: [
      { choice: 'ACCEPT', lineText: 'The court accepts the plea.' },
      { choice: 'REJECT', lineText: 'The court rejects the plea.' },
    ],
    reactionBeats: {
      ACCEPT: makeBeat({ id: 'plea-accept' }),
      REJECT: makeBeat({ id: 'plea-reject' }),
    },
    ...overrides,
  };
}

function makeMotion(overrides: Partial<MotionDialogue> = {}): MotionDialogue {
  return {
    kind: 'MOTION',
    evidenceId: 'e1',
    promptBeat: makeBeat({ id: 'motion-e1-prompt' }),
    options: [
      { choice: 'ADMITTED', lineText: 'The evidence is admitted.' },
      { choice: 'EXCLUDED', lineText: 'The evidence is excluded.' },
    ],
    reactionBeats: {
      ADMITTED: makeBeat({ id: 'motion-e1-admitted' }),
      EXCLUDED: makeBeat({ id: 'motion-e1-excluded' }),
    },
    ...overrides,
  };
}

function makeVerdict(overrides: Partial<VerdictDialogue> = {}): VerdictDialogue {
  return {
    kind: 'VERDICT',
    chargeId: 'c1',
    promptBeat: makeBeat({ id: 'verdict-c1-prompt' }),
    options: [
      { choice: 'GUILTY', lineText: 'The defendant is found guilty.' },
      { choice: 'NOT_GUILTY', lineText: 'The defendant is found not guilty.' },
    ],
    reactionBeats: {
      GUILTY: makeBeat({ id: 'verdict-c1-guilty' }),
      NOT_GUILTY: makeBeat({ id: 'verdict-c1-not-guilty' }),
    },
    ...overrides,
  };
}

// A full script matching validCase exactly: one motion per evidence item
// (e1/e2/e3), one verdict for c1, plea present.
function makeFullValidScript(overrides: Partial<DialogueScript> = {}): DialogueScript {
  return {
    openingBeat: makeBeat({ id: 'opening' }),
    plea: makePlea(),
    motions: [
      makeMotion({ evidenceId: 'e1', promptBeat: makeBeat({ id: 'motion-e1-prompt' }), reactionBeats: { ADMITTED: makeBeat({ id: 'motion-e1-admitted' }), EXCLUDED: makeBeat({ id: 'motion-e1-excluded' }) } }),
      makeMotion({ evidenceId: 'e2', promptBeat: makeBeat({ id: 'motion-e2-prompt' }), reactionBeats: { ADMITTED: makeBeat({ id: 'motion-e2-admitted' }), EXCLUDED: makeBeat({ id: 'motion-e2-excluded' }) } }),
      makeMotion({ evidenceId: 'e3', promptBeat: makeBeat({ id: 'motion-e3-prompt' }), reactionBeats: { ADMITTED: makeBeat({ id: 'motion-e3-admitted' }), EXCLUDED: makeBeat({ id: 'motion-e3-excluded' }) } }),
    ],
    verdicts: [makeVerdict()],
    ...overrides,
  };
}

const pendingPosture: PleaPosture = {
  status: 'PENDING_JUDICIAL_REVIEW',
  pleadsToChargeIds: ['c1'],
  dismissedChargeIds: [],
  proposedSentence: [{ type: 'PRISON', unit: 'YEARS', amount: 8 }],
  prosecutionRationale: 'Solid case.',
  defenseRationale: 'Take the deal.',
};

const noOfferPosture: PleaPosture = {
  status: 'NO_OFFER',
  prosecutionRationale: 'Too weak to offer.',
};

const rejectedPosture: PleaPosture = {
  status: 'REJECTED_BY_DEFENSE',
  pleadsToChargeIds: ['c1'],
  dismissedChargeIds: [],
  proposedSentence: [{ type: 'PRISON', unit: 'YEARS', amount: 8 }],
  prosecutionRationale: 'Solid case.',
  defenseRationale: 'We gamble at trial.',
};

describe('validateDialogueScriptAgainstCase', () => {
  it('returns [] for a fully valid script matched to validCase + PENDING_JUDICIAL_REVIEW posture', () => {
    const issues = validateDialogueScriptAgainstCase(makeFullValidScript(), validCase, pendingPosture);
    expect(issues).toEqual([]);
  });

  it('reports evidence with no motion dialogue (missing direction)', () => {
    const script = makeFullValidScript({
      motions: [makeMotion({ evidenceId: 'e1' })], // drops e2, e3
    });
    const issues = validateDialogueScriptAgainstCase(script, validCase, pendingPosture);
    expect(issues.some((i) => i.includes('e2') && i.includes('no motion dialogue'))).toBe(true);
    expect(issues.some((i) => i.includes('e3') && i.includes('no motion dialogue'))).toBe(true);
  });

  it('reports a motion for a nonexistent evidenceId (extra direction)', () => {
    const script = makeFullValidScript({
      motions: [
        ...makeFullValidScript().motions,
        makeMotion({ evidenceId: 'e-ghost', promptBeat: makeBeat({ id: 'motion-ghost-prompt' }), reactionBeats: { ADMITTED: makeBeat({ id: 'motion-ghost-admitted' }), EXCLUDED: makeBeat({ id: 'motion-ghost-excluded' }) } }),
      ],
    });
    const issues = validateDialogueScriptAgainstCase(script, validCase, pendingPosture);
    expect(issues.some((i) => i.includes('e-ghost') && i.includes('unknown evidenceId'))).toBe(true);
  });

  it('reports a charge with no verdict dialogue (missing direction)', () => {
    const script = makeFullValidScript({ verdicts: [] });
    // verdicts min(1) in schema, but validateDialogueScriptAgainstCase is a
    // pure function operating on already-typed data — exercise the check
    // directly rather than relying on schema rejection.
    const issues = validateDialogueScriptAgainstCase(script, validCase, pendingPosture);
    expect(issues.some((i) => i.includes('c1') && i.includes('no verdict dialogue'))).toBe(true);
  });

  it('reports a verdict for a nonexistent chargeId (extra direction)', () => {
    const script = makeFullValidScript({
      verdicts: [
        makeVerdict(),
        makeVerdict({ chargeId: 'c-ghost', promptBeat: makeBeat({ id: 'verdict-ghost-prompt' }), reactionBeats: { GUILTY: makeBeat({ id: 'verdict-ghost-guilty' }), NOT_GUILTY: makeBeat({ id: 'verdict-ghost-not-guilty' }) } }),
      ],
    });
    const issues = validateDialogueScriptAgainstCase(script, validCase, pendingPosture);
    expect(issues.some((i) => i.includes('c-ghost') && i.includes('unknown chargeId'))).toBe(true);
  });

  it('reports a WITNESS line whose characterId does not resolve against payload.witnesses', () => {
    const script = makeFullValidScript({
      openingBeat: makeBeat({
        id: 'opening',
        lines: [makeLine({ speaker: 'WITNESS', characterId: 'w-ghost' })],
      }),
    });
    const issues = validateDialogueScriptAgainstCase(script, validCase, pendingPosture);
    expect(issues.some((i) => i.includes('w-ghost') && i.includes('unknown characterId'))).toBe(true);
  });

  it('accepts a WITNESS line whose characterId resolves to a real witness', () => {
    const script = makeFullValidScript({
      openingBeat: makeBeat({
        id: 'opening',
        lines: [makeLine({ speaker: 'WITNESS', characterId: 'w1' })],
      }),
    });
    const issues = validateDialogueScriptAgainstCase(script, validCase, pendingPosture);
    expect(issues).toEqual([]);
  });

  it('walks WITNESS lines inside motion and verdict reaction beats, not just openingBeat', () => {
    const script = makeFullValidScript({
      motions: [
        ...makeFullValidScript().motions.slice(1),
        makeMotion({
          evidenceId: 'e1',
          promptBeat: makeBeat({ id: 'motion-e1-prompt' }),
          reactionBeats: {
            ADMITTED: makeBeat({ id: 'motion-e1-admitted', lines: [makeLine({ speaker: 'WITNESS', characterId: 'w-ghost' })] }),
            EXCLUDED: makeBeat({ id: 'motion-e1-excluded' }),
          },
        }),
      ],
    });
    const issues = validateDialogueScriptAgainstCase(script, validCase, pendingPosture);
    expect(issues.some((i) => i.includes('w-ghost'))).toBe(true);
  });

  it('reports a plea dialogue present when posture is NO_OFFER', () => {
    const script = makeFullValidScript();
    const issues = validateDialogueScriptAgainstCase(script, validCase, noOfferPosture);
    expect(issues.some((i) => i.includes('NO_OFFER') && i.includes('has a plea dialogue'))).toBe(true);
  });

  it('accepts plea: null when posture is NO_OFFER', () => {
    const script = makeFullValidScript({ plea: null });
    const issues = validateDialogueScriptAgainstCase(script, validCase, noOfferPosture);
    expect(issues).toEqual([]);
  });

  it('reports plea: null when posture is PENDING_JUDICIAL_REVIEW', () => {
    const script = makeFullValidScript({ plea: null });
    const issues = validateDialogueScriptAgainstCase(script, validCase, pendingPosture);
    expect(issues.some((i) => i.includes('PENDING_JUDICIAL_REVIEW') && i.includes('no plea dialogue'))).toBe(true);
  });

  it('reports a plea dialogue present when posture is REJECTED_BY_DEFENSE', () => {
    const script = makeFullValidScript();
    const issues = validateDialogueScriptAgainstCase(script, validCase, rejectedPosture);
    expect(issues.some((i) => i.includes('REJECTED_BY_DEFENSE') && i.includes('has a plea dialogue'))).toBe(true);
  });

  it('accepts plea: null when posture is REJECTED_BY_DEFENSE', () => {
    const script = makeFullValidScript({ plea: null });
    const issues = validateDialogueScriptAgainstCase(script, validCase, rejectedPosture);
    expect(issues).toEqual([]);
  });
});
