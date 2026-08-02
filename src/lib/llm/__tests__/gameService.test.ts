import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGameService } from '../gameService';
import { validCase } from '../../__tests__/fixtures';
import { CaseSchema, PleaNarrativeSchema } from '../../../schemas/gameSchemas';

vi.mock('../modelSelection', () => ({ getOrSelectModel: vi.fn() }));
vi.mock('../stages', () => ({
  runStatuteSelection: vi.fn(),
  runEnvironmentGen: vi.fn(),
  runCharacterGen: vi.fn(),
  runInterrogationGen: vi.fn(),
  runEvidenceGen: vi.fn(),
  runVerdictVoice: vi.fn(),
  finalizeCasePayload: vi.fn(),
  runPleaNarrative: vi.fn(),
  runAftermath: vi.fn(),
}));

import { getOrSelectModel } from '../modelSelection';
import {
  runStatuteSelection,
  runEnvironmentGen,
  runCharacterGen,
  runInterrogationGen,
  runEvidenceGen,
  runVerdictVoice,
  finalizeCasePayload,
  runPleaNarrative,
  runAftermath,
} from '../stages';

const API_KEY = 'AIzaTestKey1234567890123456789';
const MODEL = 'gemini-flash-lite-latest';

const pleaNarrative = PleaNarrativeSchema.parse({ prosecutionRationale: 'The People offer a negotiated plea.' });

beforeEach(() => {
  vi.mocked(getOrSelectModel).mockReset().mockResolvedValue(MODEL);
  vi.mocked(runStatuteSelection).mockReset().mockResolvedValue({
    charges: validCase.charges,
    statuteContexts: validCase.statuteContexts,
  });
  vi.mocked(runEnvironmentGen).mockReset().mockResolvedValue(validCase.environment);
  vi.mocked(runCharacterGen).mockReset().mockResolvedValue(validCase.defendant);
  vi.mocked(runInterrogationGen).mockReset().mockResolvedValue(null);
  vi.mocked(runEvidenceGen).mockReset().mockResolvedValue({
    evidence: validCase.evidence,
    witnesses: validCase.witnesses,
  });
  vi.mocked(runVerdictVoice).mockReset().mockResolvedValue(
    validCase.charges.map((c) => ({ id: c.id, verdictReactions: c.verdictReactions, verdictOptions: c.verdictOptions })),
  );
  vi.mocked(finalizeCasePayload).mockReset().mockResolvedValue(validCase);
  vi.mocked(runPleaNarrative).mockReset().mockResolvedValue(pleaNarrative);
  vi.mocked(runAftermath).mockReset().mockResolvedValue('The community absorbed the verdict quietly.');
});

describe('createGameService().generateCase', () => {
  it('orchestrates every stage in pipeline order and returns a schema-valid result', async () => {
    const service = createGameService(API_KEY);
    const result = await service.generateCase();

    expect(CaseSchema.safeParse(result.payload).success).toBe(true);
    expect(PleaNarrativeSchema.safeParse(result.pleaNarrative).success).toBe(true);

    expect(getOrSelectModel).toHaveBeenCalledWith(API_KEY);
    expect(runStatuteSelection).toHaveBeenCalledWith(API_KEY, MODEL);
    expect(runEnvironmentGen).toHaveBeenCalledWith(API_KEY, MODEL, validCase.charges);
    expect(runCharacterGen).toHaveBeenCalledWith(API_KEY, MODEL, validCase.charges);
    expect(runInterrogationGen).toHaveBeenCalledWith(API_KEY, MODEL, validCase.defendant, validCase.environment, {
      outcome: 'DENIAL',
      challengeGround: 'MIRANDA',
    });
    expect(runEvidenceGen).toHaveBeenCalledWith(
      API_KEY,
      MODEL,
      validCase.charges,
      validCase.environment,
      validCase.defendant,
      null,
    );
    expect(runVerdictVoice).toHaveBeenCalledWith(API_KEY, MODEL, validCase.charges, validCase.defendant);
    expect(finalizeCasePayload).toHaveBeenCalledWith(API_KEY, MODEL, {
      charges: validCase.charges,
      statuteContexts: validCase.statuteContexts,
      environment: validCase.environment,
      defendant: validCase.defendant,
      witnesses: validCase.witnesses,
      evidence: validCase.evidence,
    });
    // assessProsecution(validCase) scores 41 (MODERATE) — see fixtures.ts's
    // header comment on why the numbers land there.
    expect(runPleaNarrative).toHaveBeenCalledWith(API_KEY, MODEL, validCase, 'MODERATE', {
      pleadsToChargeIds: validCase.charges.map((c) => c.id),
      proposedSentence: [{ type: 'PRISON', unit: 'YEARS', amount: 8 }],
    }, 'REJECT');
  });

  it('asks getOrSelectModel (not the raw discovery call) for the model on every stage that needs one', async () => {
    // The "only resolved once per session" guarantee now lives in
    // getOrSelectModel's own module-scoped cache (modelSelection.test.ts),
    // not here — a fresh GameService instance (e.g. a later
    // generateAftermath call from a different component) still delegates
    // through getOrSelectModel each time, relying on its cache rather than
    // any instance-local memoization.
    const service = createGameService(API_KEY);
    await service.generateCase();
    await service.generateAftermath({
      caseData: validCase,
      pleaDecision: 'ACCEPT',
      verdict: null,
      imposedSentence: [],
    });

    expect(getOrSelectModel).toHaveBeenCalledWith(API_KEY);
  });

  it('propagates a stage failure without swallowing it', async () => {
    vi.mocked(runCharacterGen).mockRejectedValue(new Error('character generation failed'));
    const service = createGameService(API_KEY);
    await expect(service.generateCase()).rejects.toThrow(/character generation failed/);
  });
});

describe('createGameService().generateAftermath', () => {
  it('calls runAftermath with the discovered model and returns its narrative', async () => {
    const service = createGameService(API_KEY);
    const ctx = {
      caseData: validCase,
      pleaDecision: null,
      verdict: validCase.charges.map((c) => ({
        chargeId: c.id,
        chargeName: c.name,
        classification: c.classification,
        verdict: 'GUILTY' as const,
      })),
      imposedSentence: [],
    };

    const result = await service.generateAftermath(ctx);

    expect(result).toBe('The community absorbed the verdict quietly.');
    expect(runAftermath).toHaveBeenCalledWith(API_KEY, MODEL, ctx);
  });
});
