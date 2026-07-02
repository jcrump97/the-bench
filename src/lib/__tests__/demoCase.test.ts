import { describe, it, expect } from 'vitest';
import { CasePayloadSchema, PleaNarrativeSchema, type MotionRuling } from '../../schemas/gameSchemas';
import { assessProsecution, buildPleaPosture, sentencingModifierFromRulings } from '../pleaAssessment';
import { demoCasePayload, demoPleaNarrative, demoAftermathNarrative } from '../demoCase';

// Pins the demo case's scoring math so a future schema or weighting change that
// silently breaks demo playability (wrong band, wrong plea posture, wrong
// modifier direction) is caught at CI time instead of during a live demo.
describe('demoCase', () => {
  it('demoCasePayload round-trips through CasePayloadSchema', () => {
    expect(() => CasePayloadSchema.parse(demoCasePayload)).not.toThrow();
  });

  it('assessProsecution bands the case MODERATE', () => {
    const strength = assessProsecution(demoCasePayload);
    expect(strength.band).toBe('MODERATE');
    expect(strength.score).toBe(64);
    expect(strength.elementCoverage).toBe(1);
  });

  it('buildPleaPosture with the MODERATE band offers PENDING_JUDICIAL_REVIEW', () => {
    const { posture, defenseRisk } = buildPleaPosture(demoCasePayload, {
      band: 'MODERATE',
      prosecutionRationale: demoPleaNarrative.prosecutionRationale,
      defenseRationale: demoPleaNarrative.defenseRationale!,
    });
    expect(posture.status).toBe('PENDING_JUDICIAL_REVIEW');
    expect(defenseRisk?.posture).toBe('ACCEPT');
  });

  it('demoPleaNarrative round-trips with defenseRationale defined', () => {
    expect(() => PleaNarrativeSchema.parse(demoPleaNarrative)).not.toThrow();
    expect(demoPleaNarrative.defenseRationale).toBeDefined();
  });

  it('demoAftermathNarrative stays within the FinalResult length bound', () => {
    expect(demoAftermathNarrative.length).toBeLessThanOrEqual(4000);
  });

  it('sentencingModifierFromRulings returns 1 when all evidence is admitted and 0 when all is excluded', () => {
    const allAdmitted: MotionRuling[] = demoCasePayload.evidence.map(e => ({ evidenceId: e.id, ruling: 'ADMITTED' }));
    const allExcluded: MotionRuling[] = demoCasePayload.evidence.map(e => ({ evidenceId: e.id, ruling: 'EXCLUDED' }));
    expect(sentencingModifierFromRulings(demoCasePayload, allAdmitted)).toBe(1);
    expect(sentencingModifierFromRulings(demoCasePayload, allExcluded)).toBe(0);
  });
});
