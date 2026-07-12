import { describe, it, expect } from 'vitest';
import {
  TranscriptLineSchema,
  DialogueBeatSchema,
  PleaDialogueSchema,
  MotionDialogueSchema,
  VerdictDialogueSchema,
  DialogueScriptSchema,
} from '../gameSchemas';
import type { TranscriptLine, DialogueBeat, PleaDialogue, MotionDialogue, VerdictDialogue, DialogueScript } from '../gameSchemas';

// ---------- fixture helpers ----------

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
    evidenceId: 'ev-1',
    promptBeat: makeBeat({ id: 'motion-prompt' }),
    options: [
      { choice: 'ADMITTED', lineText: 'The evidence is admitted.' },
      { choice: 'EXCLUDED', lineText: 'The evidence is excluded.' },
    ],
    reactionBeats: {
      ADMITTED: makeBeat({ id: 'motion-admitted' }),
      EXCLUDED: makeBeat({ id: 'motion-excluded' }),
    },
    ...overrides,
  };
}

function makeVerdict(overrides: Partial<VerdictDialogue> = {}): VerdictDialogue {
  return {
    kind: 'VERDICT',
    chargeId: 'ch-1',
    promptBeat: makeBeat({ id: 'verdict-prompt' }),
    options: [
      { choice: 'GUILTY', lineText: 'The defendant is found guilty.' },
      { choice: 'NOT_GUILTY', lineText: 'The defendant is found not guilty.' },
    ],
    reactionBeats: {
      GUILTY: makeBeat({ id: 'verdict-guilty' }),
      NOT_GUILTY: makeBeat({ id: 'verdict-not-guilty' }),
    },
    ...overrides,
  };
}

function makeScript(overrides: Partial<DialogueScript> = {}): DialogueScript {
  return {
    openingBeat: makeBeat({ id: 'opening' }),
    plea: makePlea(),
    motions: [makeMotion()],
    verdicts: [makeVerdict()],
    ...overrides,
  };
}

// ---------- TranscriptLineSchema ----------

describe('TranscriptLineSchema', () => {
  it('accepts a valid COURT line with characterId null', () => {
    expect(TranscriptLineSchema.safeParse(makeLine()).success).toBe(true);
  });

  it('accepts a WITNESS line with characterId set', () => {
    const result = TranscriptLineSchema.safeParse(
      makeLine({ speaker: 'WITNESS', characterId: 'w-1' }),
    );
    expect(result.success).toBe(true);
  });

  it('rejects a WITNESS line with characterId null', () => {
    const result = TranscriptLineSchema.safeParse(
      makeLine({ speaker: 'WITNESS', characterId: null }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('WITNESS lines must carry a characterId'))).toBe(true);
    }
  });

  it('rejects a non-WITNESS line carrying a characterId', () => {
    const result = TranscriptLineSchema.safeParse(
      makeLine({ speaker: 'COURT', characterId: 'w-1' }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('must not carry a characterId'))).toBe(true);
    }
  });

  it('rejects an unknown speaker string', () => {
    const result = TranscriptLineSchema.safeParse({
      speaker: 'BAILIFF',
      characterId: null,
      text: 'Order in the court.',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an extra key on the object (strictObject)', () => {
    const result = TranscriptLineSchema.safeParse({
      ...makeLine(),
      extra: 'nope',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty text', () => {
    expect(TranscriptLineSchema.safeParse(makeLine({ text: '' })).success).toBe(false);
  });
});

// ---------- DialogueBeatSchema ----------

describe('DialogueBeatSchema', () => {
  it('rejects a beat with 0 lines', () => {
    expect(DialogueBeatSchema.safeParse(makeBeat({ lines: [] })).success).toBe(false);
  });

  it('rejects a beat with 21 lines', () => {
    const lines = Array.from({ length: 21 }, () => makeLine());
    expect(DialogueBeatSchema.safeParse(makeBeat({ lines })).success).toBe(false);
  });
});

// ---------- Choice coverage invariant ----------

describe('choice coverage invariant', () => {
  it('rejects a PleaDialogue whose options are two ACCEPT variants (no REJECT)', () => {
    const result = PleaDialogueSchema.safeParse(
      makePlea({
        options: [
          { choice: 'ACCEPT', lineText: 'The court accepts the plea.' },
          { choice: 'ACCEPT', lineText: 'So ordered; the plea is accepted.' },
        ],
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('No dialogue option covers choice REJECT'))).toBe(true);
    }
  });

  it('accepts a PleaDialogue with two ACCEPT variants plus a REJECT (variants of same choice are legal)', () => {
    const result = PleaDialogueSchema.safeParse(
      makePlea({
        options: [
          { choice: 'ACCEPT', lineText: 'The court accepts the plea.' },
          { choice: 'ACCEPT', lineText: 'So ordered; the plea is accepted.' },
          { choice: 'REJECT', lineText: 'The court rejects the plea.' },
        ],
      }),
    );
    expect(result.success).toBe(true);
  });

  it('rejects a MotionDialogue missing the EXCLUDED option', () => {
    const result = MotionDialogueSchema.safeParse(
      makeMotion({
        options: [
          { choice: 'ADMITTED', lineText: 'The evidence is admitted.' },
          { choice: 'ADMITTED', lineText: 'Received into evidence.' },
        ],
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('No dialogue option covers choice EXCLUDED'))).toBe(true);
    }
  });

  it('rejects a VerdictDialogue missing the NOT_GUILTY option', () => {
    const result = VerdictDialogueSchema.safeParse(
      makeVerdict({
        options: [
          { choice: 'GUILTY', lineText: 'The defendant is found guilty.' },
          { choice: 'GUILTY', lineText: 'Guilty on this charge.' },
        ],
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('No dialogue option covers choice NOT_GUILTY'))).toBe(true);
    }
  });

  it('rejects an option with empty lineText', () => {
    const result = PleaDialogueSchema.safeParse(
      makePlea({
        options: [
          { choice: 'ACCEPT', lineText: '' },
          { choice: 'REJECT', lineText: 'The court rejects the plea.' },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects an option with lineText over 300 chars', () => {
    const result = PleaDialogueSchema.safeParse(
      makePlea({
        options: [
          { choice: 'ACCEPT', lineText: 'x'.repeat(301) },
          { choice: 'REJECT', lineText: 'The court rejects the plea.' },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects an option whose choice is not in the closed enum', () => {
    const result = PleaDialogueSchema.safeParse({
      ...makePlea(),
      options: [
        { choice: 'DISMISS', lineText: 'The case is dismissed.' },
        { choice: 'REJECT', lineText: 'The court rejects the plea.' },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects plea reactionBeats missing the REJECT key', () => {
    const withoutReject: Record<string, unknown> = { ...makePlea().reactionBeats };
    delete withoutReject.REJECT;
    const result = PleaDialogueSchema.safeParse({
      ...makePlea(),
      reactionBeats: withoutReject,
    });
    expect(result.success).toBe(false);
  });

  it('rejects plea reactionBeats with an extra key', () => {
    const result = PleaDialogueSchema.safeParse({
      ...makePlea(),
      reactionBeats: {
        ...makePlea().reactionBeats,
        WITHDRAWN: makeBeat({ id: 'plea-withdrawn' }),
      },
    });
    expect(result.success).toBe(false);
  });
});

// ---------- DialogueScriptSchema ----------

describe('DialogueScriptSchema', () => {
  it('accepts the minimal valid script', () => {
    expect(DialogueScriptSchema.safeParse(makeScript()).success).toBe(true);
  });

  it('accepts the script with plea: null (NO_OFFER case)', () => {
    expect(DialogueScriptSchema.safeParse(makeScript({ plea: null })).success).toBe(true);
  });

  it('rejects a duplicate beat id across the script', () => {
    const result = DialogueScriptSchema.safeParse(
      makeScript({
        motions: [makeMotion({ promptBeat: makeBeat({ id: 'opening' }) })],
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('Duplicate beat id'))).toBe(true);
    }
  });

  it('rejects two motions sharing an evidenceId', () => {
    const result = DialogueScriptSchema.safeParse(
      makeScript({
        motions: [
          makeMotion({ evidenceId: 'ev-1', promptBeat: makeBeat({ id: 'motion-a-prompt' }), reactionBeats: { ADMITTED: makeBeat({ id: 'motion-a-admitted' }), EXCLUDED: makeBeat({ id: 'motion-a-excluded' }) } }),
          makeMotion({ evidenceId: 'ev-1', promptBeat: makeBeat({ id: 'motion-b-prompt' }), reactionBeats: { ADMITTED: makeBeat({ id: 'motion-b-admitted' }), EXCLUDED: makeBeat({ id: 'motion-b-excluded' }) } }),
        ],
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('Duplicate motion evidenceId'))).toBe(true);
    }
  });

  it('rejects two verdicts sharing a chargeId', () => {
    const result = DialogueScriptSchema.safeParse(
      makeScript({
        verdicts: [
          makeVerdict({ chargeId: 'ch-1', promptBeat: makeBeat({ id: 'verdict-a-prompt' }), reactionBeats: { GUILTY: makeBeat({ id: 'verdict-a-guilty' }), NOT_GUILTY: makeBeat({ id: 'verdict-a-not-guilty' }) } }),
          makeVerdict({ chargeId: 'ch-1', promptBeat: makeBeat({ id: 'verdict-b-prompt' }), reactionBeats: { GUILTY: makeBeat({ id: 'verdict-b-guilty' }), NOT_GUILTY: makeBeat({ id: 'verdict-b-not-guilty' }) } }),
        ],
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('Duplicate verdict chargeId'))).toBe(true);
    }
  });

  it('rejects an empty motions array (min 1)', () => {
    expect(DialogueScriptSchema.safeParse(makeScript({ motions: [] })).success).toBe(false);
  });

  it('rejects an empty verdicts array (min 1)', () => {
    expect(DialogueScriptSchema.safeParse(makeScript({ verdicts: [] })).success).toBe(false);
  });
});
