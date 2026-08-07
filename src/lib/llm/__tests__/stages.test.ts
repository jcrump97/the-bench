import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  runStatuteSelection,
  runEnvironmentGen,
  runCharacterGen,
  runInterrogationGen,
  runEvidenceGen,
  finalizeCasePayload,
  runVerdictVoice,
  runPleaNarrative,
  runAftermath,
  GameServiceError,
} from '../stages';
import { rawValidCase, validCase, rawInterrogationEvidence } from '../../__tests__/fixtures';
import { CaseSchema } from '../../../schemas/gameSchemas';

vi.mock('../geminiClient', async () => {
  const actual = await vi.importActual<typeof import('../geminiClient')>('../geminiClient');
  return { ...actual, callGemini: vi.fn() };
});

import { callGemini, GeminiError } from '../geminiClient';

const API_KEY = 'AIzaTestKey1234567890123456789';
const MODEL = 'gemini-flash-lite-latest';

const charge = validCase.charges[0]!;
// StatuteSelection now emits ChargeCore only; the voiced verdict layer is
// added in a later stage. Responses to that stage must omit verdictReactions
// and verdictOptions so the strict schema accepts them.
const chargeCore = {
  id: charge.id,
  name: charge.name,
  classification: charge.classification,
  elements: charge.elements,
  mandatoryMinimums: charge.mandatoryMinimums,
  maximumPenalties: charge.maximumPenalties,
};
const environment = validCase.environment;
const defendant = validCase.defendant;
const witnesses = validCase.witnesses;
const evidence = validCase.evidence;

function mockCallsWith(...responses: string[]): void {
  const mock = vi.mocked(callGemini);
  mock.mockReset();
  for (const response of responses) {
    mock.mockResolvedValueOnce(response);
  }
}

beforeEach(() => {
  vi.mocked(callGemini).mockReset();
});

describe('runStatuteSelection', () => {
  it('succeeds on the first valid response', async () => {
    mockCallsWith(JSON.stringify({ charges: [chargeCore], statuteContexts: rawValidCase.statuteContexts }));

    const result = await runStatuteSelection(API_KEY, MODEL);
    expect(result.charges).toHaveLength(1);
    expect(vi.mocked(callGemini)).toHaveBeenCalledTimes(1);
  });

  it('retries once after invalid JSON then succeeds', async () => {
    mockCallsWith(
      'not json',
      JSON.stringify({ charges: [chargeCore], statuteContexts: rawValidCase.statuteContexts }),
    );

    const result = await runStatuteSelection(API_KEY, MODEL);
    expect(result.charges).toHaveLength(1);
    expect(vi.mocked(callGemini)).toHaveBeenCalledTimes(2);
  });

  it('throws GameServiceError after exhausting retries', async () => {
    vi.mocked(callGemini).mockResolvedValue('not json');
    await expect(runStatuteSelection(API_KEY, MODEL)).rejects.toThrow(GameServiceError);
    expect(vi.mocked(callGemini)).toHaveBeenCalledTimes(3);
  });

  it('prefixes the thrown message with the stage name', async () => {
    // A pipeline runs 6+ of these — "Failed to produce valid output" alone
    // doesn't say which stage, which is exactly what made mistrials
    // untraceable before this was added.
    vi.mocked(callGemini).mockResolvedValue('not json');
    await expect(runStatuteSelection(API_KEY, MODEL)).rejects.toThrow(/^\[StatuteSelection\]/);
  });

  // The joined Zod issues say *what* Zod rejected, but not *what the model
  // actually returned* that triggered the rejection. The InterrogationGen
  // unwrapped-schema bug produced `interrogation: Invalid input` three times —
  // accurate but cryptic until you saw the model returned `{detectiveName,...}`
  // with no `interrogation` wrapper. Echoing the last raw response turns that
  // from a multi-hour bisection into a one-read diagnosis.
  it('echoes the last raw response on terminal schema failure', async () => {
    vi.mocked(callGemini).mockResolvedValue(JSON.stringify({ unexpected: 'shape' }));
    await expect(runStatuteSelection(API_KEY, MODEL)).rejects.toThrow(/Last response.*unexpected.*shape/);
  });

  // BAD_JSON already echoes the raw text in the error itself (via String(err)
  // on the SyntaxError, which names the offending token), so the explicit
  // "Last response:" suffix is only added for SCHEMA failures — but the raw
  // text is still present in the thrown message for JSON failures.
  it('includes the raw text in the terminal JSON-failure message', async () => {
    vi.mocked(callGemini).mockResolvedValue('definitely not json');
    await expect(runStatuteSelection(API_KEY, MODEL)).rejects.toThrow(/definitely not json/);
  });

  it('retries a transient GeminiError (network/429/5xx) and succeeds on a later attempt', async () => {
    // Previously a thrown GeminiError propagated straight out of
    // generateValidated, burning none of its own retry budget — a single
    // transient call failure killed the whole stage.
    const mock = vi.mocked(callGemini);
    mock.mockRejectedValueOnce(new GeminiError('server error', 503));
    mock.mockResolvedValueOnce(JSON.stringify({ charges: [chargeCore], statuteContexts: rawValidCase.statuteContexts }));

    const result = await runStatuteSelection(API_KEY, MODEL);
    expect(result.charges).toHaveLength(1);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('rethrows a non-retryable GeminiError immediately without spending the retry budget', async () => {
    // A bad request/bad key (never 429 or 5xx) fails identically on retry —
    // retrying it would just waste time.
    const mock = vi.mocked(callGemini);
    mock.mockRejectedValue(new GeminiError('bad request', 400));

    await expect(runStatuteSelection(API_KEY, MODEL)).rejects.toThrow(GeminiError);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('prefixes a rethrown non-retryable GeminiError with the stage name and preserves its status', async () => {
    // Same call-failure path as above, but asserting the two things the
    // Mistrial screen actually needs: which stage failed (the message
    // prefix) and that it is still classifiable as a GeminiError with its
    // original status intact, not just some generic Error.
    const mock = vi.mocked(callGemini);
    mock.mockRejectedValue(new GeminiError('Request contains an invalid argument', 400));

    let caught: unknown;
    try {
      await runStatuteSelection(API_KEY, MODEL);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(GeminiError);
    expect((caught as GeminiError).status).toBe(400);
    expect((caught as GeminiError).message).toMatch(/^\[StatuteSelection\]/);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('feeds the previous raw response back into the retry contents, not just the Zod issue message', async () => {
    // A reported mistrial burned all three attempts on the identical field
    // because the model only ever saw the Zod error text ("age: Invalid
    // input") and never the object it produced — it had nothing to repair,
    // so it re-rolled from scratch each time. The fix (buildRetryFeedback)
    // echoes the failed response back verbatim; this asserts that echo
    // actually reaches the second call's contents, not just the issue list.
    const badResponse = JSON.stringify({ defendant: { ...defendant, age: 5 } });
    mockCallsWith(badResponse, JSON.stringify({ defendant }));

    await runCharacterGen(API_KEY, MODEL, [charge]);

    const mock = vi.mocked(callGemini);
    expect(mock).toHaveBeenCalledTimes(2);
    const secondCallArgs = mock.mock.calls[1];
    const secondCallOptions = secondCallArgs?.[2] as { contents: string };
    expect(secondCallOptions.contents).toContain(badResponse);
  });
});

describe('runEnvironmentGen', () => {
  it('returns the validated environment', async () => {
    mockCallsWith(JSON.stringify({ environment }));
    const result = await runEnvironmentGen(API_KEY, MODEL, [charge]);
    expect(result).toEqual(environment);
  });
});

describe('runCharacterGen', () => {
  it('returns the validated defendant', async () => {
    mockCallsWith(JSON.stringify({ defendant }));
    const result = await runCharacterGen(API_KEY, MODEL, [charge]);
    expect(result).toEqual(defendant);
  });

  it('retries after a Zod validation failure (age out of range)', async () => {
    mockCallsWith(
      JSON.stringify({ defendant: { ...defendant, age: 5 } }),
      JSON.stringify({ defendant }),
    );
    const result = await runCharacterGen(API_KEY, MODEL, [charge]);
    expect(result).toEqual(defendant);
    expect(vi.mocked(callGemini)).toHaveBeenCalledTimes(2);
  });
});

describe('runInterrogationGen', () => {
  it('skips the call entirely for an INVOKED_COUNSEL profile', async () => {
    const result = await runInterrogationGen(API_KEY, MODEL, defendant, environment, { outcome: 'INVOKED_COUNSEL' });
    expect(result).toBeNull();
    expect(vi.mocked(callGemini)).not.toHaveBeenCalled();
  });

  it('forces outcome/challengeGround to match the derived profile regardless of the response', async () => {
    mockCallsWith(
      JSON.stringify({
        interrogation: { ...rawInterrogationEvidence.interrogation, outcome: 'FULL_CONFESSION', challengeGround: 'VOLUNTARINESS' },
      }),
    );

    const result = await runInterrogationGen(API_KEY, MODEL, defendant, environment, {
      outcome: 'DENIAL',
      challengeGround: 'MIRANDA',
    });

    expect(result?.outcome).toBe('DENIAL');
    expect(result?.challengeGround).toBe('MIRANDA');
  });

  // Regression: the Gemini responseSchema passed to callGemini must mirror the
  // Zod wrapper — a top-level `interrogation` object — not the unwrapped inner
  // shape. The unwrapped schema made the live API return `{ detectiveName, ... }`
  // and Zod reject it with `interrogation: Invalid input`; the unit-test mock
  // returned the wrapped shape so the divergence was invisible until a live run.
  it('sends the wrapped responseSchema (top-level `interrogation` property) to callGemini', async () => {
    mockCallsWith(
      JSON.stringify({
        interrogation: { ...rawInterrogationEvidence.interrogation, outcome: 'DENIAL', challengeGround: 'MIRANDA' },
      }),
    );

    await runInterrogationGen(API_KEY, MODEL, defendant, environment, {
      outcome: 'DENIAL',
      challengeGround: 'MIRANDA',
    });

    expect(vi.mocked(callGemini)).toHaveBeenCalledTimes(1);
    const schema = vi.mocked(callGemini).mock.calls[0]![2].responseSchema;
    expect(schema.type).toBe('object');
    expect(schema.properties).toHaveProperty('interrogation');
    expect(schema.required).toEqual(['interrogation']);
  });
});

describe('runEvidenceGen', () => {
  it('returns validated evidence and witnesses with no interrogation required', async () => {
    mockCallsWith(JSON.stringify({ evidence, witnesses }));
    const result = await runEvidenceGen(API_KEY, MODEL, [charge], environment, defendant, null);
    expect(result.evidence).toHaveLength(evidence.length);
    expect(result.witnesses).toHaveLength(witnesses.length);
  });

  it('normalizes an explicit null interrogation field to undefined (Gemini structured-output quirk)', async () => {
    const evidenceWithExplicitNulls = evidence.map((item) => ({ ...item, interrogation: null }));
    mockCallsWith(JSON.stringify({ evidence: evidenceWithExplicitNulls, witnesses }));

    const result = await runEvidenceGen(API_KEY, MODEL, [charge], environment, defendant, null);
    expect(result.evidence).toHaveLength(evidence.length);
    expect(result.evidence.every((item) => item.interrogation === undefined)).toBe(true);
  });

  it('overrides the interrogation echo fields on the INTERROGATION exhibit', async () => {
    const wrongEchoEvidence = {
      ...rawInterrogationEvidence,
      interrogation: { ...rawInterrogationEvidence.interrogation, outcome: 'FULL_CONFESSION', challengeGround: 'VOLUNTARINESS' },
    };
    mockCallsWith(JSON.stringify({ evidence: [...evidence, wrongEchoEvidence], witnesses }));

    const requiredInterrogation = rawInterrogationEvidence.interrogation as {
      detectiveName: string;
      outcome: 'DENIAL';
      challengeGround: 'MIRANDA';
      lines: { speaker: 'DETECTIVE' | 'DEFENDANT'; text: string }[];
    };
    const result = await runEvidenceGen(API_KEY, MODEL, [charge], environment, defendant, requiredInterrogation);

    const tape = result.evidence.find((item) => item.type === 'INTERROGATION');
    expect(tape?.interrogation?.outcome).toBe('DENIAL');
    expect(tape?.interrogation?.challengeGround).toBe('MIRANDA');
  });

  it('retries when an interrogation is required but the response omits any INTERROGATION exhibit', async () => {
    const requiredInterrogation = rawInterrogationEvidence.interrogation as {
      detectiveName: string;
      outcome: 'DENIAL';
      challengeGround: 'MIRANDA';
      lines: { speaker: 'DETECTIVE' | 'DEFENDANT'; text: string }[];
    };

    mockCallsWith(
      JSON.stringify({ evidence, witnesses }),
      JSON.stringify({ evidence: [...evidence, rawInterrogationEvidence], witnesses }),
    );

    const result = await runEvidenceGen(API_KEY, MODEL, [charge], environment, defendant, requiredInterrogation);
    expect(result.evidence.some((item) => item.type === 'INTERROGATION')).toBe(true);
    expect(vi.mocked(callGemini)).toHaveBeenCalledTimes(2);
  });

  it('retries when no interrogation is required but the response includes one anyway', async () => {
    mockCallsWith(
      JSON.stringify({ evidence: [...evidence, rawInterrogationEvidence], witnesses }),
      JSON.stringify({ evidence, witnesses }),
    );

    const result = await runEvidenceGen(API_KEY, MODEL, [charge], environment, defendant, null);
    expect(result.evidence.some((item) => item.type === 'INTERROGATION')).toBe(false);
    expect(vi.mocked(callGemini)).toHaveBeenCalledTimes(2);
  });
});

describe('finalizeCasePayload', () => {
  const parts = {
    charges: [charge],
    statuteContexts: rawValidCase.statuteContexts,
    environment,
    defendant,
    witnesses,
    evidence,
  };

  it('assembles a valid CasePayload on the first attempt', async () => {
    mockCallsWith(
      JSON.stringify({
        caseId: rawValidCase.caseId,
        summary: rawValidCase.summary,
        statementOfFacts: rawValidCase.statementOfFacts,
        closingArguments: rawValidCase.closingArguments,
      }),
    );

    const result = await finalizeCasePayload(API_KEY, MODEL, parts);
    expect(CaseSchema.safeParse(result).success).toBe(true);
    expect(vi.mocked(callGemini)).toHaveBeenCalledTimes(1);
  });

  it('fixes duplicate ids deterministically instead of spending a repair round', async () => {
    // Two charges sharing the same element id — a cross-stage uniqueness
    // violation finalizeCasePayload's own finalize-fields call can't fix,
    // since it never touches charges. Regenerating the entire case through
    // Gemini to resolve a duplicate id is wildly disproportionate, so
    // reconcileCrossStageIds renames the collision in code and the LLM repair
    // round is never reached: one call, not two.
    const duplicateElementParts = {
      ...parts,
      charges: [charge, { ...charge, id: 'c2' }],
    };

    mockCallsWith(
      JSON.stringify({
        caseId: rawValidCase.caseId,
        summary: rawValidCase.summary,
        statementOfFacts: rawValidCase.statementOfFacts,
        closingArguments: rawValidCase.closingArguments,
      }),
    );

    const result = await finalizeCasePayload(API_KEY, MODEL, duplicateElementParts);
    expect(CaseSchema.safeParse(result).success).toBe(true);
    expect(vi.mocked(callGemini)).toHaveBeenCalledTimes(1);

    // The first claimant keeps its id so existing references stay valid; only
    // the later collision is renamed.
    const elementIds = result.charges.flatMap((c) => c.elements.map((e) => e.id));
    expect(new Set(elementIds).size).toBe(elementIds.length);
    expect(elementIds[0]).toBe(charge.elements[0]!.id);
  });

  it('drops a stale closingArguments.exhibitPoints reference instead of spending a repair round', async () => {
    // exhibitPoints is generated against the pre-reconciliation evidence ids
    // (buildFinalizeContents lists them from `parts`), so a reference the
    // model got wrong — a hallucinated id, or (on an actual evidence-id
    // collision) a later duplicate that reconcileCrossStageIds renamed — must
    // not survive into the assembled case. Failing CaseSchema's referential
    // check here would turn a mechanical fix into an expensive LLM repair
    // round, or worse, silently validate a broken reference.
    mockCallsWith(
      JSON.stringify({
        caseId: rawValidCase.caseId,
        summary: rawValidCase.summary,
        statementOfFacts: rawValidCase.statementOfFacts,
        closingArguments: {
          ...rawValidCase.closingArguments,
          exhibitPoints: [
            {
              evidenceId: 'e1',
              ifAdmitted: { prosecution: 'The People rely on the fingerprint.', defense: null },
              ifExcluded: { prosecution: null, defense: 'The defense notes its exclusion.' },
            },
            {
              evidenceId: 'nonexistent-exhibit',
              ifAdmitted: { prosecution: 'A stale reference the model invented.', defense: null },
              ifExcluded: { prosecution: null, defense: null },
            },
          ],
        },
      }),
    );

    const result = await finalizeCasePayload(API_KEY, MODEL, parts);
    expect(CaseSchema.safeParse(result).success).toBe(true);
    expect(vi.mocked(callGemini)).toHaveBeenCalledTimes(1);
    expect(result.closingArguments.exhibitPoints?.map((p) => p.evidenceId)).toEqual(['e1']);
  });
});

describe('runVerdictVoice', () => {
  const voiceFor = (id: string) => ({
    id,
    verdictReactions: charge.verdictReactions,
    verdictOptions: charge.verdictOptions,
  });

  it('retries when the model echoes a charge id that was not requested', async () => {
    // Before the schema checked ids against the request, a wrong echo validated
    // here and then hit an un-retried throw in gameService, killing the whole
    // generation two stages from the end. It must be an ordinary repairable
    // validation failure instead.
    mockCallsWith(
      JSON.stringify({ charges: [voiceFor('charge-hallucinated')] }),
      JSON.stringify({ charges: [voiceFor(charge.id)] }),
    );

    const result = await runVerdictVoice(API_KEY, MODEL, [chargeCore], defendant);

    expect(vi.mocked(callGemini)).toHaveBeenCalledTimes(2);
    expect(result[0]!.id).toBe(charge.id);
    // The retry must name the offending id so the repair is actionable.
    const retryPrompt = vi.mocked(callGemini).mock.calls[1]![2]!.contents;
    expect(retryPrompt).toContain('charge-hallucinated');
  });

  it('retries when an entry for a requested charge is missing entirely', async () => {
    const second = { ...chargeCore, id: 'charge-second', elements: [{ id: 'charge-second-el', description: 'An element.', isProven: false }] };
    mockCallsWith(
      JSON.stringify({ charges: [voiceFor(charge.id)] }),
      JSON.stringify({ charges: [voiceFor(charge.id), voiceFor('charge-second')] }),
    );

    const result = await runVerdictVoice(API_KEY, MODEL, [chargeCore, second], defendant);

    expect(vi.mocked(callGemini)).toHaveBeenCalledTimes(2);
    expect(result.map((c) => c.id)).toEqual([charge.id, 'charge-second']);
    expect(vi.mocked(callGemini).mock.calls[1]![2]!.contents).toContain('charge-second');
  });

  it('puts each charge id on its own labelled field in the prompt', async () => {
    mockCallsWith(JSON.stringify({ charges: [voiceFor(charge.id)] }));

    await runVerdictVoice(API_KEY, MODEL, [chargeCore], defendant);

    expect(vi.mocked(callGemini).mock.calls[0]![2]!.contents).toContain(`id: ${charge.id}`);
  });
});

describe('runPleaNarrative', () => {
  it('requests only prosecutionRationale for a WEAK band', async () => {
    mockCallsWith(JSON.stringify({ prosecutionRationale: 'The People decline to offer given the thin proof.' }));

    const parsedCase = CaseSchema.parse(rawValidCase);
    const result = await runPleaNarrative(API_KEY, MODEL, parsedCase, 'WEAK', null, 'REJECT');
    expect(result.prosecutionRationale).toBeTruthy();
    expect(result.defenseRationale).toBeUndefined();
    expect(result.allocution).toBeUndefined();
  });

  it('requires the full authored set for a MODERATE band', async () => {
    mockCallsWith(
      JSON.stringify({
        prosecutionRationale: 'The People offer a negotiated plea.',
        defenseRationale: 'The defense recommends acceptance.',
        allocution: 'I take responsibility for my actions, Your Honor.',
        pleaReactions: {
          ACCEPT: [{ speaker: 'DEFENSE', text: 'The defense thanks the court.' }],
          REJECT: [{ speaker: 'PROSECUTION', text: 'The People will proceed to trial.' }],
        },
        pleaRulingOptions: [
          { choice: 'ACCEPT', lineText: 'The court accepts the negotiated plea.' },
          { choice: 'REJECT', lineText: 'The court rejects the negotiated plea.' },
        ],
      }),
    );

    const parsedCase = CaseSchema.parse(rawValidCase);
    const result = await runPleaNarrative(API_KEY, MODEL, parsedCase, 'MODERATE', {
      pleadsToChargeIds: parsedCase.charges.map((c) => c.id),
      proposedSentence: [{ type: 'PRISON', unit: 'YEARS', amount: 8 }],
    }, 'REJECT');
    expect(result.defenseRationale).toBeTruthy();
    expect(result.allocution).toBeTruthy();
    expect(result.pleaReactions).toBeDefined();
    expect(result.pleaRulingOptions).toBeDefined();
  });

  it('retries when pleaRulingOptions is missing coverage of a choice', async () => {
    const incompleteOptions = [{ choice: 'ACCEPT', lineText: 'The court accepts the negotiated plea.' }];
    const completeResponse = {
      prosecutionRationale: 'The People offer a negotiated plea.',
      defenseRationale: 'The defense recommends acceptance.',
      allocution: 'I take responsibility for my actions, Your Honor.',
      pleaReactions: {
        ACCEPT: [{ speaker: 'DEFENSE', text: 'The defense thanks the court.' }],
        REJECT: [{ speaker: 'PROSECUTION', text: 'The People will proceed to trial.' }],
      },
      pleaRulingOptions: [
        { choice: 'ACCEPT', lineText: 'The court accepts the negotiated plea.' },
        { choice: 'REJECT', lineText: 'The court rejects the negotiated plea.' },
      ],
    };

    mockCallsWith(
      JSON.stringify({ ...completeResponse, pleaRulingOptions: incompleteOptions }),
      JSON.stringify(completeResponse),
    );

    const parsedCase = CaseSchema.parse(rawValidCase);
    const result = await runPleaNarrative(API_KEY, MODEL, parsedCase, 'STRONG', {
      pleadsToChargeIds: parsedCase.charges.map((c) => c.id),
      proposedSentence: [{ type: 'PRISON', unit: 'YEARS', amount: 10 }],
    }, 'REJECT');
    expect(result.pleaRulingOptions).toHaveLength(2);
    expect(vi.mocked(callGemini)).toHaveBeenCalledTimes(2);
  });
});

describe('runAftermath', () => {
  const ctx = {
    caseData: CaseSchema.parse(rawValidCase),
    pleaDecision: 'ACCEPT' as const,
    verdict: null,
    imposedSentence: [],
  };

  it('returns the validated narrative', async () => {
    mockCallsWith(JSON.stringify({ narrative: 'The defendant accepted responsibility and the community moved on.' }));
    const result = await runAftermath(API_KEY, MODEL, ctx);
    expect(result).toBeTruthy();
  });

  it('retries when the narrative exceeds the length limit', async () => {
    mockCallsWith(
      JSON.stringify({ narrative: 'x'.repeat(4001) }),
      JSON.stringify({ narrative: 'A short aftermath.' }),
    );
    const result = await runAftermath(API_KEY, MODEL, ctx);
    expect(result).toBe('A short aftermath.');
    expect(vi.mocked(callGemini)).toHaveBeenCalledTimes(2);
  });
});
