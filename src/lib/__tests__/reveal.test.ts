import { describe, it, expect } from 'vitest';
import { buildCourtroomScript, type BuildCourtroomScriptInput, type StatementBeat } from '../courtroomScript';
import { deriveRevealState } from '../reveal';
import { validCase, validCaseWithInterrogation } from './fixtures';
import type { PleaPosture } from '../../schemas/gameSchemas';

const rejectedPosture: PleaPosture = {
  status: 'REJECTED_BY_DEFENSE',
  pleadsToChargeIds: ['c1'],
  dismissedChargeIds: [],
  proposedSentence: [{ type: 'PRISON', unit: 'YEARS', amount: 8 }],
  prosecutionRationale: 'Provable but contestable.',
  defenseRationale: 'Not worth the exposure.',
};

const baseInput: BuildCourtroomScriptInput = {
  caseData: validCase,
  pleaNarrative: null,
  pleaPosture: rejectedPosture,
  currentPhase: 'ACT_1_INTAKE',
  pleaDecision: null,
  motionRulings: [],
  chargeVerdicts: [],
  imposedSentence: [],
  aftermathNarrative: null,
  spokenJudgeLines: {},
};

const statements = (input: BuildCourtroomScriptInput): StatementBeat[] =>
  buildCourtroomScript(input).filter((b): b is StatementBeat => b.kind === 'STATEMENT');

describe('deriveRevealState', () => {
  it('reveals nothing from an empty record', () => {
    const state = deriveRevealState([]);
    expect(state.evidence.size).toBe(0);
    expect(state.witnesses.size).toBe(0);
    expect(state.charges.size).toBe(0);
    expect(state.factsStated).toBe(false);
  });

  it('reveals nothing before the beats play: a partial prefix stays partial', () => {
    const beats = statements(baseInput);
    // Only the case call and the charge read have played.
    const state = deriveRevealState(beats.slice(0, 2));
    expect(state.charges.has('c1')).toBe(true);
    expect(state.factsStated).toBe(false);
    expect(state.evidence.size).toBe(0);
    expect(state.witnesses.size).toBe(0);
  });

  it('after Act 1 discovery, everything is DISCLOSED and the facts are stated', () => {
    const state = deriveRevealState(statements(baseInput));
    expect(state.factsStated).toBe(true);
    expect(state.charges.has('c1')).toBe(true);
    expect([...state.evidence.entries()]).toEqual([
      ['e1', 'DISCLOSED'],
      ['e2', 'DISCLOSED'],
      ['e3', 'DISCLOSED'],
    ]);
    expect([...state.witnesses.entries()]).toEqual([
      ['w1', 'DISCLOSED'],
      ['w2', 'DISCLOSED'],
    ]);
  });

  it('an offered exhibit upgrades to PRESENTED; the rest stay DISCLOSED', () => {
    const state = deriveRevealState(
      statements({ ...baseInput, currentPhase: 'ACT_2_MOTIONS' }),
    );
    // Emission pauses at e1's ruling: e1 offered, e2/e3 still discovery-only.
    expect(state.evidence.get('e1')).toBe('PRESENTED');
    expect(state.evidence.get('e2')).toBe('DISCLOSED');
    expect(state.evidence.get('e3')).toBe('DISCLOSED');
  });

  it('a sworn witness upgrades to PRESENTED at direct examination', () => {
    const state = deriveRevealState(
      statements({
        ...baseInput,
        currentPhase: 'ACT_3_VERDICT',
        motionRulings: [
          { evidenceId: 'e1', ruling: 'ADMITTED' },
          { evidenceId: 'e2', ruling: 'ADMITTED' },
          { evidenceId: 'e3', ruling: 'ADMITTED' },
        ],
      }),
    );
    expect(state.witnesses.get('w1')).toBe('PRESENTED');
    expect(state.witnesses.get('w2')).toBe('PRESENTED');
    expect(state.evidence.get('e3')).toBe('PRESENTED');
  });

  it('interrogation playback rides its exhibit: the tape is PRESENTED once offered', () => {
    const state = deriveRevealState(
      statements({
        ...baseInput,
        caseData: validCaseWithInterrogation,
        currentPhase: 'ACT_2_MOTIONS',
        motionRulings: [
          { evidenceId: 'e1', ruling: 'ADMITTED' },
          { evidenceId: 'e2', ruling: 'ADMITTED' },
          { evidenceId: 'e3', ruling: 'ADMITTED' },
        ],
      }),
    );
    expect(state.evidence.get('e4')).toBe('PRESENTED');
  });

  it('the upgrade is monotonic — replaying discovery beats never downgrades PRESENTED', () => {
    const beats = statements({ ...baseInput, currentPhase: 'ACT_2_MOTIONS' });
    const discovery = beats.filter((b) => b.entryKind === 'DISCOVERY_EXHIBIT');
    const state = deriveRevealState([...beats, ...discovery]);
    expect(state.evidence.get('e1')).toBe('PRESENTED');
  });

  it('an accepted plea never upgrades past DISCLOSED — nothing was presented', () => {
    const state = deriveRevealState(
      statements({
        ...baseInput,
        pleaPosture: {
          ...rejectedPosture,
          status: 'PENDING_JUDICIAL_REVIEW',
        },
        pleaNarrative: {
          prosecutionRationale: 'p',
          defenseRationale: 'd',
          allocution: 'a',
        },
        currentPhase: 'END_STATE',
        pleaDecision: 'ACCEPT',
        imposedSentence: [{ type: 'PRISON', unit: 'YEARS', amount: 5 }],
        aftermathNarrative: 'Coverage was minimal.',
      }),
    );
    expect([...state.evidence.values()].every((tier) => tier === 'DISCLOSED')).toBe(true);
    expect([...state.witnesses.values()].every((tier) => tier === 'DISCLOSED')).toBe(true);
  });
});
