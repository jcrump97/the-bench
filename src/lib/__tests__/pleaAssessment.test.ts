import { describe, it, expect, expectTypeOf } from 'vitest';
import { buildPleaPosture, sentencingModifierFromRulings, assessProsecution, assessDefense, computePleaPostureForCase, type PleaPostureResult } from '../pleaAssessment';
import { CasePayloadSchema, type MotionRuling } from '../../schemas/gameSchemas';
import { rawValidCase, validCase } from './fixtures';

// Deliberately scores WEAK (evidenceStrength/witnessStrength/elementCoverage
// all near zero) to exercise computePleaPostureForCase's NO_OFFER branch.
const weakCase = CasePayloadSchema.parse({
  caseId: '24-CR-00002',
  defendant: {
    firstName: 'Riley',
    lastName: 'Moss',
    age: 29,
    demographics: {
      relationshipStatus: 'SINGLE',
      children: 0,
      employmentStatus: 'UNEMPLOYED',
      educationLevel: 'HIGH_SCHOOL',
      substanceAbuseHistory: [],
    },
    pastConvictions: [],
    oceanTraits: { openness: 5, conscientiousness: 5, extraversion: 5, agreeableness: 5, neuroticism: 5 },
  },
  environment: {
    locationType: 'PUBLIC_SPACE',
    timeOfDay: 'NIGHT',
    weather: 'CLEAR',
    description: 'A public sidewalk.',
  },
  charges: [
    {
      id: 'wc1',
      name: 'Petty theft',
      classification: 'MISDEMEANOR',
      elements: [{ id: 'wel1', description: 'Taking of property of another.' }],
      mandatoryMinimums: [],
      maximumPenalties: [{ type: 'JAIL', unit: 'DAYS', amount: 30 }],
    },
  ],
  statuteContexts: ['Cal. Penal Code § 484 — petty theft.'],
  witnesses: [
    { id: 'ww1', name: 'Jamie Lowe', role: 'CHARACTER', bias: 'DEFENSE', statement: 'Vouches for the defendant.', credibilityScore: 1 },
    { id: 'ww2', name: 'Casey Vu', role: 'CHARACTER', bias: 'DEFENSE', statement: 'Disputes the account.', credibilityScore: 1 },
  ],
  evidence: [
    { id: 'we1', name: 'Vague description', type: 'CIRCUMSTANTIAL', description: 'A vague description.', relevanceScore: 1, objectionRisk: 'HIGH', targetElementId: null },
    { id: 'we2', name: 'Unrelated note', type: 'DOCUMENTARY', description: 'An unrelated note.', relevanceScore: 1, objectionRisk: 'HIGH', targetElementId: null },
    { id: 'we3', name: 'Secondhand rumor', type: 'CIRCUMSTANTIAL', description: 'A secondhand rumor.', relevanceScore: 1, objectionRisk: 'HIGH', targetElementId: null },
  ],
  summary: 'Alleged petty theft with minimal supporting evidence.',
});

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

  it('clamps a discount that would undercut the mandatory minimum floor', () => {
    // Charge maximumPenalties = 5 YEARS PRISON, mandatoryMinimums = 5 YEARS PRISON.
    // Naive MODERATE (20%) discount computes round(5 * 0.8) = 4, below the
    // floor — the DA cannot legally offer that, so the floor becomes the offer.
    const floorCase = CasePayloadSchema.parse({
      ...validCase,
      charges: [{
        ...rawValidCase.charges[0],
        mandatoryMinimums: [{ type: 'PRISON', unit: 'YEARS', amount: 5 }],
        maximumPenalties: [{ type: 'PRISON', unit: 'YEARS', amount: 5 }],
      }],
    });
    const { posture } = buildPleaPosture(floorCase, {
      band: 'MODERATE',
      prosecutionRationale: 'Provable but contestable.',
      defenseRationale: 'A deal beats the downside.',
    });
    expect(posture.status).not.toBe('NO_OFFER');
    if (posture.status !== 'NO_OFFER') {
      expect(posture.proposedSentence).toEqual([{ type: 'PRISON', unit: 'YEARS', amount: 5 }]);
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

  it('throws when a ruling references an unknown evidenceId', () => {
    const rulings: MotionRuling[] = [
      { evidenceId: 'e1', ruling: 'ADMITTED' },
      { evidenceId: 'e99', ruling: 'EXCLUDED' },
    ];
    expect(() => sentencingModifierFromRulings(validCase, rulings)).toThrow(/unknown evidenceId/i);
  });

  it('throws when multiple rulings reference unknown evidenceIds', () => {
    const rulings: MotionRuling[] = [
      { evidenceId: 'e1', ruling: 'ADMITTED' },
      { evidenceId: 'e99', ruling: 'EXCLUDED' },
      { evidenceId: 'e100', ruling: 'EXCLUDED' },
    ];
    expect(() => sentencingModifierFromRulings(validCase, rulings)).toThrow(/e99, e100/);
  });
});

describe('scoring math — direct regression', () => {
  it('assessProsecution(validCase) returns traced numeric outputs', () => {
    const result = assessProsecution(validCase);
    expect(result.score).toBe(41);
    expect(result.band).toBe('MODERATE');
    expect(result.evidenceStrength).toBe(26);
    expect(result.witnessStrength).toBe(55);
    expect(result.elementCoverage).toBe(0.5);
  });

  it('assessDefense(validCase, moderateOffer) returns traced numeric outputs', () => {
    // MODERATE band: 20% discount on 10 YEARS PRISON → proposed 8 years
    const moderateOffer = [{ type: 'PRISON' as const, unit: 'YEARS' as const, amount: 8 }];
    const result = assessDefense(validCase, moderateOffer);
    expect(result.acceptanceLikelihood).toBe(20);
    expect(result.posture).toBe('REJECT');
    expect(result.riskTolerance).toBe(50);
    expect(result.priorExposure).toBe(0);
    expect(result.offerGenerosity).toBe(20);
  });
});

describe('computePleaPostureForCase — wires assessProsecution into buildPleaPosture', () => {
  it('WEAK band: produces NO_OFFER from prosecutionRationale alone', () => {
    expect(assessProsecution(weakCase).band).toBe('WEAK');

    const { posture, defenseRisk } = computePleaPostureForCase(weakCase, {
      prosecutionRationale: 'Not enough here to charge.',
    });
    expect(posture.status).toBe('NO_OFFER');
    expect(defenseRisk).toBeNull();
    if (posture.status === 'NO_OFFER') {
      expect(posture.prosecutionRationale).toBe('Not enough here to charge.');
    }
  });

  it('WEAK band: a superfluous defenseRationale in the narrative is simply ignored', () => {
    const { posture } = computePleaPostureForCase(weakCase, {
      prosecutionRationale: 'Not enough here to charge.',
      defenseRationale: 'Irrelevant — never offered.',
    });
    expect(posture.status).toBe('NO_OFFER');
  });

  it('MODERATE/STRONG band: throws if the narrative omits defenseRationale', () => {
    expect(assessProsecution(validCase).band).toBe('MODERATE');
    expect(() =>
      computePleaPostureForCase(validCase, { prosecutionRationale: 'Provable but contestable.' })
    ).toThrow(/requires a defenseRationale/);
  });

  it('MODERATE/STRONG band: matches buildPleaPosture called directly with the same inputs', () => {
    const narrative = {
      prosecutionRationale: 'Provable but contestable.',
      defenseRationale: 'A deal beats the downside.',
    };
    const viaCompute = computePleaPostureForCase(validCase, narrative);
    const viaDirect = buildPleaPosture(validCase, {
      band: 'MODERATE',
      prosecutionRationale: narrative.prosecutionRationale,
      defenseRationale: narrative.defenseRationale,
    });
    expect(viaCompute).toEqual(viaDirect);
  });
});
