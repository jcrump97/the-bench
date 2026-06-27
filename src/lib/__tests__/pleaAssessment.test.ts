import { describe, it, expect, expectTypeOf } from 'vitest';
import { buildPleaPosture, sentencingModifierFromRulings, type PleaPostureResult } from '../pleaAssessment';
import type { MotionRuling } from '../../schemas/gameSchemas';
import { validCase } from './fixtures';

describe('buildPleaPosture — PleaPostureInput type contract (2C)', () => {
  it('rejects invalid call shapes at compile time', () => {
    // These lines are type-checked by tsc -b (npm run build) but never executed.
    // If either guarantee regresses, the @ts-expect-error becomes unused and the
    // build fails — making the type contract a build-enforced gate.
    const _typeChecks = () => {
      // @ts-expect-error - MODERATE band requires defenseRationale
      buildPleaPosture(validCase, { band: 'MODERATE', prosecutionRationale: 'p' });
      // @ts-expect-error - WEAK band cannot carry defenseRationale
      buildPleaPosture(validCase, { band: 'WEAK', prosecutionRationale: 'p', defenseRationale: 'd' });
    };
    expect(typeof _typeChecks).toBe('function');
  });

  it('returns a PleaPostureResult', () => {
    expectTypeOf(buildPleaPosture).returns.toEqualTypeOf<PleaPostureResult>();
  });
});

describe('buildPleaPosture — behaviour (2C)', () => {
  it('WEAK band produces NO_OFFER with null defenseRisk', () => {
    const { posture, defenseRisk } = buildPleaPosture(validCase, {
      band: 'WEAK',
      prosecutionRationale: 'Too thin to charge.',
    });
    expect(posture.status).toBe('NO_OFFER');
    expect(defenseRisk).toBeNull();
    if (posture.status === 'NO_OFFER') {
      expect(posture.prosecutionRationale).toBe('Too thin to charge.');
    }
  });

  it('MODERATE band makes an offer: all charges, 20% discount, non-null defenseRisk', () => {
    const { posture, defenseRisk } = buildPleaPosture(validCase, {
      band: 'MODERATE',
      prosecutionRationale: 'Provable but contestable.',
      defenseRationale: 'A deal beats the downside.',
    });
    expect(['PENDING_JUDICIAL_REVIEW', 'REJECTED_BY_DEFENSE']).toContain(posture.status);
    expect(defenseRisk).not.toBeNull();
    if (posture.status !== 'NO_OFFER') {
      expect(posture.pleadsToChargeIds).toEqual(['c1']);
      expect(posture.dismissedChargeIds).toEqual([]);
      // maximumPenalties = 10 YEARS PRISON; 0.20 discount → round(10 * 0.8) = 8
      expect(posture.proposedSentence).toEqual([{ type: 'PRISON', unit: 'YEARS', amount: 8 }]);
      expect(posture.defenseRationale).toBe('A deal beats the downside.');
    }
  });

  it('STRONG band applies the 5% discount', () => {
    const { posture } = buildPleaPosture(validCase, {
      band: 'STRONG',
      prosecutionRationale: 'Airtight.',
      defenseRationale: 'Mitigate the exposure.',
    });
    expect(posture.status).not.toBe('NO_OFFER');
    if (posture.status !== 'NO_OFFER') {
      // 0.05 discount → round(10 * 0.95) = round(9.5) = 10
      expect(posture.proposedSentence).toEqual([{ type: 'PRISON', unit: 'YEARS', amount: 10 }]);
    }
  });
});

describe('sentencingModifierFromRulings — precondition + contract (3C)', () => {
  // Fixture evidence relevanceScores: e1=5, e2=3, e3=2 (sum 10).
  it('throws on an empty motionRulings array (off-path call)', () => {
    expect(() => sentencingModifierFromRulings(validCase, [])).toThrow(/at least one motion ruling/);
  });

  it('returns 0 when every piece of evidence was excluded (prosecution shut-out)', () => {
    const rulings: MotionRuling[] = [
      { evidenceId: 'e1', ruling: 'EXCLUDED' },
      { evidenceId: 'e2', ruling: 'EXCLUDED' },
      { evidenceId: 'e3', ruling: 'EXCLUDED' },
    ];
    expect(sentencingModifierFromRulings(validCase, rulings)).toBe(0);
  });

  it('returns the admitted-relevance ratio for a mixed ruling set', () => {
    const rulings: MotionRuling[] = [
      { evidenceId: 'e1', ruling: 'ADMITTED' }, // 5
      { evidenceId: 'e2', ruling: 'ADMITTED' }, // 3
      { evidenceId: 'e3', ruling: 'EXCLUDED' }, // 0
    ];
    // (5 + 3) / 10 = 0.8
    expect(sentencingModifierFromRulings(validCase, rulings)).toBeCloseTo(0.8);
  });

  it('returns 1.0 when all evidence is admitted', () => {
    const rulings: MotionRuling[] = [
      { evidenceId: 'e1', ruling: 'ADMITTED' },
      { evidenceId: 'e2', ruling: 'ADMITTED' },
      { evidenceId: 'e3', ruling: 'ADMITTED' },
    ];
    expect(sentencingModifierFromRulings(validCase, rulings)).toBe(1);
  });
});
