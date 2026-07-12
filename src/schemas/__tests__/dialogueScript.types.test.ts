import { describe, it, expect } from 'vitest';
import type {
  DialogueBeat,
  MotionDialogue,
  PleaDialogue,
  TranscriptLine,
} from '../gameSchemas';

const line: TranscriptLine = { speaker: 'COURT', characterId: null, text: 'The court is in session.' };
const beat: DialogueBeat = { id: 'beat-1', lines: [line] };

describe('DialogueScript — type contract', () => {
  it('rejects invalid script shapes at compile time', () => {
    // These lines are type-checked by tsc -b (npm run build) but never executed.
    // If a guarantee regresses, the @ts-expect-error becomes unused and the
    // build fails — making the type contract a build-enforced gate.
    const _typeChecks = () => {
      const missingReaction: PleaDialogue = {
        kind: 'PLEA',
        promptBeat: beat,
        options: [
          { choice: 'ACCEPT', lineText: 'The court accepts the negotiated plea.' },
          { choice: 'REJECT', lineText: 'The court rejects the plea. We proceed to trial.' },
        ],
        // @ts-expect-error - reactionBeats must cover every plea choice; REJECT is missing
        reactionBeats: { ACCEPT: beat },
      };
      void missingReaction;

      const bogusChoice: MotionDialogue = {
        kind: 'MOTION',
        evidenceId: 'ev-1',
        promptBeat: beat,
        // @ts-expect-error - an option's choice must come from the closed EvidenceRuling enum
        options: [{ choice: 'SUPPRESSED', lineText: 'The motion is suppressed.' }],
        reactionBeats: { ADMITTED: beat, EXCLUDED: beat },
      };
      void bogusChoice;

      // @ts-expect-error - beats carry no keys beyond id/lines (no ad-hoc metadata)
      const extraKey: DialogueBeat = { id: 'beat-2', lines: [line], mood: 'tense' };
      void extraKey;
    };
    expect(typeof _typeChecks).toBe('function');
  });
});
