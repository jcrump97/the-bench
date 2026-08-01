import { describe, it, expect, beforeAll } from 'vitest';
import { createGameService } from '../../gameService';
import {
  CaseSchema,
  PleaNarrativeSchema,
  AftermathNarrativeSchema,
  type CasePayload,
  type PleaNarrative,
} from '../../../../schemas/gameSchemas';
import { LIVE_API_KEY } from './liveEnv';

// The real end-to-end proof: one full generateCase() pipeline run (five
// stages + PleaNarrative, each a real Gemini call, some possibly retrying)
// against the actual API, reused across assertions and the aftermath call
// below so the whole suite costs one case generation, not one per test.
describe.skipIf(LIVE_API_KEY === null)('GameService (live)', () => {
  const apiKey = LIVE_API_KEY as string;
  let payload: CasePayload;
  let pleaNarrative: PleaNarrative;

  beforeAll(async () => {
    const service = createGameService(apiKey);
    ({ payload, pleaNarrative } = await service.generateCase());
  }, 240_000);

  it('generates a schema-valid case end to end against the real Gemini API', () => {
    expect(CaseSchema.safeParse(payload).success).toBe(true);
    expect(payload.evidence.length).toBeGreaterThanOrEqual(3);
    expect(payload.witnesses.length).toBeGreaterThanOrEqual(2);
  });

  it('generates a schema-valid plea narrative alongside the case', () => {
    expect(PleaNarrativeSchema.safeParse(pleaNarrative).success).toBe(true);
  });

  it('generates a validated aftermath narrative for the generated case', async () => {
    const service = createGameService(apiKey);
    const narrative = await service.generateAftermath({
      caseData: payload,
      pleaDecision: 'ACCEPT',
      verdict: null,
      imposedSentence: payload.charges[0]?.maximumPenalties ?? [],
    });

    expect(AftermathNarrativeSchema.safeParse(narrative).success).toBe(true);
  }, 60_000);
});
