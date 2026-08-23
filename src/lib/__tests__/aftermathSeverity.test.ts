import { describe, it, expect } from 'vitest';
import { demoCaseSource } from '../caseSource';
import { deriveSentencingExposure, selectSentenceableCharges } from '../sentencingExposure';
import { DEMO_CASES } from '../demoCases';
import { webbCase } from '../demoCases/webb';
import type { ChargeVerdict, Sentence } from '../../schemas/gameSchemas';
import type { DemoCaseBundle } from '../demoCases';

// The floor and the ceiling of what the court could impose on a full
// conviction — the two ends the player can actually pick between.
function ends(bundle: DemoCaseBundle): { floor: Sentence[]; ceiling: Sentence[]; verdict: ChargeVerdict[] } {
  const verdict: ChargeVerdict[] = bundle.payload.charges.map((charge) => ({
    chargeId: charge.id,
    chargeName: charge.name,
    classification: charge.classification,
    verdict: 'GUILTY' as const,
  }));
  const exposure = deriveSentencingExposure(selectSentenceableCharges(bundle.payload.charges, false, verdict));
  return {
    floor: exposure.maximumPenalties.map((max) => ({ ...max, amount: 1 })),
    ceiling: exposure.maximumPenalties,
    verdict,
  };
}

const aftermathFor = (bundle: DemoCaseBundle, verdict: ChargeVerdict[] | null, imposedSentence: Sentence[]) =>
  demoCaseSource(bundle).generateAftermath({
    caseData: bundle.payload,
    pleaDecision: verdict === null ? 'ACCEPT' : 'REJECT',
    verdict,
    imposedSentence,
    motionRulings: [],
  });

describe('the demo aftermath answers the sentence, not just the verdict', () => {
  it.each(DEMO_CASES.map((bundle) => [bundle.title, bundle] as const))(
    '%s reads differently at the floor and at the ceiling of the range',
    async (_title, bundle) => {
      const { floor, ceiling, verdict } = ends(bundle);
      const lenient = await aftermathFor(bundle, verdict, floor);
      const severe = await aftermathFor(bundle, verdict, ceiling);

      expect(lenient).not.toEqual(severe);
      expect(lenient).toContain(bundle.sentenceCodas.LENIENT);
      expect(severe).toContain(bundle.sentenceCodas.SEVERE);
      // The outcome half is the same story in both — only the coda moved.
      expect(lenient).toContain(bundle.aftermath.CONVICTED);
      expect(severe).toContain(bundle.aftermath.CONVICTED);
    },
  );

  it('appends no coda to an acquittal — nothing was imposed', async () => {
    const acquitted = ends(webbCase).verdict.map((v) => ({ ...v, verdict: 'NOT_GUILTY' as const }));
    const text = await aftermathFor(webbCase, acquitted, []);

    expect(text).toBe(webbCase.aftermath.ACQUITTED);
    for (const coda of Object.values(webbCase.sentenceCodas)) {
      expect(text).not.toContain(coda);
    }
  });

  it('reads a negotiated plea sentence the same way it reads a trial sentence', async () => {
    const exposure = deriveSentencingExposure(webbCase.payload.charges);
    const lenient = await aftermathFor(webbCase, null, exposure.maximumPenalties.map((m) => ({ ...m, amount: 1 })));
    const severe = await aftermathFor(webbCase, null, exposure.maximumPenalties);

    expect(lenient).toContain(webbCase.aftermath.PLEA_ACCEPTED);
    expect(lenient).toContain(webbCase.sentenceCodas.LENIENT);
    expect(severe).toContain(webbCase.sentenceCodas.SEVERE);
  });
});
