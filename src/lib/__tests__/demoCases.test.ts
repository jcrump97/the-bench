import { describe, it, expect } from 'vitest';
import { CasePayloadSchema, PleaNarrativeSchema, type MotionRuling, type Verdict } from '../../schemas/gameSchemas';
import { assessProsecution, buildPleaPosture, computePleaPostureForCase, sentencingModifierFromRulings } from '../pleaAssessment';
import { DEMO_CASES } from '../demoCases';
import { classifyOutcome, selectAftermath } from '../demoCases/aftermath';
import { webbCase } from '../demoCases/webb';
import { booneCase } from '../demoCases/boone';

// Pins every demo case's scoring math so a future schema or weighting change
// that silently breaks demo playability (wrong band, wrong plea posture,
// wrong modifier direction) is caught at CI time instead of during a live demo.

describe('demo case registry', () => {
  it('registers unique case ids that mirror each payload caseId', () => {
    const ids = DEMO_CASES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const bundle of DEMO_CASES) {
      expect(bundle.id).toBe(bundle.payload.caseId);
    }
  });

  it.each(DEMO_CASES.map((b) => [b.id, b] as const))(
    '%s round-trips through CasePayloadSchema and PleaNarrativeSchema',
    (_id, bundle) => {
      expect(() => CasePayloadSchema.parse(bundle.payload)).not.toThrow();
      expect(() => PleaNarrativeSchema.parse(bundle.pleaNarrative)).not.toThrow();
    }
  );

  it.each(DEMO_CASES.map((b) => [b.id, b] as const))(
    '%s aftermath variants stay within the FinalResult length bound',
    (_id, bundle) => {
      const variants = Object.values(bundle.aftermath).filter((v): v is string => v !== undefined);
      expect(variants.length).toBeGreaterThanOrEqual(2);
      for (const text of variants) {
        expect(text.length).toBeGreaterThan(0);
        expect(text.length).toBeLessThanOrEqual(4000);
      }
    }
  );

  it.each(DEMO_CASES.map((b) => [b.id, b] as const))(
    '%s authors aftermath variants for exactly the reachable outcomes',
    (_id, bundle) => {
      const { posture } = computePleaPostureForCase(bundle.payload, bundle.pleaNarrative);
      expect(bundle.aftermath.PLEA_ACCEPTED !== undefined).toBe(posture.status === 'PENDING_JUDICIAL_REVIEW');
      expect(bundle.aftermath.SPLIT !== undefined).toBe(bundle.payload.charges.length > 1);
    }
  );
});

describe('booneCase (People v. Curtis Boone)', () => {
  it('assessProsecution bands the case WEAK with a coverage gap', () => {
    const strength = assessProsecution(booneCase.payload);
    expect(strength.band).toBe('WEAK');
    expect(strength.score).toBe(33);
    expect(strength.elementCoverage).toBe(0.5);
  });

  it('computePleaPostureForCase yields NO_OFFER with no defense assessment', () => {
    const { posture, defenseRisk } = computePleaPostureForCase(booneCase.payload, booneCase.pleaNarrative);
    expect(posture.status).toBe('NO_OFFER');
    expect(defenseRisk).toBeNull();
  });

  it('carries no defenseRationale (the prosecution never made an offer to answer)', () => {
    expect(booneCase.pleaNarrative.defenseRationale).toBeUndefined();
  });

  it('authors no PLEA_ACCEPTED aftermath (the plea branch is unreachable)', () => {
    expect(booneCase.aftermath.PLEA_ACCEPTED).toBeUndefined();
    expect(booneCase.aftermath.CONVICTED).toBeDefined();
    expect(booneCase.aftermath.ACQUITTED).toBeDefined();
  });
});

describe('classifyOutcome / selectAftermath', () => {
  const guilty = (chargeId: string) => ({ chargeId, chargeName: 'X', classification: 'FELONY' as const, verdict: 'GUILTY' as const });
  const notGuilty = (chargeId: string) => ({ chargeId, chargeName: 'X', classification: 'FELONY' as const, verdict: 'NOT_GUILTY' as const });

  it('classifies an accepted plea regardless of verdict', () => {
    expect(classifyOutcome('ACCEPT', null)).toBe('PLEA_ACCEPTED');
  });

  it('classifies all-guilty as CONVICTED, all-not-guilty as ACQUITTED, mixed as SPLIT', () => {
    expect(classifyOutcome('REJECT', [guilty('a')])).toBe('CONVICTED');
    expect(classifyOutcome(null, [notGuilty('a')])).toBe('ACQUITTED');
    expect(classifyOutcome(null, [guilty('a'), notGuilty('b')])).toBe('SPLIT');
  });

  it('throws on the off-path call (no accepted plea and no verdict)', () => {
    expect(() => classifyOutcome(null, null)).toThrow();
    expect(() => classifyOutcome('REJECT', [] as unknown as Verdict)).toThrow();
  });

  it('selectAftermath returns the authored variant and throws for unreachable outcomes', () => {
    expect(selectAftermath(webbCase, 'CONVICTED')).toBe(webbCase.aftermath.CONVICTED);
    expect(() => selectAftermath(webbCase, 'SPLIT')).toThrow(/unreachable outcome SPLIT/);
  });
});

describe('webbCase (People v. Marcus Webb)', () => {
  it('assessProsecution bands the case MODERATE', () => {
    const strength = assessProsecution(webbCase.payload);
    expect(strength.band).toBe('MODERATE');
    expect(strength.score).toBe(64);
    expect(strength.elementCoverage).toBe(1);
  });

  it('buildPleaPosture with the MODERATE band offers PENDING_JUDICIAL_REVIEW', () => {
    const { posture, defenseRisk } = buildPleaPosture(webbCase.payload, {
      band: 'MODERATE',
      prosecutionRationale: webbCase.pleaNarrative.prosecutionRationale,
      defenseRationale: webbCase.pleaNarrative.defenseRationale!,
    });
    expect(posture.status).toBe('PENDING_JUDICIAL_REVIEW');
    expect(defenseRisk?.posture).toBe('ACCEPT');
  });

  it('carries a defenseRationale (an offer reaches the bench)', () => {
    expect(webbCase.pleaNarrative.defenseRationale).toBeDefined();
  });

  it('sentencingModifierFromRulings returns 1 when all evidence is admitted and 0 when all is excluded', () => {
    const allAdmitted: MotionRuling[] = webbCase.payload.evidence.map(e => ({ evidenceId: e.id, ruling: 'ADMITTED' }));
    const allExcluded: MotionRuling[] = webbCase.payload.evidence.map(e => ({ evidenceId: e.id, ruling: 'EXCLUDED' }));
    expect(sentencingModifierFromRulings(webbCase.payload, allAdmitted)).toBe(1);
    expect(sentencingModifierFromRulings(webbCase.payload, allExcluded)).toBe(0);
  });
});
