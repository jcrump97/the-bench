import { describe, it, expect } from 'vitest';
import {
  FinalResultSchema,
  defendantFullName,
  type ChargeVerdict,
  type MotionRuling,
  type Sentence,
} from '../../schemas/gameSchemas';
import { buildFinalResult, type FinalResultInput } from '../resultGenerator';
import { assessProsecution, computePleaPostureForCase } from '../pleaAssessment';
import { webbCase } from '../demoCases/webb';
import { booneCase } from '../demoCases/boone';
import { reyesCase } from '../demoCases/reyes';
import { vaughnCase } from '../demoCases/vaughn';
import type { DemoCaseBundle } from '../demoCases';

const COMPLETED_AT = '2026-08-23T17:04:05.000Z';

// Every field the generator reads comes from validated state the player's own
// choices produced; the clock is injected so the assembly stays pure.
function inputFor(bundle: DemoCaseBundle, overrides: Partial<FinalResultInput> = {}): FinalResultInput {
  return {
    caseData: bundle.payload,
    pleaNarrative: bundle.pleaNarrative,
    pleaDecision: null,
    motionRulings: [],
    chargeVerdicts: [],
    imposedSentence: [],
    aftermathNarrative: 'The courthouse emptied by four.',
    completedAt: COMPLETED_AT,
    ...overrides,
  };
}

const guiltyOn = (bundle: DemoCaseBundle): ChargeVerdict[] =>
  bundle.payload.charges.map((charge) => ({
    chargeId: charge.id,
    chargeName: charge.name,
    classification: charge.classification,
    verdict: 'GUILTY' as const,
  }));

const admitAll = (bundle: DemoCaseBundle): MotionRuling[] =>
  bundle.payload.evidence.map((item) => ({ evidenceId: item.id, ruling: 'ADMITTED' as const }));

const PRISON_2: Sentence[] = [{ type: 'PRISON', unit: 'YEARS', amount: 2 }];

describe('buildFinalResult — shared snapshot fields', () => {
  it('carries the case identity, the injected clock, and schema version 1', () => {
    const result = buildFinalResult(inputFor(webbCase, { pleaDecision: 'ACCEPT', imposedSentence: PRISON_2 }));

    expect(result.schemaVersion).toBe(1);
    expect(result.caseId).toBe(webbCase.payload.caseId);
    expect(result.defendantName).toBe(defendantFullName(webbCase.payload.defendant));
    expect(result.completedAt).toBe(COMPLETED_AT);
    expect(result.imposedSentence).toEqual(PRISON_2);
    expect(result.aftermathNarrative).toBe('The courthouse emptied by four.');
  });

  it('snapshots the same assessments the game played under', () => {
    const result = buildFinalResult(inputFor(webbCase, { pleaDecision: 'ACCEPT', imposedSentence: PRISON_2 }));
    const { defenseRisk } = computePleaPostureForCase(webbCase.payload, webbCase.pleaNarrative);

    expect(result.prosecutionStrength).toEqual(assessProsecution(webbCase.payload));
    expect(result.defenseRisk).toEqual(defenseRisk);
  });
});

describe('buildFinalResult — plea path', () => {
  it('an accepted plea resolves as PLEA and carries no trial record', () => {
    const result = buildFinalResult(inputFor(webbCase, { pleaDecision: 'ACCEPT', imposedSentence: PRISON_2 }));

    expect(result.resolutionPath).toBe('PLEA');
    expect(result).not.toHaveProperty('verdict');
    expect(result).not.toHaveProperty('motionRulings');
    expect(result).not.toHaveProperty('pleaOutcome');
  });
});

describe('buildFinalResult — trial path', () => {
  it('reads JUDGE_FORCED_TRIAL off a live offer the judge refused', () => {
    const { posture } = computePleaPostureForCase(webbCase.payload, webbCase.pleaNarrative);
    expect(posture.status).toBe('PENDING_JUDICIAL_REVIEW');

    const result = buildFinalResult(inputFor(webbCase, {
      pleaDecision: 'REJECT',
      motionRulings: admitAll(webbCase),
      chargeVerdicts: guiltyOn(webbCase),
      imposedSentence: PRISON_2,
    }));

    expect(result.resolutionPath).toBe('TRIAL');
    if (result.resolutionPath !== 'TRIAL') return;
    expect(result.pleaOutcome).toBe('JUDGE_FORCED_TRIAL');
    expect(result.motionRulings).toEqual(admitAll(webbCase));
    expect(result.verdict).toEqual(guiltyOn(webbCase));
  });

  it('reads NO_OFFER_MADE off a case the People never offered on', () => {
    const { posture, defenseRisk } = computePleaPostureForCase(booneCase.payload, booneCase.pleaNarrative);
    expect(posture.status).toBe('NO_OFFER');

    const result = buildFinalResult(inputFor(booneCase, {
      motionRulings: admitAll(booneCase),
      chargeVerdicts: guiltyOn(booneCase),
      imposedSentence: PRISON_2,
    }));

    expect(result.resolutionPath).toBe('TRIAL');
    if (result.resolutionPath !== 'TRIAL') return;
    expect(result.pleaOutcome).toBe('NO_OFFER_MADE');
    // No offer was ever put to the defense, so there is no defense risk to snapshot.
    expect(defenseRisk).toBeNull();
    expect(result.defenseRisk).toBeNull();
  });

  it('reads REJECTED_BY_DEFENSE off an offer the defendant turned down', () => {
    const { posture } = computePleaPostureForCase(reyesCase.payload, reyesCase.pleaNarrative);
    expect(posture.status).toBe('REJECTED_BY_DEFENSE');

    const result = buildFinalResult(inputFor(reyesCase, {
      motionRulings: admitAll(reyesCase),
      chargeVerdicts: guiltyOn(reyesCase),
      imposedSentence: PRISON_2,
    }));

    expect(result.resolutionPath).toBe('TRIAL');
    if (result.resolutionPath !== 'TRIAL') return;
    expect(result.pleaOutcome).toBe('REJECTED_BY_DEFENSE');
  });

  it('records a full acquittal with an empty sentence', () => {
    const acquitted = guiltyOn(booneCase).map((v) => ({ ...v, verdict: 'NOT_GUILTY' as const }));
    const result = buildFinalResult(inputFor(booneCase, {
      motionRulings: admitAll(booneCase),
      chargeVerdicts: acquitted,
      imposedSentence: [],
    }));

    if (result.resolutionPath !== 'TRIAL') throw new Error('expected the trial path');
    expect(result.verdict).toEqual(acquitted);
    expect(result.imposedSentence).toEqual([]);
  });

  it('throws on a trial record with no verdict (off-path call)', () => {
    expect(() => buildFinalResult(inputFor(booneCase, { motionRulings: admitAll(booneCase) })))
      .toThrow(/verdict/);
  });
});

describe('buildFinalResult — ValidationLayer contract', () => {
  // The generator assembles; FinalResultSchema is the gate. Every reachable
  // path must produce a candidate that clears it, on real docket data.
  it('produces a candidate that passes FinalResultSchema on every path', () => {
    const candidates = [
      buildFinalResult(inputFor(webbCase, { pleaDecision: 'ACCEPT', imposedSentence: PRISON_2 })),
      buildFinalResult(inputFor(webbCase, {
        pleaDecision: 'REJECT',
        motionRulings: admitAll(webbCase),
        chargeVerdicts: guiltyOn(webbCase),
        imposedSentence: PRISON_2,
      })),
      buildFinalResult(inputFor(booneCase, {
        motionRulings: admitAll(booneCase),
        chargeVerdicts: guiltyOn(booneCase).map((v) => ({ ...v, verdict: 'NOT_GUILTY' as const })),
      })),
      buildFinalResult(inputFor(vaughnCase, {
        motionRulings: admitAll(vaughnCase),
        chargeVerdicts: guiltyOn(vaughnCase).map((v, i) => (i === 0 ? { ...v, verdict: 'NOT_GUILTY' as const } : v)),
        imposedSentence: PRISON_2,
      })),
    ];

    for (const candidate of candidates) {
      const parsed = FinalResultSchema.safeParse(candidate);
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    }
  });
});
