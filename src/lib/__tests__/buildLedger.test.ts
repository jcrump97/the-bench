import { describe, it, expect } from 'vitest';
import { buildLedger, type BuildLedgerInput } from '../buildLedger';
import { validCase } from './fixtures';
import type { PleaPosture, MotionRuling, Verdict } from '../../schemas/gameSchemas';

const noOfferPosture: PleaPosture = {
  status: 'NO_OFFER',
  prosecutionRationale: 'Too thin to charge.',
};

const pendingPosture: PleaPosture = {
  status: 'PENDING_JUDICIAL_REVIEW',
  pleadsToChargeIds: ['c1'],
  dismissedChargeIds: [],
  proposedSentence: [{ type: 'PRISON', unit: 'YEARS', amount: 8 }],
  prosecutionRationale: 'Provable but contestable.',
  defenseRationale: 'A deal beats the downside.',
};

const rejectedPosture: PleaPosture = {
  status: 'REJECTED_BY_DEFENSE',
  pleadsToChargeIds: ['c1'],
  dismissedChargeIds: [],
  proposedSentence: [{ type: 'PRISON', unit: 'YEARS', amount: 8 }],
  prosecutionRationale: 'Provable but contestable.',
  defenseRationale: 'Not worth the exposure.',
};

const baseInput: BuildLedgerInput = {
  caseData: validCase,
  pleaNarrative: null,
  pleaPosture: null,
  pleaDecision: null,
  motionRulings: [],
  verdict: null,
  imposedSentence: [],
  aftermathNarrative: null,
};

describe('buildLedger — entry presence and ordering', () => {
  it('emits only CASE_OPENED when nothing else has happened yet', () => {
    const entries = buildLedger(baseInput);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.kind).toBe('CASE_OPENED');
    expect(entries[0]?.order).toBe(0);
  });

  it('NO_OFFER posture: PLEA_OFFER but no PLEA_DEFENSE_RESPONSE', () => {
    const entries = buildLedger({ ...baseInput, pleaPosture: noOfferPosture });
    expect(entries.map((e) => e.kind)).toEqual(['CASE_OPENED', 'PLEA_OFFER']);
    expect(entries[1]?.body).toBe('Too thin to charge.');
  });

  it('PENDING_JUDICIAL_REVIEW + ACCEPT: full plea sequence, no verdict/motion entries', () => {
    const entries = buildLedger({
      ...baseInput,
      pleaPosture: pendingPosture,
      pleaDecision: 'ACCEPT',
    });
    expect(entries.map((e) => e.kind)).toEqual([
      'CASE_OPENED',
      'PLEA_OFFER',
      'PLEA_DEFENSE_RESPONSE',
      'PLEA_DECISION',
    ]);
    expect(entries.map((e) => e.order)).toEqual([0, 1, 2, 3]);
    expect(entries[1]?.body).toContain('Second-degree burglary');
    expect(entries[1]?.body).toContain('8 years in prison');
  });

  it('attributes every entry to a courtroom speaker, never an omniscient narrator', () => {
    const entries = buildLedger({
      ...baseInput,
      pleaPosture: pendingPosture,
      pleaDecision: 'ACCEPT',
      imposedSentence: [{ type: 'PRISON', unit: 'YEARS', amount: 5 }],
      aftermathNarrative: 'Coverage was minimal.',
    });
    expect(entries.map((e) => e.speaker)).toEqual([
      'CLERK',        // case called
      'PROSECUTION',  // the offer is the DA's presentation
      'DEFENSE',      // the response is defense counsel's
      'COURT',        // the ruling is the player's
      'COURT',        // sentence
      'PRESS',        // aftermath
    ]);
  });

  it('mid-Act-2: REJECTED_BY_DEFENSE plus partial motion rulings, in array order', () => {
    const motionRulings: MotionRuling[] = [
      { evidenceId: 'e2', ruling: 'EXCLUDED' },
      { evidenceId: 'e1', ruling: 'ADMITTED' },
    ];
    const entries = buildLedger({
      ...baseInput,
      pleaPosture: rejectedPosture,
      motionRulings,
    });
    expect(entries.map((e) => e.kind)).toEqual([
      'CASE_OPENED',
      'PLEA_OFFER',
      'PLEA_DEFENSE_RESPONSE',
      'MOTION_RULING',
      'MOTION_RULING',
    ]);
    // Array order preserved, not evidence-id order.
    expect(entries[3]?.body).toBe('Security camera still: Excluded');
    expect(entries[4]?.body).toBe('Rear door fingerprint: Admitted');
  });

  it('post-verdict: verdict entries then sentence entries', () => {
    const verdict: Verdict = [
      { chargeId: 'c1', chargeName: 'Second-degree burglary', classification: 'FELONY', verdict: 'GUILTY' },
    ];
    const entries = buildLedger({
      ...baseInput,
      verdict,
      imposedSentence: [{ type: 'PRISON', unit: 'YEARS', amount: 5 }],
    });
    expect(entries.map((e) => e.kind)).toEqual(['CASE_OPENED', 'VERDICT', 'SENTENCE_IMPOSED']);
    expect(entries[1]?.body).toBe('Second-degree burglary (Felony): Guilty');
    expect(entries[2]?.body).toBe('5 years in prison');
  });

  it('END_STATE: aftermath entry appears last', () => {
    const entries = buildLedger({
      ...baseInput,
      pleaDecision: 'ACCEPT',
      imposedSentence: [{ type: 'PRISON', unit: 'YEARS', amount: 5 }],
      aftermathNarrative: 'Coverage was minimal.',
    });
    expect(entries.at(-1)?.kind).toBe('AFTERMATH');
    expect(entries.at(-1)?.body).toBe('Coverage was minimal.');
  });
});

describe('buildLedger — robustness and purity', () => {
  it('falls back to a label instead of throwing on an unknown evidenceId', () => {
    const entries = buildLedger({
      ...baseInput,
      motionRulings: [{ evidenceId: 'does-not-exist', ruling: 'ADMITTED' }],
    });
    const motionEntry = entries.find((e) => e.kind === 'MOTION_RULING');
    expect(motionEntry?.body).toBe('Unknown evidence: Admitted');
  });

  it('is pure: identical input produces a deep-equal result both times', () => {
    const input: BuildLedgerInput = {
      ...baseInput,
      pleaPosture: pendingPosture,
      pleaDecision: 'ACCEPT',
      imposedSentence: [{ type: 'PRISON', unit: 'YEARS', amount: 5 }],
      aftermathNarrative: 'Coverage was minimal.',
    };
    expect(buildLedger(input)).toEqual(buildLedger(input));
  });

  it('order is a monotonic zero-based index matching array position', () => {
    const entries = buildLedger({
      ...baseInput,
      pleaPosture: pendingPosture,
      pleaDecision: 'ACCEPT',
      imposedSentence: [{ type: 'PRISON', unit: 'YEARS', amount: 5 }],
      aftermathNarrative: 'Coverage was minimal.',
    });
    expect(entries.map((e) => e.order)).toEqual(entries.map((_, i) => i));
  });
});
