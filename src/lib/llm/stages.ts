import { z } from 'zod';
import {
  ChargeCoreSchema,
  EnvironmentSchema,
  CharacterSchema,
  WitnessSchema,
  EvidenceSchema,
  InterrogationSchema,
  ReactionBeatSchema,
  PleaDecisionSchema,
  VerdictValueSchema,
  // Vocabularies shared with the Gemini responseSchemas below. Every `enum:`
  // in this file spreads one of these rather than restating its members, so
  // the model is told exactly what the Zod trust boundary will enforce.
  // schemaParity.test.ts fails if the two ever drift apart.
  SentenceTypeEnum,
  SentenceUnitEnum,
  ProbationConditionEnum,
  ChargeClassificationEnum,
  ObjectionRiskEnum,
  EvidenceTypeEnum,
  WitnessRoleEnum,
  BiasIndicatorEnum,
  ReactionSpeakerEnum,
  InterrogationSpeakerEnum,
  InterrogationOutcomeEnum,
  ChallengeGroundEnum,
  SubstanceStatusEnum,
  RelationshipStatusEnum,
  EmploymentStatusEnum,
  EducationLevelEnum,
  LocationTypeEnum,
  TimeOfDayEnum,
  WeatherEnum,
  PleaNarrativeSchema,
  CaseSchema,
  AftermathNarrativeSchema,
  type Charge,
  type ChargeCore,
  type Environment,
  type PleaNarrative,
  type CasePayload,
  type Sentence,
} from '../../schemas/gameSchemas';
import type { InterrogationProfile } from '../interrogation';
import type { AftermathContext } from '../caseSource';
import { callGemini, GeminiError, type GeminiSchema } from './geminiClient';
import { reportAttemptFailure } from './generationObserver';
import { reconcileCrossStageIds } from './reconcileCase';

export class GameServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GameServiceError';
  }
}

type Defendant = CasePayload['defendant'];
type Evidence = CasePayload['evidence'][number];
type Witness = CasePayload['witnesses'][number];

// A retry only works if the model can see what it got wrong. Feeding back
// the Zod issues alone ("evidence.0.relevanceScore: Invalid input") asks the
// model to correct an object it is no longer holding — so it regenerates from
// scratch and re-rolls the same odds. That is how a reported mistrial burned
// all three attempts on the identical field three times running.
//
// Pairing the issues with the response that produced them turns the retry
// into what it was always meant to be: a repair. Phrased as a task rather
// than an accusation, and naming the corrected object as the deliverable, for
// the same reason — the model needs a target to hit, not a verdict.
const MAX_ECHOED_RESPONSE_CHARS = 60_000;

function buildRetryFeedback(issues: string[], previousResponse: string): string {
  const echoed = previousResponse.length > MAX_ECHOED_RESPONSE_CHARS
    ? `${previousResponse.slice(0, MAX_ECHOED_RESPONSE_CHARS)}\n...[truncated]`
    : previousResponse;
  return [
    'Return the same JSON object again with only these fields corrected:',
    ...issues.map((issue) => `- ${issue}`),
    '',
    'Everything else in the object was accepted — keep it as it is. Your previous response was:',
    echoed,
  ].join('\n');
}

// Every stage's contents builder ends the same way: the stage's own prompt on
// a first attempt, that prompt plus the repair feedback on a retry. The
// feedback is appended rather than substituted so the retry still carries the
// original task — a repair prompt with no statement of the job is a request to
// fix an object with no idea what it was for.
function withFeedback(base: string, feedback: string | undefined): string {
  return feedback ? `${base}\n\n${feedback}` : base;
}

// ============================================================================
// Generic "generate, parse, validate, retry-with-repair" loop shared by every
// pipeline stage. Gemini's structured-output mode shapes the response; the
// Zod schema is the real trust boundary — the same one hand-authored demo
// cases cross. A validation failure feeds the Zod issues *and the failed
// response* back into the next prompt, up to `maxRetries` extra attempts.
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
  // The raw text of the most recent Gemini response that failed to validate.
  // Echoed (capped) in the terminal GameServiceError so the error carries not
  // just *what* Zod rejected but *what the model actually returned* — the
  // difference between "interrogation: Invalid input" (cryptic) and
  // "interrogation: Invalid input ... Last response: {detectiveName,...}"
  // (obvious: the schema was unwrapped).
  let lastRawResponse: string | null = null;

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
        // Tagged with the stage on the way out. A bare "status 400: Request
        // contains an invalid argument" names none of the seven response
        // schemas the API might have rejected — which is exactly what made a
        // malformed schema undebuggable from the player's Mistrial screen,
        // and cost a live bisection to work out. The GeminiError type and
        // status are preserved so callers still classify it the same way.
        reportAttemptFailure({ stage: stageName, attempt, kind: 'CALL_FAILED', issues: [err.message], schemaShape: null });
        throw new GeminiError(`[${stageName}] ${err.message}`, err.status);
      }
      lastError = `Gemini call failed: ${err instanceof Error ? err.message : String(err)}`;
      reportAttemptFailure({ stage: stageName, attempt, kind: 'CALL_FAILED', issues: [lastError], schemaShape: null });
      continue;
    }

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (err) {
      lastError = `Response was not valid JSON: ${String(err)}`;
      reportAttemptFailure({ stage: stageName, attempt, kind: 'BAD_JSON', issues: [lastError], schemaShape: schemaShape(responseSchema) });
      feedback = buildRetryFeedback([lastError], text);
      continue;
    }

    const result = zodSchema.safeParse(raw);
    if (result.success) return result.data;

    const issues = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    reportAttemptFailure({ stage: stageName, attempt, kind: 'SCHEMA', issues, schemaShape: schemaShape(responseSchema) });
    lastError = issues.join('; ');
    lastRawResponse = text;
    feedback = buildRetryFeedback(issues, text);
  }

  // The stage name is what actually makes this actionable in
  // console.error/lastGenerationError.message — a pipeline runs 6+ of these,
  // and "Failed to produce valid output" alone doesn't say which one.
  //
  // The raw response echo is the single highest-value diagnostic: the joined
  // Zod issues say *what* Zod rejected, but not *what the model actually
  // returned* that triggered the rejection. The InterrogationGen unwrapped-
  // schema bug produced `interrogation: Invalid input: expected object,
  // received undefined` three times — accurate but cryptic until you saw that
  // the model returned `{detectiveName, outcome, ...}` (no `interrogation`
  // wrapper), at which point the cause is obvious. Cap the echo so a runaway
  // EvidenceGen response doesn't blow the message.
  const echoed = lastRawResponse === null
    ? ''
    : `\nLast response (truncated): ${lastRawResponse.length > MAX_ECHOED_RESPONSE_CHARS ? `${lastRawResponse.slice(0, MAX_ECHOED_RESPONSE_CHARS)}...[truncated]` : lastRawResponse}`;
  throw new GameServiceError(`[${stageName}] Failed to produce valid output after ${maxRetries + 1} attempt(s): ${lastError}${echoed}`);
}

function requireChoiceCoverage(options: { choice: string }[], allChoices: readonly string[]): string | null {
  const missing = allChoices.filter((choice) => !options.some((o) => o.choice === choice));
  return missing.length > 0 ? `Missing judge-line coverage for: ${missing.join(', ')}` : null;
}

// Top-level property names of a Gemini responseSchema, when it's an object —
// null otherwise. Recorded on every failed attempt so the live diagnostic
// report can surface a wrapped-vs-unwrapped schema divergence (the exact shape
// of bug that made InterrogationGen send `{detectiveName, outcome, ...}` when
// Zod expected `{interrogation: {...}}`) without a live bisection.
function schemaShape(schema: GeminiSchema): string[] | null {
  if (schema.type !== 'object') return null;
  return schema.properties ? Object.keys(schema.properties) : [];
}

// ============================================================================
// Hand-written Gemini responseSchema building blocks (a constrained subset of
// OpenAPI Schema). These shape the model's output; Zod schemas above are the
// actual validation gate, so these only need to be close enough to get
// mostly-valid JSON on the first try.
// ============================================================================
export const SENTENCE_GEMINI_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: [...SentenceTypeEnum.options] },
    // Flattened on purpose — Gemini's dialect has no discriminated union, so
    // the model sees every unit and Zod correlates it to the type on the way in.
    unit: { type: 'string', enum: [...SentenceUnitEnum.options] },
    amount: { type: 'integer', minimum: 1 },
    conditions: {
      type: 'array',
      items: {
        type: 'string',
        enum: [...ProbationConditionEnum.options],
      },
    },
  },
  required: ['type', 'unit', 'amount'],
};

// A stage whose response is one named field wraps its payload schema here.
// The wrapping is not cosmetic: a stage that passes the *inner* shape by
// mistake gets a response Zod rejects with a message that names the field as
// missing rather than the mistake as unwrapping — which is exactly how the
// InterrogationGen bug below survived, since the unit-test mock returned the
// wrapped shape and only the live API disagreed.
function geminiObjectOf(field: string, schema: GeminiSchema): GeminiSchema {
  return { type: 'object', properties: { [field]: schema }, required: [field] };
}

function reactionBeatGeminiSchema(): GeminiSchema {
  return {
    type: 'array',
    minItems: 1,
    maxItems: 4,
    items: {
      type: 'object',
      properties: {
        speaker: { type: 'string', enum: [...ReactionSpeakerEnum.options] },
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

export const CHARGE_CORE_GEMINI_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', minLength: 1, maxLength: 40 },
    name: { type: 'string', minLength: 1, maxLength: 200 },
    classification: { type: 'string', enum: [...ChargeClassificationEnum.options] },
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
  },
  required: ['id', 'name', 'classification', 'elements', 'mandatoryMinimums', 'maximumPenalties'],
};

export const CHARGE_GEMINI_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: {
    ...CHARGE_CORE_GEMINI_SCHEMA.properties,
    verdictReactions: {
      type: 'object',
      properties: { GUILTY: reactionBeatGeminiSchema(), NOT_GUILTY: reactionBeatGeminiSchema() },
      required: ['GUILTY', 'NOT_GUILTY'],
    },
    verdictOptions: judgeLineOptionsGeminiSchema(['GUILTY', 'NOT_GUILTY']),
  },
  required: [
    ...(CHARGE_CORE_GEMINI_SCHEMA.required ?? []),
    'verdictReactions',
    'verdictOptions',
  ],
};

const VERDICT_VOICE_GEMINI_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: {
    charges: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', minLength: 1, maxLength: 40 },
          verdictReactions: {
            type: 'object',
            properties: { GUILTY: reactionBeatGeminiSchema(), NOT_GUILTY: reactionBeatGeminiSchema() },
            required: ['GUILTY', 'NOT_GUILTY'],
          },
          verdictOptions: judgeLineOptionsGeminiSchema(['GUILTY', 'NOT_GUILTY']),
        },
        required: ['id', 'verdictReactions', 'verdictOptions'],
      },
    },
  },
  required: ['charges'],
};

export const ENVIRONMENT_GEMINI_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: {
    locationType: { type: 'string', enum: [...LocationTypeEnum.options] },
    timeOfDay: { type: 'string', enum: [...TimeOfDayEnum.options] },
    weather: { type: 'string', enum: [...WeatherEnum.options] },
    description: { type: 'string', maxLength: 500 },
    establishedFacts: {
      type: 'array',
      minItems: 1,
      maxItems: 6,
      items: { type: 'string', minLength: 1, maxLength: 200 },
    },
    interrogationLocation: { type: 'string', minLength: 1, maxLength: 200 },
  },
  required: ['locationType', 'timeOfDay', 'weather', 'description', 'establishedFacts', 'interrogationLocation'],
};

export const CHARACTER_GEMINI_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: {
    firstName: { type: 'string', maxLength: 50 },
    lastName: { type: 'string', maxLength: 50 },
    age: { type: 'integer', minimum: 18, maximum: 120 },
    demographics: {
      type: 'object',
      properties: {
        relationshipStatus: { type: 'string', enum: [...RelationshipStatusEnum.options] },
        children: { type: 'integer', minimum: 0, maximum: 30 },
        employmentStatus: { type: 'string', enum: [...EmploymentStatusEnum.options] },
        educationLevel: {
          type: 'string',
          enum: [...EducationLevelEnum.options],
        },
        substanceAbuseHistory: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              substance: { type: 'string', maxLength: 100 },
              status: { type: 'string', enum: [...SubstanceStatusEnum.options] },
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

export const INTERROGATION_GEMINI_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: {
    detectiveName: { type: 'string', minLength: 1, maxLength: 101 },
    outcome: { type: 'string', enum: [...InterrogationOutcomeEnum.options] },
    challengeGround: { type: 'string', enum: [...ChallengeGroundEnum.options] },
    lines: {
      type: 'array',
      minItems: 4,
      maxItems: 24,
      items: {
        type: 'object',
        properties: {
          speaker: { type: 'string', enum: [...InterrogationSpeakerEnum.options] },
          text: { type: 'string', minLength: 1, maxLength: 400 },
        },
        required: ['speaker', 'text'],
      },
    },
  },
  required: ['detectiveName', 'outcome', 'challengeGround', 'lines'],
};

export const WITNESS_GEMINI_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', minLength: 1, maxLength: 40 },
    name: { type: 'string', maxLength: 101 },
    role: { type: 'string', enum: [...WitnessRoleEnum.options] },
    bias: { type: 'string', enum: [...BiasIndicatorEnum.options] },
    statement: { type: 'string', maxLength: 1000 },
    credibilityScore: {
      type: 'integer',
      minimum: 1,
      maximum: 10,
      description: 'How credible this witness is, as a whole number from 1 (least) to 10 (most). Never a 0-1 probability.',
    },
    directExamination: {
      type: 'string',
      minLength: 1,
      maxLength: 1200,
      description: 'The witness\'s spoken testimony on direct examination, in the first person, as a continuous narrative the witness would deliver from the stand. Do not include counsel\'s questions.'
    },
    crossExamination: { type: 'string', maxLength: 1200, nullable: true, description: 'The witness\'s spoken testimony under cross-examination, in the first person, as a continuous narrative. Do not include counsel\'s questions.' },
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

export const EVIDENCE_GEMINI_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', minLength: 1, maxLength: 40 },
    name: { type: 'string', minLength: 3, maxLength: 100 },
    type: {
      type: 'string',
      enum: [...EvidenceTypeEnum.options],
    },
    description: { type: 'string', maxLength: 600 },
    disclosureSummary: { type: 'string', minLength: 1, maxLength: 400 },
    relevanceScore: {
      type: 'integer',
      minimum: 1,
      maximum: 10,
      description: 'How much this exhibit matters to the case, as a whole number from 1 (least) to 10 (most). Never a 0-1 probability.',
    },
    objectionRisk: { type: 'string', enum: [...ObjectionRiskEnum.options] },
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
  charges: z.array(ChargeCoreSchema).min(1),
  statuteContexts: z.array(z.string().max(500)).min(1),
});

const STATUTE_SELECTION_GEMINI_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: {
    charges: { type: 'array', minItems: 1, items: CHARGE_CORE_GEMINI_SCHEMA },
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
// ============================================================================
// Stage prompts.
//
// Every prompt below follows one shape — ROLE, TASK, RULES, and where a rule
// is easier shown than said, EXAMPLE — and every rule is written as the thing
// to do rather than the thing to avoid. That is not a style preference. A
// prohibition ("never mention a jury") tells the model what not to write and
// leaves it to guess the rest; naming the behaviour ("parties address the
// court directly — 'Your Honor'") gives it something to produce. The rules
// that used to live only in Zod refinements — choice coverage, the
// objection/risk pairing, minimum-under-matching-maximum — are stated here
// too, because a constraint the model is never told is a constraint it can
// only satisfy by luck.
// ============================================================================

// The single most important fact about this courtroom, stated as behaviour.
const BENCH_TRIAL_RULE = `This is a bench trial. The judge alone rules on every objection and decides every verdict. Parties address the court directly — "Your Honor", "the Court" — and ask the court to find, hold, or rule. Never reference a jury, jurors, or a jury trial — there is none in this courtroom.`;

// A worked pair teaches the conditions rule in two lines where the previous
// prose spent forty words on it: `conditions` rides with PROBATION and
// nothing else.
const SENTENCE_SHAPE = `A sentence object carries "type", "unit", and a positive whole-number "amount". A PROBATION sentence also carries "conditions" with at least one entry; the other types carry no "conditions" key at all. Two valid sentences:
{"type":"PROBATION","unit":"YEARS","amount":3,"conditions":["RANDOM_DRUG_TESTING"]}
{"type":"PRISON","unit":"YEARS","amount":5}`;

const STATUTE_SELECTION_SYSTEM = `ROLE: You are a California deputy district attorney drafting the charging document for a criminal case.

TASK: Invent one or more realistic charges under California law. Give each charge its elements and statutory sentencing range. Do not write verdict reactions or verdict lines — those are authored in a later stage once the defendant exists.

RULES:
1. Give every charge and every element an id that is unique across the whole case.
2. Match each mandatory minimum with a maximum penalty of the same "type" that is at least as large. A charge whose minimum is 180 DAYS of JAIL needs a JAIL maximum as well, even when it also carries a PRISON maximum.
3. Keep charge names and element descriptions factual; do not name or anticipate the defendant, who does not exist yet.
4. Use fictional names throughout.
5. ${BENCH_TRIAL_RULE}

EXAMPLE: ${SENTENCE_SHAPE}`;

function buildStatuteSelectionContents(feedback: string | undefined): string {
  const base = 'Generate the charges and statuteContexts for a new case.';
  return withFeedback(base, feedback);
}

export async function runStatuteSelection(
  apiKey: string,
  model: string,
): Promise<{ charges: ChargeCore[]; statuteContexts: string[] }> {
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

const ENVIRONMENT_GEN_GEMINI_SCHEMA = geminiObjectOf('environment', ENVIRONMENT_GEMINI_SCHEMA);

const ENVIRONMENT_GEN_SYSTEM = `ROLE: You are an investigator recording the scene of an alleged offense for a California criminal case.

TASK: Give the location type, the time of day, the weather, a description of where and when the offense is alleged to have happened, a short list of established facts about the scene, and where a custodial interrogation of the defendant would take place.

RULES:
1. Keep the description under 500 characters and concrete — the physical detail an investigator would put in a report.
2. Choose "N/A" for weather when the scene is indoors or digital.
3. Write "establishedFacts" as 3-6 short, standalone statements of fact about the scene (e.g. "the rear service door was found unlocked", "the store's alarm system had been disarmed before entry was made"). Other writers on this case will quote these facts directly in witness statements, testimony, and argument — state each one once, precisely, so nothing downstream has to guess or re-derive it.
4. Write "interrogationLocation" as a real-sounding police facility — a station, precinct house, or sheriff's substation and its interview room — and never the offense address itself. A custodial interrogation happens at a police facility, not at the scene of the alleged offense.`;

function buildEnvironmentGenContents(charges: ChargeCore[], feedback: string | undefined): string {
  const base = `Generate the environment for a case involving these charges: ${charges.map((c) => c.name).join(', ')}.`;
  return withFeedback(base, feedback);
}

export async function runEnvironmentGen(apiKey: string, model: string, charges: ChargeCore[]): Promise<Environment> {
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

const CHARACTER_GEN_GEMINI_SCHEMA = geminiObjectOf('defendant', CHARACTER_GEMINI_SCHEMA);

const CHARACTER_GEN_SYSTEM = `ROLE: You are a probation officer compiling the defendant's background for a California criminal case.

TASK: Produce one fictional defendant: demographics, criminal history, and the five OCEAN personality traits (openness, conscientiousness, extraversion, agreeableness, neuroticism).

RULES:
1. Score each OCEAN trait as a whole number from 1 to 10. The traits drive the defendant's behaviour behind the scenes; keep the numbers in these fields and describe the person in words everywhere else.
2. Give the defendant an age between 18 and 120, and date each past conviction between 1900 and the present year.
3. Build a fictional identity — name, history, and circumstances all invented.
4. Each past conviction's sentences follow the sentence shape below.

EXAMPLE: ${SENTENCE_SHAPE}`;

function buildCharacterGenContents(charges: ChargeCore[], feedback: string | undefined): string {
  const base = `Generate the defendant for a case involving these charges: ${charges.map((c) => c.name).join(', ')}.`;
  return withFeedback(base, feedback);
}

export async function runCharacterGen(apiKey: string, model: string, charges: ChargeCore[]): Promise<Defendant> {
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

// The Gemini responseSchema must mirror the Zod wrapper — a top-level
// `interrogation` object, not the inner shape directly. INTERROGATION_GEMINI_SCHEMA
// alone is the unwrapped shape reused as the nested `interrogation` field on
// EVIDENCE_GEMINI_SCHEMA (line 422), where it is correct; passing it un-wrapped
// here made the live API return `{ detectiveName, outcome, ... }` and Zod reject
// it with `interrogation: Invalid input` — every other stage wraps correctly,
// the unit-test mock returned the wrapped shape so the divergence was invisible
// until a live run.
const INTERROGATION_GEN_GEMINI_SCHEMA = geminiObjectOf('interrogation', INTERROGATION_GEMINI_SCHEMA);

const INTERROGATION_GEN_SYSTEM = `ROLE: You are dramatizing a recorded police custodial interrogation for a California criminal case.

TASK: Write the interview transcript — 4 to 24 lines, alternating naturally between the detective and the defendant.

RULES:
1. Dramatize exactly the outcome you are given, and echo that "outcome" and "challengeGround" back unchanged. What the interview produced, and the ground the defense will attack it on, are already decided; your job is how the room actually sounded.
2. Write spoken dialogue — the detective's questions and the defendant's answers, as a tape would capture them.
3. The interview happens at the interrogation location you are given, not at the offense scene — the room, not the alleged crime, is where this dialogue is physically set. The offense scene is background the detective and defendant may discuss, never the setting of the interview itself.
4. When established facts about the offense are given, the detective's questions and the defendant's answers must not contradict them — refer to the same facts, not a different version of events.
5. Keep each line under 400 characters.
6. ${BENCH_TRIAL_RULE}`;

function buildInterrogationGenContents(
  defendant: Defendant,
  environment: Environment,
  profile: Extract<InterrogationProfile, { outcome: 'FULL_CONFESSION' | 'PARTIAL_ADMISSION' | 'DENIAL' }>,
  feedback: string | undefined,
): string {
  const interrogationLocation = environment.interrogationLocation ?? 'a police interview room (no address given — invent a plausible station)';
  const base = [
    `Defendant: ${defendant.firstName} ${defendant.lastName}.`,
    `Interrogation location (set the dialogue here): ${interrogationLocation}`,
    `Offense scene (background only — do not use this as the interrogation's setting): ${environment.description}`,
    environment.establishedFacts !== undefined
      ? `Established facts about the offense (do not contradict these):\n${environment.establishedFacts.map((f) => `- ${f}`).join('\n')}`
      : '',
    `Required outcome: ${profile.outcome}.`,
    `Required challengeGround: ${profile.challengeGround}.`,
  ].filter((line) => line.length > 0).join('\n');
  return withFeedback(base, feedback);
}

export async function runInterrogationGen(
  apiKey: string,
  model: string,
  defendant: Defendant,
  environment: Environment,
  profile: InterrogationProfile,
): Promise<z.infer<typeof InterrogationSchema> | null> {
  if (profile.outcome === 'INVOKED_COUNSEL') return null;

  const data = await generateValidated(
    apiKey,
    model,
    'InterrogationGen',
    INTERROGATION_GEN_SYSTEM,
    (feedback) => buildInterrogationGenContents(defendant, environment, profile, feedback),
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
    // No minItems here, deliberately: Gemini rejects the whole request with a
    // bare 400 INVALID_ARGUMENT when minItems is set on an array whose item
    // schema contains the nullable nested `interrogation` object. Verified by
    // bisection against the live API — the identical schema is accepted with
    // this one constraint removed, and accepted with minItems restored once
    // `interrogation` is dropped from the item. `witnesses` below keeps its
    // minItems (its items have no nested nullable object), as do `charges`,
    // `elements`, and `maximumPenalties`. Zod's `.min(3)` still enforces the
    // count, and EVIDENCE_GEN_SYSTEM states it in the prompt.
    evidence: { type: 'array', items: EVIDENCE_GEMINI_SCHEMA },
    witnesses: { type: 'array', minItems: 2, items: WITNESS_GEMINI_SCHEMA },
  },
  required: ['evidence', 'witnesses'],
};

const EVIDENCE_GEN_SYSTEM = `ROLE: You are building the exhibit and witness list for a California criminal case, together with the voiced material the motion hearing and the trial will use.

TASK: Produce at least 3 evidence exhibits and at least 2 witnesses.

RULES:
1. Score "relevanceScore" and "credibilityScore" as whole numbers from 1 to 10, where 10 is the most relevant exhibit or the most credible witness. These are ratings on a 1-to-10 scale, not probabilities and not fractions.
2. Write a "defenseObjection" for every exhibit whose "objectionRisk" is MEDIUM or HIGH — those are the exhibits the defense fights. Set "defenseObjection" to null only when "objectionRisk" is LOW.
3. Cover both outcomes in every "rulingOptions" array: at least one option with choice "ADMITTED" and at least one with choice "EXCLUDED".
4. Point each exhibit's "targetElementId" at one of the element ids you are given, or set it to null.
5. Give every exhibit and every witness an id unique across the whole case.
6. Write each witness's "directExamination" and "crossExamination" as first-person testimony the witness delivers from the stand, in a continuous narrative. Do not write counsel's questions mixed into the answer — the transcript voices the witness alone.
7. Cross-examination may attack a witness's memory, bias, or interpretation, but must not assert a fact that flatly contradicts what the same witness already stated on direct examination (a different timeline, a different sequence of actions) — unless the direct examination itself sets up that contradiction as a prior inconsistent statement being impeached. A witness's account of what happened stays the same account under cross; only how much the court should trust it is in play.
8. When established facts about the scene are given, every witness statement, disclosure, and testimony must not contradict them — refer to the same facts, not a different version of events.
9. Keep judge lines under 300 characters, disclosure summaries under 400, and each argument, objection, and reaction line under 600.
10. ${BENCH_TRIAL_RULE}`;

function buildEvidenceGenContents(
  charges: ChargeCore[],
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
    environment.establishedFacts !== undefined
      ? `Established facts about the scene (quote or directly reference these; do not restate them in a way that could conflict):\n${environment.establishedFacts.map((f) => `- ${f}`).join('\n')}`
      : '',
    `Defendant: ${defendant.firstName} ${defendant.lastName}.`,
    'Produce at least 3 evidence items and at least 2 witnesses — the response is rejected if either count falls short.',
    interrogation !== null
      ? `Include exactly one evidence item with type "INTERROGATION". Its interrogation field must be exactly this JSON object (do not alter it): ${JSON.stringify(interrogation)}. Its defenseObjection must not be null.`
      : 'Do not include any evidence item with type "INTERROGATION" — no usable tape exists for this defendant.',
  ].filter((line) => line.length > 0).join('\n');
  return withFeedback(base, feedback);
}

export async function runEvidenceGen(
  apiKey: string,
  model: string,
  charges: ChargeCore[],
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
const ClosingExhibitPointFieldSchema = z.object({
  evidenceId: z.string().min(1).max(40),
  ifAdmitted: z.object({ prosecution: z.string().max(400).nullable(), defense: z.string().max(400).nullable() }),
  ifExcluded: z.object({ prosecution: z.string().max(400).nullable(), defense: z.string().max(400).nullable() }),
});

const CaseFinalizationFieldsSchema = z.object({
  caseId: z.string().regex(/^[0-9]{2}-CR-[0-9]{5}$/),
  summary: z.string().min(1).max(1500),
  statementOfFacts: z.string().min(1).max(1500),
  closingArguments: z.object({
    prosecution: z.string().min(1).max(1200),
    defense: z.string().min(1).max(1200),
    exhibitPoints: z.array(ClosingExhibitPointFieldSchema).optional(),
  }),
});

function closingExhibitPointGeminiSchema(): GeminiSchema {
  return {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        evidenceId: { type: 'string', minLength: 1, maxLength: 40 },
        ifAdmitted: {
          type: 'object',
          properties: {
            prosecution: { type: 'string', maxLength: 400, nullable: true },
            defense: { type: 'string', maxLength: 400, nullable: true },
          },
          required: ['prosecution', 'defense'],
        },
        ifExcluded: {
          type: 'object',
          properties: {
            prosecution: { type: 'string', maxLength: 400, nullable: true },
            defense: { type: 'string', maxLength: 400, nullable: true },
          },
          required: ['prosecution', 'defense'],
        },
      },
      required: ['evidenceId', 'ifAdmitted', 'ifExcluded'],
    },
  };
}

const FINALIZE_GEMINI_SCHEMA: GeminiSchema = {
  type: 'object',
  properties: {
    caseId: { type: 'string', description: 'Format YY-CR-XXXXX, e.g. 24-CR-00042', pattern: '^[0-9]{2}-CR-[0-9]{5}$' },
    summary: { type: 'string', minLength: 1, maxLength: 1500 },
    statementOfFacts: { type: 'string', minLength: 1, maxLength: 1500 },
    closingArguments: {
      type: 'object',
      properties: {
        prosecution: { type: 'string', minLength: 1, maxLength: 1200 },
        defense: { type: 'string', minLength: 1, maxLength: 1200 },
        exhibitPoints: closingExhibitPointGeminiSchema(),
      },
      required: ['prosecution', 'defense', 'exhibitPoints'],
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
    // No minItems here, deliberately: Gemini rejects the whole request with a
    // bare 400 INVALID_ARGUMENT when minItems is set on an array whose item
    // schema contains the nullable nested `interrogation` object. Verified by
    // bisection against the live API — the identical schema is accepted with
    // this one constraint removed, and accepted with minItems restored once
    // `interrogation` is dropped from the item. `witnesses` below keeps its
    // minItems (its items have no nested nullable object), as do `charges`,
    // `elements`, and `maximumPenalties`. Zod's `.min(3)` still enforces the
    // count, and EVIDENCE_GEN_SYSTEM states it in the prompt.
    evidence: { type: 'array', items: EVIDENCE_GEMINI_SCHEMA },
    summary: { type: 'string', minLength: 1, maxLength: 1500 },
    statementOfFacts: { type: 'string', minLength: 1, maxLength: 1500 },
    closingArguments: {
      type: 'object',
      properties: {
        prosecution: { type: 'string', minLength: 1, maxLength: 1200 },
        defense: { type: 'string', minLength: 1, maxLength: 1200 },
        exhibitPoints: closingExhibitPointGeminiSchema(),
      },
      required: ['prosecution', 'defense', 'exhibitPoints'],
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

const FINALIZE_SYSTEM = `ROLE: You are assembling the narrative face of a California criminal case file.

TASK: Write the case number, the docket synopsis, the People's statement of facts, both sides' closing arguments, and — for each exhibit — the closing point each side would add about it under each possible motion ruling.

RULES:
1. Format the case number as two digits, "-CR-", then five digits — for example 24-CR-00042.
2. Write "summary" as a dry, allegations-only docket synopsis: what is charged and nothing more, in under 1500 characters. Save every party's framing for the fields below.
3. Write "statementOfFacts" in the prosecutor's own voice, spoken to the court, in under 1500 characters.
4. Write "closingArguments.prosecution" and "closingArguments.defense" as each side's general framing and theory of the case, addressed to the court, in under 1200 characters — do not argue any single exhibit's merits here. Do not invent facts (DNA, surveillance footage, tools, witnesses) that the evidence list does not include.
5. When established facts about the scene are given, the statement of facts and both closings must rest on exactly those facts — refer to the same events, not a different version of them, and do not add scene details beyond them.
6. Write one "exhibitPoints" entry for every exhibit in the case, keyed by its evidenceId. Each entry gives what a side would say about that specific exhibit, split by the ruling it might receive: "ifAdmitted" (the exhibit came into evidence) and "ifExcluded" (the court suppressed it). A side that has nothing to say about an exhibit under a given ruling — most often the People have nothing to say about an exhibit that was excluded — writes null for that field instead of inventing a point. Neither side may argue the merits of an excluded exhibit as if it were still in evidence.
7. ${BENCH_TRIAL_RULE}`;

function buildFinalizeContents(parts: FinalizeParts, feedback: string | undefined): string {
  const evidenceList = parts.evidence
    .map((e) => `- ${e.id}: ${e.type} — ${e.name}; relevance ${e.relevanceScore}; objectionRisk ${e.objectionRisk}`)
    .join('\n');
  const witnessList = parts.witnesses
    .map((w) => `- ${w.id}: ${w.name} (${w.role}, bias ${w.bias}); credibility ${w.credibilityScore}`)
    .join('\n');

  const base = [
    `Charges: ${parts.charges.map((c) => c.name).join(', ')}.`,
    `Defendant: ${parts.defendant.firstName} ${parts.defendant.lastName}.`,
    `Environment: ${parts.environment.description}`,
    // The canonical scene facts exist precisely so downstream stages stop
    // paraphrasing `description` and drifting. This stage writes
    // statementOfFacts and both closings — the most-read narrative surfaces in
    // the game — and was the one stage still authoring them blind to these.
    parts.environment.establishedFacts !== undefined
      ? `Established facts about the scene (state these as the facts of the case; do not contradict or embellish them):\n${parts.environment.establishedFacts.map((f) => `- ${f}`).join('\n')}`
      : '',
    'Evidence exhibits (write exactly one exhibitPoints entry per id below):',
    evidenceList,
    'Witnesses:',
    witnessList,
  ].filter((line) => line.length > 0).join('\n');
  return withFeedback(base, feedback);
}

const REPAIR_SYSTEM = `ROLE: You are correcting a California criminal case file that failed schema validation.

TASK: You are given the complete JSON object and the list of validation issues it produced. Return the same object with those issues fixed.

RULES:
1. Change only what the listed issues require. Every other field was accepted — return it exactly as it came.
2. Return the whole object, not a fragment and not a description of the changes.
3. ${BENCH_TRIAL_RULE} Where an issue points at a line that gives the decision to anyone but the judge, rewrite that line to address the court.`;

// On a repair retry, the model's own previous response is the current best
// version of the object. Re-embedding the original broken assembly on the
// second retry feeds stale context back in; use the previous response as the
// object instead when it is available.
function extractPreviousResponse(feedback: string | undefined): string | null {
  if (!feedback) return null;
  const marker = 'Your previous response was:\n';
  const idx = feedback.indexOf(marker);
  if (idx === -1) return null;
  return feedback.slice(idx + marker.length);
}

function buildRepairContents(assembled: unknown, issues: z.ZodError, feedback: string | undefined): string {
  const issueList = issues.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n');
  const previousResponse = extractPreviousResponse(feedback);
  const object = previousResponse ?? JSON.stringify(assembled);
  const base = `Object:\n${object}\n\nValidation issues:\n${issueList}`;
  return withFeedback(base, feedback);
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

  // Fix the two mechanical cross-stage failures before validating, so the
  // LLM repair round below is reached only by something genuinely narrative.
  // Each stage validated its own output in isolation; an id collision or a
  // dangling element reference can only appear once the pieces are assembled,
  // and asking Gemini to regenerate the whole case to fix a duplicate id is a
  // wildly disproportionate answer to a solved problem.
  const reconciled = reconcileCrossStageIds(parts);

  // finalFields.closingArguments.exhibitPoints was generated against
  // parts.evidence's *pre-reconciliation* ids (buildFinalizeContents lists
  // them from `parts`, not `reconciled`). On the ordinary path those ids are
  // unchanged by reconciliation and this is a no-op; on an actual evidence-id
  // collision, one exhibit's id gets renamed, and any exhibitPoints entry
  // still naming the old id no longer resolves. Which of the colliding
  // exhibits a point meant is ambiguous by construction, so — matching
  // reconcileCrossStageIds's own targetElementId philosophy — a stale
  // reference is dropped rather than guessed at.
  //
  // Duplicates are dropped in the same pass, keeping the first entry. CaseSchema
  // rejects a duplicated evidenceId (courtroomScript appends one fragment per
  // entry, so two entries argue the same exhibit twice), and without this the
  // rejection would fall through to the full-case repair round — the largest and
  // most truncation-prone response in the pipeline — for a defect a seen-id
  // filter fixes for free. Same reasoning as reconcileCrossStageIds above:
  // mechanical failures get mechanical repair.
  const reconciledEvidenceIds = new Set(reconciled.evidence.map((e) => e.id));
  const seenExhibitPointIds = new Set<string>();
  const exhibitPoints = finalFields.closingArguments.exhibitPoints?.filter((p) => {
    if (!reconciledEvidenceIds.has(p.evidenceId)) return false;
    if (seenExhibitPointIds.has(p.evidenceId)) return false;
    seenExhibitPointIds.add(p.evidenceId);
    return true;
  });

  const assembled = {
    caseId: finalFields.caseId,
    defendant: parts.defendant,
    environment: parts.environment,
    charges: reconciled.charges,
    statuteContexts: parts.statuteContexts,
    witnesses: reconciled.witnesses,
    evidence: reconciled.evidence,
    summary: finalFields.summary,
    statementOfFacts: finalFields.statementOfFacts,
    closingArguments: {
      prosecution: finalFields.closingArguments.prosecution,
      defense: finalFields.closingArguments.defense,
      ...(exhibitPoints !== undefined ? { exhibitPoints } : {}),
    },
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
// Stage 6b — VerdictVoice (verdict reactions + judge lines, authored after
// the defendant exists so the lines can name the defendant and reach for
// their circumstances).
// ============================================================================
const VerdictVoiceShape = z.object({
  charges: z.array(
    z.strictObject({
      id: z.string().min(1).max(40),
      verdictReactions: z.strictObject({
        GUILTY: ReactionBeatSchema,
        NOT_GUILTY: ReactionBeatSchema,
      }),
      verdictOptions: z.array(z.strictObject({
        choice: VerdictValueSchema,
        lineText: z.string().min(1).max(300),
      })).min(2).max(6),
    }).superRefine((charge, ctx) => {
      const missing = requireChoiceCoverage(charge.verdictOptions, VerdictValueSchema.options);
      if (missing !== null) ctx.addIssue({ code: z.ZodIssueCode.custom, message: missing });
    }),
  ).min(1),
});

// Built per call against the charge ids actually requested. A wrong or missing
// id used to validate fine here — `id` accepted any 1-40 char string — and then
// hit an un-retried `throw` in gameService when the voice for a charge could not
// be found, killing the whole generation two stages from the end. Checking the
// ids against the request turns that into an ordinary validation failure, which
// `generateValidated` repairs with the issues fed back.
function buildVerdictVoiceSchema(requestedChargeIds: readonly string[]) {
  return VerdictVoiceShape.superRefine((data, ctx) => {
    const returned = new Set(data.charges.map((c) => c.id));
    const missing = requestedChargeIds.filter((id) => !returned.has(id));
    if (missing.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `charges is missing an entry for these charge ids (echo each id exactly as given): ${missing.join(', ')}`,
      });
    }
    const unknown = [...returned].filter((id) => !requestedChargeIds.includes(id));
    if (unknown.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `charges names ids that are not in this case (echo each id exactly as given): ${unknown.join(', ')}`,
      });
    }
    // Duplicates would otherwise slip through both checks above (the set makes
    // two entries for one id look like one), and gameService's `find` would
    // silently keep the first — one charge's voiced layer discarded with no
    // retry, which is the failure this schema exists to prevent.
    const duplicated = [...new Set(
      data.charges.map((c) => c.id).filter((id, i, all) => all.indexOf(id) !== i),
    )];
    if (duplicated.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `charges has more than one entry for these ids (return exactly one per charge): ${duplicated.join(', ')}`,
      });
    }
  });
}

const VERDICT_VOICE_SYSTEM = `ROLE: You are a courtroom clerk preparing the voiced verdict layer for each charge.

TASK: For every charge in the case, write the courtroom's reaction to each possible verdict and the judge's selectable verdict lines from the bench.

RULES:
1. Return one entry per charge, and copy each charge's "id" into your entry exactly as it is given to you — character for character. The ids are how the case file matches your lines back to the charge they belong to.
2. Every "verdictOptions" array must cover both outcomes: at least one choice "GUILTY" and at least one choice "NOT_GUILTY".
3. The judge lines are spoken by the court from the bench. They may name the defendant and may reach for the defendant's circumstances — custody, employment, children, remorse — because the defendant now exists.
4. Charges are resolved one at a time, in the fixed order you are given, and every charge listed after the one being decided is still pending. Only the reactions for the LAST charge in that order may speak of the case concluding or the defendant being released — every earlier charge's reactions must acknowledge that further counts remain before the court.
5. Keep each judge line under 300 characters and each reaction line under 600.
6. ${BENCH_TRIAL_RULE} The judge alone returns the verdict.

EXAMPLE of the id rule: given "Count 1 of 2 — id: charge-grand-theft — Grand Theft", your entry for that count is {"id":"charge-grand-theft", ...}.`;

function buildVerdictVoiceContents(
  charges: ChargeCore[],
  defendant: Defendant,
  feedback: string | undefined,
): string {
  // One charge per line with the id on its own labelled field. Burying it
  // mid-string ("1 of 2 (id charge-x): Name") made the id read as incidental
  // prose, and an id echoed wrong is the one error this stage cannot absorb.
  const orderedCharges = charges
    .map((c, index) => `- Count ${index + 1} of ${charges.length} — id: ${c.id} — ${c.name}`)
    .join('\n');
  const base = [
    'Charges, in the fixed order they are resolved at trial:',
    orderedCharges,
    `Defendant: ${defendant.firstName} ${defendant.lastName}.`,
    'Return exactly one entry per count above, echoing each id character for character.',
  ].join('\n');
  return withFeedback(base, feedback);
}

export async function runVerdictVoice(
  apiKey: string,
  model: string,
  charges: ChargeCore[],
  defendant: Defendant,
): Promise<Pick<Charge, 'id' | 'verdictReactions' | 'verdictOptions'>[]> {
  const data = await generateValidated(
    apiKey,
    model,
    'VerdictVoice',
    VERDICT_VOICE_SYSTEM,
    (feedback) => buildVerdictVoiceContents(charges, defendant, feedback),
    VERDICT_VOICE_GEMINI_SCHEMA,
    // Deduplicated: StatuteSelection can emit two charges sharing an id (the
    // collision class reconcileCrossStageIds repairs, but not until
    // finalizeCasePayload, three stages later). Passing the raw list would make
    // the duplicate-entry refinement reject the response that correctly follows
    // "one entry per count", burning a retry on a defect the model did not
    // cause. One voiced layer per distinct id is all this stage can meaningfully
    // ask for.
    buildVerdictVoiceSchema([...new Set(charges.map((c) => c.id))]),
  );
  return data.charges;
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

const WEAK_PLEA_GEMINI_SCHEMA = geminiObjectOf('prosecutionRationale', { type: 'string', minLength: 1, maxLength: 1000 });

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

const PLEA_NARRATIVE_SYSTEM = `ROLE: You are counsel for both sides, stating your plea positions on the record.

TASK: Write each party's plea rationale as spoken in open court — and, where the case carries an offer, the defendant's allocution, the courtroom's reaction to each possible ruling, and the judge's selectable ruling lines.

RULES:
1. Write only what a party would say aloud, on the record, with the other side listening. Keep strategy, internal deliberation, and privileged advice out of it.
2. Cover both outcomes in "pleaRulingOptions": at least one option with choice "ACCEPT" and at least one with choice "REJECT".
3. The People's statement of facts is already on the record before this offer is discussed — do not re-argue or restate it as if for the first time. Reference it as already known ("as the People have stated") when the rationale needs it.
4. Keep each rationale under 1000 characters, the allocution under 800, judge lines under 300, and reaction lines under 600.
5. ${BENCH_TRIAL_RULE} Both sides are weighing this offer against a trial before this judge.`;

function buildPleaNarrativeContents(
  payload: CasePayload,
  band: 'WEAK' | 'MODERATE' | 'STRONG',
  offerTerms: { pleadsToChargeIds: string[]; proposedSentence: Sentence[] } | null,
  defensePosture: 'ACCEPT' | 'REJECT',
  feedback: string | undefined,
): string {
  const chargeNames = payload.charges.map((c) => c.name).join(', ');
  const defendantName = `${payload.defendant.firstName} ${payload.defendant.lastName}`;
  const factsLine = `Already on the record — the People's statement of facts: ${payload.statementOfFacts}`;

  let base: string;
  if (band === 'WEAK' || offerTerms === null) {
    base = `Case: ${chargeNames}. Defendant: ${defendantName}. ${factsLine} The prosecution is not extending an offer; write the People's rationale for proceeding without one.`;
  } else {
    const sentenceText = offerTerms.proposedSentence
      .map((s) => `${s.amount} ${s.unit} ${s.type}${s.type === 'PROBATION' ? ` (${s.conditions.join(', ')})` : ''}`)
      .join('; ');
    base = [
      `Case: ${chargeNames}.`,
      `Defendant: ${defendantName}.`,
      factsLine,
      `Offer terms: defendant pleads to ${offerTerms.pleadsToChargeIds.length === payload.charges.length ? 'all charges' : `charges ${offerTerms.pleadsToChargeIds.join(', ')}`}.`,
      `Proposed sentence: ${sentenceText}.`,
      `Defense posture: ${defensePosture} the offer.`,
      'Write the parties\' rationales, allocution, reactions, and ruling lines to match these exact terms.'
    ].join('\n');
  }
  return withFeedback(base, feedback);
}

export async function runPleaNarrative(
  apiKey: string,
  model: string,
  payload: CasePayload,
  band: 'WEAK' | 'MODERATE' | 'STRONG',
  offerTerms: { pleadsToChargeIds: string[]; proposedSentence: Sentence[] } | null,
  defensePosture: 'ACCEPT' | 'REJECT',
): Promise<PleaNarrative> {
  if (band === 'WEAK') {
    const data = await generateValidated(
      apiKey,
      model,
      'PleaNarrative.weak',
      PLEA_NARRATIVE_SYSTEM,
      (feedback) => buildPleaNarrativeContents(payload, band, null, defensePosture, feedback),
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
    (feedback) => buildPleaNarrativeContents(payload, band, offerTerms, defensePosture, feedback),
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

const AFTERMATH_GEMINI_SCHEMA = geminiObjectOf('narrative', { type: 'string', minLength: 1, maxLength: 4000 });

const AFTERMATH_SYSTEM = `ROLE: You are a court reporter writing the follow-up story once a California criminal case has closed.

TASK: Write the aftermath — public reaction, the consequences for those involved, and how the press covered it.

RULES:
1. Ground every claim in the outcome you are given: the plea or the verdict that actually happened, and the sentence the judge actually imposed.
2. Write between 1 and 4000 characters.
3. This was a bench trial: the judge alone heard the case and decided it. Write the coverage around the judge's decision — that is what reporters and the public would be reacting to. Never reference a jury, jurors, or a jury trial — there was none. Phrases like "in the absence of a jury" or "without a jury" are unnecessary and will be rejected; the bench trial is the default, not a deviation.`;

function buildAftermathContents(ctx: AftermathContext, feedback: string | undefined): string {
  const base = [
    `Case: ${ctx.caseData.charges.map((c) => c.name).join(', ')}.`,
    `Defendant: ${ctx.caseData.defendant.firstName} ${ctx.caseData.defendant.lastName}.`,
    ctx.pleaDecision !== null ? `Plea decision: ${ctx.pleaDecision}.` : 'Resolved by trial.',
    ctx.verdict !== null ? `Verdict: ${ctx.verdict.map((v) => `${v.chargeName}: ${v.verdict}`).join('; ')}.` : '',
    `Imposed sentence: ${JSON.stringify(ctx.imposedSentence)}.`,
  ].join('\n');
  return withFeedback(base, feedback);
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
