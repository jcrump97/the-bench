import { z } from 'zod';
import {
  ChargeSchema,
  EnvironmentSchema,
  CharacterSchema,
  WitnessSchema,
  EvidenceSchema,
  InterrogationSchema,
  ReactionBeatSchema,
  PleaDecisionSchema,
  PleaNarrativeSchema,
  CaseSchema,
  AftermathNarrativeSchema,
  type Charge,
  type Environment,
  type PleaNarrative,
  type CasePayload,
} from '../../schemas/gameSchemas';
import type { InterrogationProfile } from '../interrogation';
import type { AftermathContext } from '../caseSource';
import { callGemini, GeminiError, type GeminiSchema } from './geminiClient';
import { reportAttemptFailure } from './generationObserver';

export class GameServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GameServiceError';
  }
}

type Defendant = CasePayload['defendant'];
type Evidence = CasePayload['evidence'][number];
type Witness = CasePayload['witnesses'][number];

// ============================================================================
// Generic "generate, parse, validate, retry-with-feedback" loop shared by
// every pipeline stage. Gemini's structured-output mode shapes the response;
// the Zod schema is the real trust boundary — the same one hand-authored
// demo cases cross. A validation failure feeds the Zod issues back into the
// next prompt as corrective feedback, up to `maxRetries` extra attempts.
// ============================================================================
async function generateValidated<Schema extends z.ZodTypeAny>(
  apiKey: string,
  model: string,
  stageName: string,
  systemInstruction: string,
  buildContents: (feedback: string | undefined) => string,
  responseSchema: GeminiSchema,
  zodSchema: Schema,
  maxRetries = 2,
): Promise<z.infer<Schema>> {
  let feedback: string | undefined;
  let lastError = 'unknown error';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let text: string;
    try {
      text = await callGemini(apiKey, model, {
        systemInstruction,
        contents: buildContents(feedback),
        responseSchema,
      });
    } catch (err) {
      // A non-retryable client error (bad request, bad key — never 429 or
      // 5xx) will fail identically on retry, so it isn't worth spending the
      // stage's budget on: surface it immediately. Everything else
      // (network errors, and 429/5xx that already exhausted
      // fetchWithRetry's own attempts) gets the same retry-with-feedback
      // budget a validation failure does, instead of aborting the whole
      // stage on one transient call failure.
      if (err instanceof GeminiError && err.status !== null && err.status !== 429 && err.status < 500) {
        throw err;
      }
      lastError = `Gemini call failed: ${err instanceof Error ? err.message : String(err)}`;
      reportAttemptFailure({ stage: stageName, attempt, kind: 'CALL_FAILED', issues: [lastError] });
      continue;
    }

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (err) {
      lastError = `Response was not valid JSON: ${String(err)}`;
      reportAttemptFailure({ stage: stageName, attempt, kind: 'BAD_JSON', issues: [lastError] });
      feedback = lastError;
      continue;
    }

    const result = zodSchema.safeParse(raw);
    if (result.success) return result.data;

    const issues = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    reportAttemptFailure({ stage: stageName, attempt, kind: 'SCHEMA', issues });
    lastError = issues.join('; ');
    feedback = `Your previous response failed validation with these issues — fix them and return a complete, corrected JSON object: ${lastError}`;
  }

  // The stage name is what actually makes this actionable in
  // console.error/lastGenerationError.message — a pipeline runs 6+ of these,
  // and "Failed to produce valid output" alone doesn't say which one.
  throw new GameServiceError(`[${stageName}] Failed to produce valid output after ${maxRetries + 1} attempt(s): ${lastError}`);
}

function requireChoiceCoverage(options: { choice: string }[], allChoices: readonly string[]): string | null {
  const missing = allChoices.filter((choice) => !options.some((o) => o.choice === choice));
  return missing.length > 0 ? `Missing judge-line coverage for: ${missing.join(', ')}` : null;
}

// ============================================================================
// Hand-written Gemini responseSchema building blocks (a constrained subset of
// OpenAPI Schema). These shape the model's output; Zod schemas above are the
// actual validation gate, so these only need to be close enough to get
// mostly-valid JSON on the first try.
// ============================================================================
const SENTENCE_GEMINI_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['PRISON', 'JAIL', 'FINE', 'COMMUNITY_SERVICE', 'PROBATION'] },
    unit: { type: 'string', enum: ['YEARS', 'MONTHS', 'DAYS', 'DOLLARS', 'HOURS'] },
    amount: { type: 'integer', minimum: 1 },
    conditions: {
      type: 'array',
      items: {
        type: 'string',
        enum: [
          'SUBSTANCE_ABUSE_TREATMENT',
          'ANGER_MANAGEMENT',
          'RANDOM_DRUG_TESTING',
          'NO_CONTACT_ORDER',
          'ELECTRONIC_MONITORING',
          'COMMUNITY_SERVICE',
        ],
      },
    },
  },
  required: ['type', 'unit', 'amount'],
};

function reactionBeatGeminiSchema(): GeminiSchema {
  return {
    type: 'array',
    minItems: 1,
    maxItems: 4,
    items: {
      type: 'object',
      properties: {
        speaker: { type: 'string', enum: ['PROSECUTION', 'DEFENSE', 'CLERK'] },
        text: { type: 'string', minLength: 1, maxLength: 600 },
      },
      required: ['speaker', 'text'],
    },
  };
}

function judgeLineOptionsGeminiSchema(choices: string[]): GeminiSchema {
  return {
    type: 'array',
    minItems: 2,
    maxItems: 6,
    items: {
      type: 'object',
      properties: {
        choice: { type: 'string', enum: choices },
        lineText: { type: 'string', minLength: 1, maxLength: 300 },
      },
      required: ['choice', 'lineText'],
    },
  };
}

const CHARGE_GEMINI_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', minLength: 1, maxLength: 40 },
    name: { type: 'string', minLength: 1, maxLength: 200 },
    classification: { type: 'string', enum: ['FELONY', 'MISDEMEANOR', 'INFRACTION'] },
    elements: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        properties: { id: { type: 'string', minLength: 1, maxLength: 40 }, description: { type: 'string', maxLength: 500 } },
        required: ['id', 'description'],
      },
    },
    mandatoryMinimums: { type: 'array', items: SENTENCE_GEMINI_SCHEMA },
    maximumPenalties: { type: 'array', minItems: 1, items: SENTENCE_GEMINI_SCHEMA },
    verdictReactions: {
      type: 'object',
      properties: { GUILTY: reactionBeatGeminiSchema(), NOT_GUILTY: reactionBeatGeminiSchema() },
      required: ['GUILTY', 'NOT_GUILTY'],
    },
    verdictOptions: judgeLineOptionsGeminiSchema(['GUILTY', 'NOT_GUILTY']),
  },
  required: [
    'id',
    'name',
    'classification',
    'elements',
    'mandatoryMinimums',
    'maximumPenalties',
    'verdictReactions',
    'verdictOptions',
  ],
};

const ENVIRONMENT_GEMINI_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: {
    locationType: { type: 'string', enum: ['RESIDENTIAL', 'COMMERCIAL', 'PUBLIC_SPACE', 'VEHICLE', 'DIGITAL'] },
    timeOfDay: { type: 'string', enum: ['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT'] },
    weather: { type: 'string', enum: ['CLEAR', 'RAIN', 'FOG', 'SNOW', 'N/A'] },
    description: { type: 'string', maxLength: 500 },
  },
  required: ['locationType', 'timeOfDay', 'weather', 'description'],
};

const CHARACTER_GEMINI_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: {
    firstName: { type: 'string', maxLength: 50 },
    lastName: { type: 'string', maxLength: 50 },
    age: { type: 'integer', minimum: 18, maximum: 120 },
    demographics: {
      type: 'object',
      properties: {
        relationshipStatus: { type: 'string', enum: ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED'] },
        children: { type: 'integer', minimum: 0, maximum: 30 },
        employmentStatus: { type: 'string', enum: ['EMPLOYED', 'UNEMPLOYED', 'STUDENT', 'RETIRED'] },
        educationLevel: {
          type: 'string',
          enum: ['SOME_HIGH_SCHOOL', 'HIGH_SCHOOL', 'COLLEGE', 'ADVANCED_DEGREE'],
        },
        substanceAbuseHistory: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              substance: { type: 'string', maxLength: 100 },
              status: { type: 'string', enum: ['ACTIVE', 'IN_RECOVERY', 'NONE_REPORTED'] },
            },
            required: ['substance', 'status'],
          },
        },
      },
      required: ['relationshipStatus', 'children', 'employmentStatus', 'educationLevel', 'substanceAbuseHistory'],
    },
    pastConvictions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          chargeName: { type: 'string', maxLength: 200 },
          year: { type: 'integer', minimum: 1900, maximum: new Date().getFullYear() },
          sentences: { type: 'array', items: SENTENCE_GEMINI_SCHEMA },
        },
        required: ['chargeName', 'year', 'sentences'],
      },
    },
    oceanTraits: {
      type: 'object',
      properties: {
        openness: { type: 'integer', minimum: 1, maximum: 10 },
        conscientiousness: { type: 'integer', minimum: 1, maximum: 10 },
        extraversion: { type: 'integer', minimum: 1, maximum: 10 },
        agreeableness: { type: 'integer', minimum: 1, maximum: 10 },
        neuroticism: { type: 'integer', minimum: 1, maximum: 10 },
      },
      required: ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'],
    },
  },
  required: ['firstName', 'lastName', 'age', 'demographics', 'pastConvictions', 'oceanTraits'],
};

const INTERROGATION_GEMINI_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: {
    detectiveName: { type: 'string', minLength: 1, maxLength: 101 },
    outcome: { type: 'string', enum: ['FULL_CONFESSION', 'PARTIAL_ADMISSION', 'DENIAL'] },
    challengeGround: { type: 'string', enum: ['MIRANDA', 'VOLUNTARINESS'] },
    lines: {
      type: 'array',
      minItems: 4,
      maxItems: 24,
      items: {
        type: 'object',
        properties: {
          speaker: { type: 'string', enum: ['DETECTIVE', 'DEFENDANT'] },
          text: { type: 'string', minLength: 1, maxLength: 400 },
        },
        required: ['speaker', 'text'],
      },
    },
  },
  required: ['detectiveName', 'outcome', 'challengeGround', 'lines'],
};

const WITNESS_GEMINI_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', minLength: 1, maxLength: 40 },
    name: { type: 'string', maxLength: 101 },
    role: { type: 'string', enum: ['EYEWITNESS', 'EXPERT', 'CHARACTER', 'VICTIM', 'INVESTIGATOR'] },
    bias: { type: 'string', enum: ['PROSECUTION', 'DEFENSE', 'NEUTRAL'] },
    statement: { type: 'string', maxLength: 1000 },
    credibilityScore: {
      type: 'integer',
      minimum: 1,
      maximum: 10,
      description: 'How credible this witness is, as a whole number from 1 (least) to 10 (most). Never a 0-1 probability.',
    },
    directExamination: { type: 'string', minLength: 1, maxLength: 1200 },
    crossExamination: { type: 'string', maxLength: 1200, nullable: true },
  },
  required: [
    'id',
    'name',
    'role',
    'bias',
    'statement',
    'credibilityScore',
    'directExamination',
    'crossExamination',
  ],
};

const EVIDENCE_GEMINI_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', minLength: 1, maxLength: 40 },
    name: { type: 'string', minLength: 3, maxLength: 100 },
    type: {
      type: 'string',
      enum: ['DOCUMENTARY', 'PHYSICAL', 'DIGITAL', 'FORENSIC', 'CIRCUMSTANTIAL', 'INTERROGATION'],
    },
    description: { type: 'string', maxLength: 600 },
    disclosureSummary: { type: 'string', minLength: 1, maxLength: 400 },
    relevanceScore: {
      type: 'integer',
      minimum: 1,
      maximum: 10,
      description: 'How much this exhibit matters to the case, as a whole number from 1 (least) to 10 (most). Never a 0-1 probability.',
    },
    objectionRisk: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
    targetElementId: { type: 'string', maxLength: 40, nullable: true },
    prosecutionArgument: { type: 'string', minLength: 1, maxLength: 600 },
    defenseObjection: { type: 'string', maxLength: 600, nullable: true },
    rulingReactions: {
      type: 'object',
      properties: { ADMITTED: reactionBeatGeminiSchema(), EXCLUDED: reactionBeatGeminiSchema() },
      required: ['ADMITTED', 'EXCLUDED'],
    },
    rulingOptions: judgeLineOptionsGeminiSchema(['ADMITTED', 'EXCLUDED']),
    interrogation: { ...INTERROGATION_GEMINI_SCHEMA, nullable: true },
  },
  required: [
    'id',
    'name',
    'type',
    'description',
    'disclosureSummary',
    'relevanceScore',
    'objectionRisk',
    'targetElementId',
    'prosecutionArgument',
    'defenseObjection',
    'rulingReactions',
    'rulingOptions',
  ],
};

// ============================================================================
// Stage 1 — StatuteSelection
// ============================================================================
const StatuteSelectionSchema = z.object({
  charges: z.array(ChargeSchema).min(1),
  statuteContexts: z.array(z.string().max(500)).min(1),
});

const STATUTE_SELECTION_GEMINI_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: {
    charges: { type: 'array', minItems: 1, items: CHARGE_GEMINI_SCHEMA },
    statuteContexts: { type: 'array', minItems: 1, items: { type: 'string', maxLength: 500 } },
  },
  required: ['charges', 'statuteContexts'],
};

// A sentence's `conditions` array is valid on a PROBATION sentence only (at
// least one item) and must be omitted entirely for PRISON/JAIL/FINE/
// COMMUNITY_SERVICE — the Gemini responseSchema exposes `conditions` as an
// optional field on every sentence type (Gemini's schema format can't express
// a discriminated union), so nothing else stops the model from attaching an
// empty or stray `conditions` array to a non-PROBATION sentence, which the
// real Zod validation (a strict discriminated union) then rejects.
const SENTENCE_CONDITIONS_INSTRUCTION = `For any sentence object: include "conditions" only when "type" is "PROBATION", and in that case give it at least one item; omit "conditions" entirely for PRISON, JAIL, FINE, and COMMUNITY_SERVICE sentences.`;

const STATUTE_SELECTION_SYSTEM = `You are generating the statutory charges for a California criminal court simulation. Invent one or more realistic charges under California law, each with its own elements, statutory sentencing ranges, and voiced verdict reactions/options. Every id must be unique. Do not include any real person's name. This is a bench trial: the judge alone decides every verdict. There is no jury — never write a verdict reaction or judge-line option that references a jury, jurors, or a jury trial. ${SENTENCE_CONDITIONS_INSTRUCTION}`;

function buildStatuteSelectionContents(feedback: string | undefined): string {
  const base = 'Generate the charges and statuteContexts for a new case.';
  return feedback ? `${base}\n\n${feedback}` : base;
}

export async function runStatuteSelection(
  apiKey: string,
  model: string,
): Promise<{ charges: Charge[]; statuteContexts: string[] }> {
  return generateValidated(
    apiKey,
    model,
    'StatuteSelection',
    STATUTE_SELECTION_SYSTEM,
    buildStatuteSelectionContents,
    STATUTE_SELECTION_GEMINI_SCHEMA,
    StatuteSelectionSchema,
  );
}

// ============================================================================
// Stage 2 — EnvironmentGen
// ============================================================================
const EnvironmentGenSchema = z.object({ environment: EnvironmentSchema });

const ENVIRONMENT_GEN_GEMINI_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: { environment: ENVIRONMENT_GEMINI_SCHEMA },
  required: ['environment'],
};

const ENVIRONMENT_GEN_SYSTEM = `You are generating the scene environment for a California criminal court simulation: where and when the alleged offense occurred.`;

function buildEnvironmentGenContents(charges: Charge[], feedback: string | undefined): string {
  const base = `Generate the environment for a case involving these charges: ${charges.map((c) => c.name).join(', ')}.`;
  return feedback ? `${base}\n\n${feedback}` : base;
}

export async function runEnvironmentGen(apiKey: string, model: string, charges: Charge[]): Promise<Environment> {
  const data = await generateValidated(
    apiKey,
    model,
    'EnvironmentGen',
    ENVIRONMENT_GEN_SYSTEM,
    (feedback) => buildEnvironmentGenContents(charges, feedback),
    ENVIRONMENT_GEN_GEMINI_SCHEMA,
    EnvironmentGenSchema,
  );
  return data.environment;
}

// ============================================================================
// Stage 3 — CharacterGen
// ============================================================================
const CharacterGenSchema = z.object({ defendant: CharacterSchema });

const CHARACTER_GEN_GEMINI_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: { defendant: CHARACTER_GEMINI_SCHEMA },
  required: ['defendant'],
};

const CHARACTER_GEN_SYSTEM = `You are generating the defendant for a California criminal court simulation: a fictional person with demographics, criminal history, and OCEAN personality traits (openness, conscientiousness, extraversion, agreeableness, neuroticism, each 1-10). These traits are hidden behavior drivers — never state them as numbers in any prose fields elsewhere. Do not use any real person's identity. Each past conviction's sentences follow the same rule as any other sentence: ${SENTENCE_CONDITIONS_INSTRUCTION}`;

function buildCharacterGenContents(charges: Charge[], feedback: string | undefined): string {
  const base = `Generate the defendant for a case involving these charges: ${charges.map((c) => c.name).join(', ')}.`;
  return feedback ? `${base}\n\n${feedback}` : base;
}

export async function runCharacterGen(apiKey: string, model: string, charges: Charge[]): Promise<Defendant> {
  const data = await generateValidated(
    apiKey,
    model,
    'CharacterGen',
    CHARACTER_GEN_SYSTEM,
    (feedback) => buildCharacterGenContents(charges, feedback),
    CHARACTER_GEN_GEMINI_SCHEMA,
    CharacterGenSchema,
  );
  return data.defendant;
}

// ============================================================================
// Stage 4 — InterrogationGen (skipped entirely for INVOKED_COUNSEL profiles)
// ============================================================================
const InterrogationGenSchema = z.object({ interrogation: InterrogationSchema });

const INTERROGATION_GEN_GEMINI_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: { interrogation: INTERROGATION_GEMINI_SCHEMA },
  required: ['interrogation'],
};

const INTERROGATION_GEN_SYSTEM = `You are dramatizing a recorded police custodial interrogation for a California criminal court simulation. You are given the exact structural outcome the interview must produce and the exact ground on which the defense will move to suppress it — write a transcript (4-24 lines, alternating detective/defendant naturally) that dramatizes precisely that outcome. Do not deviate from the given outcome or challengeGround. This is a bench trial: the judge alone decides the verdict. There is no jury — neither the detective nor the defendant should reference a jury or jury trial.`;

function buildInterrogationGenContents(
  defendant: Defendant,
  profile: Extract<InterrogationProfile, { outcome: 'FULL_CONFESSION' | 'PARTIAL_ADMISSION' | 'DENIAL' }>,
  feedback: string | undefined,
): string {
  const base = `Defendant: ${defendant.firstName} ${defendant.lastName}. Required outcome: ${profile.outcome}. Required challengeGround: ${profile.challengeGround}.`;
  return feedback ? `${base}\n\n${feedback}` : base;
}

export async function runInterrogationGen(
  apiKey: string,
  model: string,
  defendant: Defendant,
  profile: InterrogationProfile,
): Promise<z.infer<typeof InterrogationSchema> | null> {
  if (profile.outcome === 'INVOKED_COUNSEL') return null;

  const data = await generateValidated(
    apiKey,
    model,
    'InterrogationGen',
    INTERROGATION_GEN_SYSTEM,
    (feedback) => buildInterrogationGenContents(defendant, profile, feedback),
    INTERROGATION_GEN_GEMINI_SCHEMA,
    InterrogationGenSchema,
  );

  // Belt-and-suspenders: the echo fields must exactly match the derived
  // profile regardless of how faithfully the model copied them.
  return {
    ...data.interrogation,
    outcome: profile.outcome,
    challengeGround: profile.challengeGround,
  };
}

// ============================================================================
// Stage 5 — EvidenceGen
// ============================================================================
// Gemini's structured-output mode materializes an optional-nullable field
// (interrogation is marked `nullable: true` in the schema below, since
// there's no way to express "omit this field" in Gemini's response schema)
// as an explicit `null` on every item that doesn't have one — but
// EvidenceSchema's `interrogation` is optional (undefined), not nullable.
// Normalize null → undefined before the real schema validates it.
function dropNullInterrogation(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((item) => {
    if (item !== null && typeof item === 'object' && 'interrogation' in item && item.interrogation === null) {
      const rest = { ...(item as Record<string, unknown>) };
      delete rest.interrogation;
      return rest;
    }
    return item;
  });
}

// Prompt text alone doesn't guarantee the model actually includes (or
// omits) the INTERROGATION exhibit as instructed — a schema-valid response
// with zero INTERROGATION items is easy to produce (evidence.length >= 3 is
// satisfied by ordinary exhibits alone), and courtroomScript would then
// silently skip the tape playback with no error, even though the derived
// profile said an interview transcript exists. Enforcing presence/absence
// here feeds a retry, the same way any other validation failure does,
// instead of letting the mismatch through unnoticed.
function buildEvidenceGenSchema(interrogationRequired: boolean) {
  return z
    .object({
      evidence: z.preprocess(dropNullInterrogation, z.array(EvidenceSchema).min(3)),
      witnesses: z.array(WitnessSchema).min(2),
    })
    .superRefine((data, ctx) => {
      const hasInterrogation = data.evidence.some((item) => item.type === 'INTERROGATION');
      if (interrogationRequired && !hasInterrogation) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'evidence must include exactly one item with type "INTERROGATION" dramatizing the given interrogation transcript, but none was found',
        });
      }
      if (!interrogationRequired && hasInterrogation) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'evidence must not include any item with type "INTERROGATION" — no usable tape exists for this defendant',
        });
      }
    });
}

const EVIDENCE_GEN_GEMINI_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: {
    evidence: { type: 'array', minItems: 3, items: EVIDENCE_GEMINI_SCHEMA },
    witnesses: { type: 'array', minItems: 2, items: WITNESS_GEMINI_SCHEMA },
  },
  required: ['evidence', 'witnesses'],
};

const EVIDENCE_GEN_SYSTEM = `You are generating the evidence exhibits and witnesses for a California criminal court simulation. Produce at least 3 evidence items and at least 2 witnesses. Each evidence item's targetElementId must reference one of the given valid element ids, or be null. Every id must be unique across evidence and witnesses. This is a bench trial: the judge alone rules on every objection and decides every verdict. There is no jury. Never write dialogue that refers to a jury, jurors, or "the jury" deciding or hearing anything — parties argue to the court.`;

function buildEvidenceGenContents(
  charges: Charge[],
  environment: Environment,
  defendant: Defendant,
  interrogation: z.infer<typeof InterrogationSchema> | null,
  feedback: string | undefined,
): string {
  const elementIds = charges.flatMap((c) => c.elements.map((e) => e.id));
  const base = [
    `Charges: ${charges.map((c) => c.name).join(', ')}.`,
    `Valid element ids: ${elementIds.join(', ')}.`,
    `Environment: ${environment.description}`,
    `Defendant: ${defendant.firstName} ${defendant.lastName}.`,
    'Produce at least 3 evidence items and at least 2 witnesses — the response is rejected if either count falls short.',
    interrogation !== null
      ? `Include exactly one evidence item with type "INTERROGATION". Its interrogation field must be exactly this JSON object (do not alter it): ${JSON.stringify(interrogation)}. Its defenseObjection must not be null.`
      : 'Do not include any evidence item with type "INTERROGATION" — no usable tape exists for this defendant.',
  ].join('\n');
  return feedback ? `${base}\n\n${feedback}` : base;
}

export async function runEvidenceGen(
  apiKey: string,
  model: string,
  charges: Charge[],
  environment: Environment,
  defendant: Defendant,
  interrogation: z.infer<typeof InterrogationSchema> | null,
): Promise<{ evidence: Evidence[]; witnesses: Witness[] }> {
  const data = await generateValidated(
    apiKey,
    model,
    'EvidenceGen',
    EVIDENCE_GEN_SYSTEM,
    (feedback) => buildEvidenceGenContents(charges, environment, defendant, interrogation, feedback),
    EVIDENCE_GEN_GEMINI_SCHEMA,
    buildEvidenceGenSchema(interrogation !== null),
  );

  // Force the echo fields on the interrogation exhibit (if any) to match the
  // derived profile exactly, the same way runInterrogationGen does — the
  // model's copy-fidelity is best-effort, this guarantee is not.
  if (interrogation === null) return data;
  const evidence = data.evidence.map((item) =>
    item.type === 'INTERROGATION' && item.interrogation !== undefined
      ? { ...item, interrogation: { ...item.interrogation, outcome: interrogation.outcome, challengeGround: interrogation.challengeGround } }
      : item,
  );
  return { evidence, witnesses: data.witnesses };
}

// ============================================================================
// Stage 6 — finalizeCasePayload (final assembly + cross-stage refinements)
// ============================================================================
const CaseFinalizationFieldsSchema = z.object({
  caseId: z.string().regex(/^[0-9]{2}-CR-[0-9]{5}$/),
  summary: z.string().min(1).max(1500),
  statementOfFacts: z.string().min(1).max(1500),
  closingArguments: z.object({
    prosecution: z.string().min(1).max(1200),
    defense: z.string().min(1).max(1200),
  }),
});

const FINALIZE_GEMINI_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: {
    caseId: { type: 'string', description: 'Format YY-CR-XXXXX, e.g. 24-CR-00042', pattern: '^[0-9]{2}-CR-[0-9]{5}$' },
    summary: { type: 'string', minLength: 1, maxLength: 1500 },
    statementOfFacts: { type: 'string', minLength: 1, maxLength: 1500 },
    closingArguments: {
      type: 'object',
      properties: { prosecution: { type: 'string', minLength: 1, maxLength: 1200 }, defense: { type: 'string', minLength: 1, maxLength: 1200 } },
      required: ['prosecution', 'defense'],
    },
  },
  required: ['caseId', 'summary', 'statementOfFacts', 'closingArguments'],
};

const FULL_CASE_GEMINI_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: {
    caseId: { type: 'string', pattern: '^[0-9]{2}-CR-[0-9]{5}$' },
    defendant: CHARACTER_GEMINI_SCHEMA,
    environment: ENVIRONMENT_GEMINI_SCHEMA,
    charges: { type: 'array', minItems: 1, items: CHARGE_GEMINI_SCHEMA },
    statuteContexts: { type: 'array', minItems: 1, items: { type: 'string', maxLength: 500 } },
    witnesses: { type: 'array', minItems: 2, items: WITNESS_GEMINI_SCHEMA },
    evidence: { type: 'array', minItems: 3, items: EVIDENCE_GEMINI_SCHEMA },
    summary: { type: 'string', minLength: 1, maxLength: 1500 },
    statementOfFacts: { type: 'string', minLength: 1, maxLength: 1500 },
    closingArguments: {
      type: 'object',
      properties: { prosecution: { type: 'string', minLength: 1, maxLength: 1200 }, defense: { type: 'string', minLength: 1, maxLength: 1200 } },
      required: ['prosecution', 'defense'],
    },
  },
  required: [
    'caseId',
    'defendant',
    'environment',
    'charges',
    'statuteContexts',
    'witnesses',
    'evidence',
    'summary',
    'statementOfFacts',
    'closingArguments',
  ],
};

const FINALIZE_SYSTEM = `You are assembling the final narrative fields of a California criminal case file: a case number, a dry allegations-only docket summary, the People's in-character statement of facts, and both sides' closing arguments. No editorializing in the summary; the statementOfFacts and closingArguments are voiced, in-character. This is a bench trial: the judge alone decides the verdict. There is no jury — closing arguments are addressed to the court, never to a jury.`;

function buildFinalizeContents(parts: FinalizeParts, feedback: string | undefined): string {
  const base = `Charges: ${parts.charges.map((c) => c.name).join(', ')}. Defendant: ${parts.defendant.firstName} ${parts.defendant.lastName}. Environment: ${parts.environment.description}`;
  return feedback ? `${base}\n\n${feedback}` : base;
}

const REPAIR_SYSTEM = `You are repairing a California criminal case file JSON object that failed schema validation. You will be given the full object and the list of validation issues. Return a complete, corrected JSON object with the same overall shape, fixing every listed issue. This is a bench trial: the judge alone decides every verdict. There is no jury — if any listed issue is about a jury/juror reference, remove it; no field anywhere in the object should mention a jury.`;

function buildRepairContents(assembled: unknown, issues: z.ZodError, feedback: string | undefined): string {
  const issueList = issues.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n');
  const base = `Object:\n${JSON.stringify(assembled)}\n\nValidation issues:\n${issueList}`;
  return feedback ? `${base}\n\n${feedback}` : base;
}

interface FinalizeParts {
  charges: Charge[];
  statuteContexts: string[];
  environment: Environment;
  defendant: Defendant;
  witnesses: Witness[];
  evidence: Evidence[];
}

export async function finalizeCasePayload(apiKey: string, model: string, parts: FinalizeParts): Promise<CasePayload> {
  const finalFields = await generateValidated(
    apiKey,
    model,
    'FinalizeCasePayload',
    FINALIZE_SYSTEM,
    (feedback) => buildFinalizeContents(parts, feedback),
    FINALIZE_GEMINI_SCHEMA,
    CaseFinalizationFieldsSchema,
  );

  const assembled = {
    caseId: finalFields.caseId,
    defendant: parts.defendant,
    environment: parts.environment,
    charges: parts.charges,
    statuteContexts: parts.statuteContexts,
    witnesses: parts.witnesses,
    evidence: parts.evidence,
    summary: finalFields.summary,
    statementOfFacts: finalFields.statementOfFacts,
    closingArguments: finalFields.closingArguments,
  };

  const initial = CaseSchema.safeParse(assembled);
  if (initial.success) return initial.data;

  // The repair round re-generates the whole case from scratch, so its raw
  // evidence array needs the same null→undefined normalization as EvidenceGen.
  const RepairCaseSchema = z.preprocess((value) => {
    if (value === null || typeof value !== 'object' || !('evidence' in value)) return value;
    const obj = value as Record<string, unknown>;
    return { ...obj, evidence: dropNullInterrogation(obj.evidence) };
  }, CaseSchema);

  return generateValidated(
    apiKey,
    model,
    'FinalizeCasePayload.repair',
    REPAIR_SYSTEM,
    (feedback) => buildRepairContents(assembled, initial.error, feedback),
    FULL_CASE_GEMINI_SCHEMA,
    RepairCaseSchema,
    2,
  );
}

// ============================================================================
// Stage 7 — PleaNarrative (band-scoped: WEAK omits the offer-only fields the
// authored demo cases also omit for NO_OFFER cases; defineDemoCase's pairing
// invariant is mirrored here rather than re-derived).
// ============================================================================
const WeakPleaNarrativeSchema = z.object({
  prosecutionRationale: z.string().min(1).max(1000),
});

const OfferPleaNarrativeSchema = z
  .object({
    prosecutionRationale: z.string().min(1).max(1000),
    defenseRationale: z.string().min(1).max(1000),
    allocution: z.string().min(1).max(800),
    pleaReactions: z.object({ ACCEPT: ReactionBeatSchema, REJECT: ReactionBeatSchema }),
    pleaRulingOptions: z
      .array(z.object({ choice: PleaDecisionSchema, lineText: z.string().min(1).max(300) }))
      .min(2)
      .max(6),
  })
  .superRefine((narrative, ctx) => {
    const missing = requireChoiceCoverage(narrative.pleaRulingOptions, PleaDecisionSchema.options);
    if (missing !== null) ctx.addIssue({ code: z.ZodIssueCode.custom, message: missing });
  });

const WEAK_PLEA_GEMINI_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: { prosecutionRationale: { type: 'string', minLength: 1, maxLength: 1000 } },
  required: ['prosecutionRationale'],
};

const OFFER_PLEA_GEMINI_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: {
    prosecutionRationale: { type: 'string', minLength: 1, maxLength: 1000 },
    defenseRationale: { type: 'string', minLength: 1, maxLength: 1000 },
    allocution: { type: 'string', minLength: 1, maxLength: 800 },
    pleaReactions: {
      type: 'object',
      properties: { ACCEPT: reactionBeatGeminiSchema(), REJECT: reactionBeatGeminiSchema() },
      required: ['ACCEPT', 'REJECT'],
    },
    pleaRulingOptions: judgeLineOptionsGeminiSchema(['ACCEPT', 'REJECT']),
  },
  required: ['prosecutionRationale', 'defenseRationale', 'allocution', 'pleaReactions', 'pleaRulingOptions'],
};

const PLEA_NARRATIVE_SYSTEM = `You are writing the plea-negotiation narrative for a California criminal court simulation, spoken on the record by each party — never privileged strategy or internal deliberation. This is a bench trial: if the case goes to trial, the judge alone hears it and decides the verdict. There is no jury — never write a party asking for, wanting, or referencing a jury trial.`;

function buildPleaNarrativeContents(payload: CasePayload, feedback: string | undefined): string {
  const base = `Case: ${payload.charges.map((c) => c.name).join(', ')}. Defendant: ${payload.defendant.firstName} ${payload.defendant.lastName}.`;
  return feedback ? `${base}\n\n${feedback}` : base;
}

export async function runPleaNarrative(
  apiKey: string,
  model: string,
  payload: CasePayload,
  band: 'WEAK' | 'MODERATE' | 'STRONG',
): Promise<PleaNarrative> {
  if (band === 'WEAK') {
    const data = await generateValidated(
      apiKey,
      model,
      'PleaNarrative.weak',
      PLEA_NARRATIVE_SYSTEM,
      (feedback) => buildPleaNarrativeContents(payload, feedback),
      WEAK_PLEA_GEMINI_SCHEMA,
      WeakPleaNarrativeSchema,
    );
    return PleaNarrativeSchema.parse({ prosecutionRationale: data.prosecutionRationale });
  }

  const data = await generateValidated(
    apiKey,
    model,
    'PleaNarrative.offer',
    PLEA_NARRATIVE_SYSTEM,
    (feedback) => buildPleaNarrativeContents(payload, feedback),
    OFFER_PLEA_GEMINI_SCHEMA,
    OfferPleaNarrativeSchema,
  );
  return PleaNarrativeSchema.parse({
    prosecutionRationale: data.prosecutionRationale,
    defenseRationale: data.defenseRationale,
    allocution: data.allocution,
    pleaReactions: data.pleaReactions,
    pleaRulingOptions: data.pleaRulingOptions,
  });
}

// ============================================================================
// Stage 8 — Aftermath (post-sentencing narrative)
// ============================================================================
const AftermathFieldSchema = z.object({ narrative: AftermathNarrativeSchema });

const AFTERMATH_GEMINI_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: { narrative: { type: 'string', minLength: 1, maxLength: 4000 } },
  required: ['narrative'],
};

const AFTERMATH_SYSTEM = `You are writing the aftermath narrative for a California criminal court simulation: public reaction, consequences, and press coverage conditioned on how the case actually resolved. 1-4000 characters. This is a bench trial: the judge alone decided the verdict. There is no jury — press coverage and public reaction should never reference a jury or jury trial.`;

function buildAftermathContents(ctx: AftermathContext, feedback: string | undefined): string {
  const base = [
    `Case: ${ctx.caseData.charges.map((c) => c.name).join(', ')}.`,
    `Defendant: ${ctx.caseData.defendant.firstName} ${ctx.caseData.defendant.lastName}.`,
    ctx.pleaDecision !== null ? `Plea decision: ${ctx.pleaDecision}.` : 'Resolved by trial.',
    ctx.verdict !== null ? `Verdict: ${ctx.verdict.map((v) => `${v.chargeName}: ${v.verdict}`).join('; ')}.` : '',
    `Imposed sentence: ${JSON.stringify(ctx.imposedSentence)}.`,
  ].join('\n');
  return feedback ? `${base}\n\n${feedback}` : base;
}

export async function runAftermath(apiKey: string, model: string, ctx: AftermathContext): Promise<string> {
  const data = await generateValidated(
    apiKey,
    model,
    'Aftermath',
    AFTERMATH_SYSTEM,
    (feedback) => buildAftermathContents(ctx, feedback),
    AFTERMATH_GEMINI_SCHEMA,
    AftermathFieldSchema,
  );
  return data.narrative;
}
