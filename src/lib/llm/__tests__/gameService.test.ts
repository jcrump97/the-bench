import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGameService } from '../gameService';
import { validCase } from '../../__tests__/fixtures';
import { CaseSchema, PleaNarrativeSchema } from '../../../schemas/gameSchemas';
import { GenerationCancelledError } from '../../generationProgress';

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
      motionRulings: [],
    });

    expect(getOrSelectModel).toHaveBeenCalledWith(API_KEY);
  });

  it('reports every step as it starts and finishes, in pipeline order', async () => {
    const events: string[] = [];
    await createGameService(API_KEY).generateCase({
      onProgress: (event) => events.push(`${event.stepId}:${event.status}`),
    });

    const finished = events.filter((e) => e.endsWith(':DONE')).map((e) => e.split(':')[0]);
    expect(finished).toEqual([
      'MODEL_SELECTION', 'STATUTES', 'SCENE', 'DEFENDANT', 'INTERROGATION_PROFILE', 'INTERROGATION',
      'EVIDENCE', 'VERDICT_VOICE', 'FINALIZE', 'PLEA_STRUCTURE', 'PLEA_NARRATIVE',
    ]);
    // Every step that finished was first reported as started.
    for (const step of finished) {
      expect(events.indexOf(`${step}:STARTED`)).toBeLessThan(events.indexOf(`${step}:DONE`));
    }
  });

  it('skips the interview recording, without a call, when the defendant invoked counsel', async () => {
    // Three priors and an unremarkable temperament derives INVOKED_COUNSEL
    // (deriveInterrogationProfile): the defendant asks for a lawyer at once.
    const prior = { chargeName: 'Petty theft', year: 2015, sentences: [] };
    vi.mocked(runCharacterGen).mockResolvedValue({
      ...validCase.defendant,
      pastConvictions: [prior, { ...prior, year: 2017 }, { ...prior, year: 2019 }],
    });
    const events: string[] = [];
    await createGameService(API_KEY).generateCase({ onProgress: (e) => events.push(`${e.stepId}:${e.status}`) });

    expect(events).toContain('INTERROGATION:SKIPPED');
    expect(events).not.toContain('INTERROGATION:STARTED');
    expect(runInterrogationGen).not.toHaveBeenCalled();
  });

  it('stops at the next step boundary once cancelled, with a cancellation rather than a failure', async () => {
    const controller = new AbortController();
    vi.mocked(runEnvironmentGen).mockImplementation(async () => {
      controller.abort();
      return validCase.environment;
    });

    await expect(createGameService(API_KEY).generateCase({ signal: controller.signal })).rejects.toBeInstanceOf(
      GenerationCancelledError,
    );
    expect(runCharacterGen).not.toHaveBeenCalled();
  });

  it('cannot be failed by a progress listener that throws', async () => {
    const result = await createGameService(API_KEY).generateCase({
      onProgress: () => {
        throw new Error('listener bug');
      },
    });
    expect(CaseSchema.safeParse(result.payload).success).toBe(true);
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
      motionRulings: [],
    };

    const result = await service.generateAftermath(ctx);

    expect(result).toBe('The community absorbed the verdict quietly.');
    expect(runAftermath).toHaveBeenCalledWith(API_KEY, MODEL, ctx);
  });
});
