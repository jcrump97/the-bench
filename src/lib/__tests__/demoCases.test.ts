import { describe, it, expect } from 'vitest';
import { CasePayloadSchema, PleaNarrativeSchema, type MotionRuling } from '../../schemas/gameSchemas';
import { assessProsecution, buildPleaPosture, sentencingModifierFromRulings } from '../pleaAssessment';
import { DEMO_CASES } from '../demoCases';
import { webbCase } from '../demoCases/webb';

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
    '%s aftermath stays within the FinalResult length bound',
    (_id, bundle) => {
      expect(bundle.aftermathNarrative.length).toBeGreaterThan(0);
      expect(bundle.aftermathNarrative.length).toBeLessThanOrEqual(4000);
    }
  );
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
