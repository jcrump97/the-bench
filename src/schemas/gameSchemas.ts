import { z } from 'zod';

// ==========================================
// 1. SECURITY PERIMETER
// ==========================================
export const BYOKSchema = z.discriminatedUnion("isDemo", [
  z.strictObject({
    isDemo: z.literal(false),
    apiKey: z.string().min(30, "Invalid API Key").startsWith("AIza", "Must be a valid Gemini key"),
  }),
  z.strictObject({
    isDemo: z.literal(true),
    apiKey: z.undefined().optional(),
  })
]);

// ==========================================
// 2. SENTENCING & LEGAL INFRASTRUCTURE
// ==========================================
export const ProbationConditionEnum = z.enum([
  'SUBSTANCE_ABUSE_TREATMENT',
  'ANGER_MANAGEMENT',
  'RANDOM_DRUG_TESTING',
  'NO_CONTACT_ORDER',
  'ELECTRONIC_MONITORING',
  'COMMUNITY_SERVICE'
]);

const SENTENCE_UNIT_MAX: Record<'YEARS' | 'MONTHS' | 'DAYS' | 'DOLLARS' | 'HOURS', number> = {
  YEARS: 100,
  MONTHS: 1200,
  DAYS: 36500,
  DOLLARS: 10_000_000,
  HOURS: 10_000,
};

export const SentenceSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal('PRISON'),            unit: z.enum(['YEARS', 'MONTHS', 'DAYS']), amount: z.number().int().positive() }),
  z.strictObject({ type: z.literal('JAIL'),              unit: z.enum(['YEARS', 'MONTHS', 'DAYS']), amount: z.number().int().positive() }),
  z.strictObject({ type: z.literal('FINE'),              unit: z.literal('DOLLARS'),               amount: z.number().int().positive() }),
  z.strictObject({ type: z.literal('COMMUNITY_SERVICE'), unit: z.literal('HOURS'),                 amount: z.number().int().positive() }),
  z.strictObject({ type: z.literal('PROBATION'),         unit: z.enum(['YEARS', 'MONTHS']),        amount: z.number().int().positive(), conditions: z.array(ProbationConditionEnum).min(1) }),
]).superRefine((v, ctx) => {
  const max = SENTENCE_UNIT_MAX[v.unit];
  if (v.amount > max) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Amount ${v.amount} exceeds maximum ${max} for unit ${v.unit}`,
    });
  }
});

// Day-normalized amount for sentence types that carry floor/ceiling semantics
// (PRISON/JAIL time, FINE dollars). PROBATION/COMMUNITY_SERVICE return null —
// they have no "minimum floor" meaning in this domain.
export function sentenceDayEquivalent(s: z.infer<typeof SentenceSchema>): number | null {
  if (s.type === 'PRISON' || s.type === 'JAIL') {
    if (s.unit === 'DAYS') return s.amount;
    if (s.unit === 'MONTHS') return s.amount * (365 / 12);
    return s.amount * 365;
  }
  if (s.type === 'FINE') return s.amount;
  return null;
}

export const EvidenceTypeEnum = z.enum(['DOCUMENTARY', 'PHYSICAL', 'DIGITAL', 'FORENSIC', 'CIRCUMSTANTIAL']);
export const WitnessRoleEnum = z.enum(['EYEWITNESS', 'EXPERT', 'CHARACTER', 'VICTIM', 'INVESTIGATOR']);
export const BiasIndicatorEnum = z.enum(['PROSECUTION', 'DEFENSE', 'NEUTRAL']);

export const StatuteElementSchema = z.strictObject({
  id: z.string().min(1).max(40),
  description: z.string().max(500).describe("The specific legal requirement or element of the crime that must be proven."),
  isProven: z.boolean().optional().transform((): boolean => false),
});

// Every mandatory minimum must be backed by a same-type maximum penalty at
// least as large, so a plea discount always has a real ceiling to floor against.
function addMinimumCeilingIssues(
  mandatoryMinimums: z.infer<typeof SentenceSchema>[],
  maximumPenalties: z.infer<typeof SentenceSchema>[],
  ctx: z.RefinementCtx
): void {
  for (const min of mandatoryMinimums) {
    const minDays = sentenceDayEquivalent(min);
    if (minDays === null) continue;
    const matchingMax = maximumPenalties.find(max => max.type === min.type);
    if (!matchingMax) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `mandatoryMinimums has a ${min.type} entry with no matching-type maximumPenalties entry` });
      continue;
    }
    const maxDays = sentenceDayEquivalent(matchingMax);
    if (maxDays !== null && maxDays < minDays) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `mandatoryMinimums ${min.type} entry exceeds its matching maximumPenalties entry` });
    }
  }
}

// Charges carry their own statutory range; case-level exposure is derived
// deterministically from these in src/lib/sentencingExposure.ts.
export const ChargeSchema = z.strictObject({
  id: z.string().min(1).max(40),
  name: z.string().min(1).max(200),
  classification: z.enum(['FELONY', 'MISDEMEANOR', 'INFRACTION']),
  elements: z.array(StatuteElementSchema).min(1),
  mandatoryMinimums: z.array(SentenceSchema),
  maximumPenalties: z.array(SentenceSchema).min(1),
}).superRefine((charge, ctx) =>
  addMinimumCeilingIssues(charge.mandatoryMinimums, charge.maximumPenalties, ctx)
);

export const WitnessSchema = z.strictObject({
  id: z.string().min(1).max(40),
  name: z.string().max(101).describe("Full fictional name. Do not include race or protected demographics."),
  role: WitnessRoleEnum,
  bias: BiasIndicatorEnum,
  statement: z.string().max(1000).describe("A summary of their expected testimony."),
  credibilityScore: z.number().min(1).max(10),
});

export const EvidenceSchema = z.strictObject({
  id: z.string().min(1).max(40),
  name: z.string().min(3).max(100),
  type: EvidenceTypeEnum,
  description: z.string().max(600).describe("A purely factual, objective description of the item."),
  relevanceScore: z.number().min(1).max(10).describe("Scale of 1-10 on impact to the case."),
  objectionRisk: z.enum(['LOW', 'MEDIUM', 'HIGH']).describe("Likelihood of opposing counsel objecting."),
  targetElementId: z.string().min(1).max(40).nullable().describe("The ID of the StatuteElement this evidence is meant to prove."),
  isAdmitted: z.boolean().optional().transform((): boolean => false).describe("Always initialized to false. Mutated by player action during the trial phase."),
});

// ==========================================
// 3. DEMOGRAPHICS & CHARACTER ENTITIES
// ==========================================
export const PastConvictionSchema = z.strictObject({
  chargeName: z.string().max(200),
  year: z.number().int().min(1900).max(new Date().getFullYear()),
  sentences: z.array(SentenceSchema),
});

export const SubstanceAbuseSchema = z.strictObject({
  substance: z.string().max(100),
  status: z.enum(['ACTIVE', 'IN_RECOVERY', 'NONE_REPORTED']),
});

export const CharacterSchema = z.strictObject({
  firstName: z.string().max(50),
  lastName: z.string().max(50),
  age: z.number().int().min(18).max(120),

  demographics: z.strictObject({
    relationshipStatus: z.enum(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED']),
    children: z.number().int().min(0).max(30),
    employmentStatus: z.enum(['EMPLOYED', 'UNEMPLOYED', 'STUDENT', 'RETIRED']),
    educationLevel: z.enum(['SOME_HIGH_SCHOOL', 'HIGH_SCHOOL', 'COLLEGE', 'ADVANCED_DEGREE']),
    substanceAbuseHistory: z.array(SubstanceAbuseSchema),
  }),

  pastConvictions: z.array(PastConvictionSchema),

  oceanTraits: z.strictObject({
    openness: z.number().min(1).max(10),
    conscientiousness: z.number().min(1).max(10),
    extraversion: z.number().min(1).max(10),
    agreeableness: z.number().min(1).max(10),
    neuroticism: z.number().min(1).max(10),
  }),
});

// ==========================================
// 4. ENVIRONMENT & CASE PAYLOAD
// ==========================================
export const EnvironmentSchema = z.strictObject({
  locationType: z.enum(['RESIDENTIAL', 'COMMERCIAL', 'PUBLIC_SPACE', 'VEHICLE', 'DIGITAL']),
  timeOfDay: z.enum(['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT']),
  weather: z.enum(['CLEAR', 'RAIN', 'FOG', 'SNOW', 'N/A']),
  description: z.string().max(500),
});

const offerTerms = {
  pleadsToChargeIds:    z.array(z.string().min(1).max(40)).min(1),
  dismissedChargeIds:   z.array(z.string().min(1).max(40)),
  proposedSentence:     z.array(SentenceSchema).min(1),
  prosecutionRationale: z.string().min(1).max(1000),
  defenseRationale:     z.string().min(1).max(1000),
};

// 3-state: prosecution declined / defense rejected / pending judicial review
export const PleaPostureSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('NO_OFFER'),
    prosecutionRationale: z.string().min(1).max(1000),
  }),
  z.strictObject({ status: z.literal('REJECTED_BY_DEFENSE'),    ...offerTerms }),
  z.strictObject({ status: z.literal('PENDING_JUDICIAL_REVIEW'), ...offerTerms }),
]);

// The LLM's only plea contribution: narrative color, not structure. All plea
// structure (status, proposed sentence, charge partition) is computed
// deterministically by buildPleaPosture. defenseRationale is optional here
// because WEAK/NO_OFFER cases never use it; the "required-when-offering"
// constraint is enforced by buildPleaPosture's discriminated PleaPostureInput.
export const PleaNarrativeSchema = z.strictObject({
  prosecutionRationale: z.string().min(1).max(1000),
  defenseRationale:     z.string().min(1).max(1000).optional(),
});

export const CaseSchema = z.strictObject({
  caseId: z.string().regex(/^[0-9]{2}-CR-[0-9]{5}$/, "Must be a standard CA format (YY-CR-XXXXX)"),
  defendant: CharacterSchema,
  environment: EnvironmentSchema,

  charges: z.array(ChargeSchema).min(1),
  statuteContexts: z.array(z.string().max(500)).min(1),

  witnesses: z.array(WitnessSchema).min(2),
  evidence: z.array(EvidenceSchema).min(3),

  summary: z.string().max(1500),
}).superRefine((v, ctx) => {
  const elementIds = new Set<string>();
  const chargeIds = new Set<string>();
  const evidenceIds = new Set<string>();
  const witnessIds = new Set<string>();

  // Collect and check uniqueness of entity IDs
  for (const charge of v.charges) {
    if (chargeIds.has(charge.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate charge id: ${charge.id}` });
    }
    chargeIds.add(charge.id);
    for (const el of charge.elements) {
      if (elementIds.has(el.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate element id: ${el.id}` });
      }
      elementIds.add(el.id);
    }
  }
  for (const ev of v.evidence) {
    if (evidenceIds.has(ev.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate evidence id: ${ev.id}` });
    }
    evidenceIds.add(ev.id);
    if (ev.targetElementId !== null && !elementIds.has(ev.targetElementId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Evidence ${ev.id} references unknown element: ${ev.targetElementId}` });
    }
  }
  for (const w of v.witnesses) {
    if (witnessIds.has(w.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate witness id: ${w.id}` });
    }
    witnessIds.add(w.id);
  }
});

export const CasePayloadSchema = CaseSchema;

// ==========================================
// 5. PLAYER DECISIONS
// ==========================================
export const PleaDecisionSchema = z.enum(['ACCEPT', 'REJECT']);

// Shared with the dialogue script (section 9): dialogue options carry these
// same closed choice sets, so a script can never invent an outcome the
// decision schemas don't accept.
export const EvidenceRulingSchema = z.enum(['ADMITTED', 'EXCLUDED']);
export const VerdictValueSchema   = z.enum(['GUILTY', 'NOT_GUILTY']);

export const MotionRulingSchema = z.strictObject({
  evidenceId: z.string().min(1).max(40),
  ruling: EvidenceRulingSchema,
});

export const ChargeVerdictSchema = z.strictObject({
  chargeId:       z.string().min(1).max(40),
  chargeName:     z.string().max(200),
  classification: z.enum(['FELONY', 'MISDEMEANOR', 'INFRACTION']),
  verdict:        VerdictValueSchema,
});

export const VerdictSchema = z.array(ChargeVerdictSchema).min(1);

// ==========================================
// 6. CASE ASSESSMENTS (derived, snapshotted)
// ==========================================

// Prosecution's view: "Can I prove this?" — drives plea offer decision and Act 3 range
export const ProsecutionStrengthSchema = z.strictObject({
  score:            z.number().min(0).max(100),
  band:             z.enum(['WEAK', 'MODERATE', 'STRONG']),
  evidenceStrength: z.number().min(0).max(100),
  witnessStrength:  z.number().min(0).max(100),
  elementCoverage:  z.number().min(0).max(1),
});

// Defense's view: "Should the defendant gamble at trial?" — deliberatley different inputs
export const DefenseRiskSchema = z.strictObject({
  acceptanceLikelihood: z.number().min(0).max(100),
  posture:              z.enum(['ACCEPT', 'REJECT']),
  riskTolerance:        z.number().min(0).max(100),
  priorExposure:        z.number().min(0).max(100),
  offerGenerosity:      z.number().min(0).max(100),
});

// ==========================================
// 7. FINAL RESULT (persisted to localStorage)
// ==========================================

// The aftermath is LLM/demo-authored narrative that crosses a trust boundary
// twice: hydrating game state after sentencing and persisting into
// FinalResult. One schema guards both crossings.
export const AftermathNarrativeSchema = z.string().min(1).max(4000);

const finalResultBase = {
  schemaVersion:       z.literal(1),
  caseId:              z.string().regex(/^[0-9]{2}-CR-[0-9]{5}$/),
  defendantName:       z.string().max(101),
  completedAt:         z.string().datetime(),
  prosecutionStrength: ProsecutionStrengthSchema,
  defenseRisk:         DefenseRiskSchema.nullable(),
  imposedSentence:     z.array(SentenceSchema),
  aftermathNarrative:  AftermathNarrativeSchema,
};

export const FinalResultSchema = z.discriminatedUnion('resolutionPath', [
  z.strictObject({
    resolutionPath: z.literal('PLEA'),
    pleaDecision:   z.literal('ACCEPT'),
    ...finalResultBase,
  }),
  z.strictObject({
    resolutionPath: z.literal('TRIAL'),
    pleaOutcome:    z.enum(['NO_OFFER_MADE', 'REJECTED_BY_DEFENSE', 'JUDGE_FORCED_TRIAL']),
    motionRulings:  z.array(MotionRulingSchema),
    verdict:        VerdictSchema,
    ...finalResultBase,
  }),
]);

// ==========================================
// 8. STATE MACHINE SCHEMA
// ==========================================
export const GamePhaseSchema = z.enum([
  'WELCOME',
  'ACT_1_INTAKE',
  'ACT_2_MOTIONS',
  'ACT_3_VERDICT',
  'END_STATE',
  'ERROR_STATE'
]);

// ==========================================
// 9. DIALOGUE SCRIPT (narrative-only sidecar)
// ==========================================
// The courtroom-transcript redesign (TODO.md). A DialogueScript is authored
// (demo docket) or LLM-generated narrative that crosses the trust boundary at
// hydration, like PleaNarrativeSchema — it supplies only *lines*, never
// structure. Governing invariant: a dialogue option is
// { lineText, choice } where choice comes from the closed decision enums in
// section 5. Beat *selection* is deterministic (reactionBeats is a closed
// record keyed by choice); beat *content* is narrative. Sentencing has no
// dialogue options by design — it stays a structured form and its
// pronouncement is projected into the transcript deterministically.

export const TranscriptSpeakerSchema = z.enum([
  'CLERK',
  'PROSECUTION',
  'DEFENSE',
  'COURT',
  'WITNESS',
  'DEFENDANT',
  'PRESS',
]);

// characterId is non-null exactly when speaker === 'WITNESS' (it points into
// CasePayload.witnesses so the UI can show the witness's name). The defendant
// is singular per case and every other speaker is a role, not a person.
export const TranscriptLineSchema = z.strictObject({
  speaker: TranscriptSpeakerSchema,
  characterId: z.string().min(1).max(40).nullable(),
  text: z.string().min(1).max(1000),
}).superRefine((line, ctx) => {
  if (line.speaker === 'WITNESS' && line.characterId === null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'WITNESS lines must carry a characterId' });
  }
  if (line.speaker !== 'WITNESS' && line.characterId !== null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${line.speaker} lines must not carry a characterId` });
  }
});

// A beat: an uninterrupted scripted exchange played line-by-line between
// player decisions. Beat ids must be unique across the whole script (checked
// in DialogueScriptSchema) — they become stable ledger-entry/React keys.
export const DialogueBeatSchema = z.strictObject({
  id: z.string().min(1).max(40),
  lines: z.array(TranscriptLineSchema).min(1).max(20),
});

// One selectable judge line. Multiple options may share a choice — variants
// multiply voice, never the state space.
function dialogueOption<T extends z.ZodEnum<Record<string, string>>>(choice: T) {
  return z.strictObject({
    choice,
    lineText: z.string().min(1).max(300),
  });
}

// Every value in the closed choice set must be reachable through at least one
// option — a decision the player cannot express is an illegal script.
function addChoiceCoverageIssues(
  options: readonly { choice: string }[],
  allChoices: readonly string[],
  ctx: z.RefinementCtx,
): void {
  for (const choice of allChoices) {
    if (!options.some((o) => o.choice === choice)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `No dialogue option covers choice ${choice}` });
    }
  }
}

export const PleaDialogueSchema = z.strictObject({
  kind: z.literal('PLEA'),
  promptBeat: DialogueBeatSchema,
  options: z.array(dialogueOption(PleaDecisionSchema)).min(2).max(8),
  reactionBeats: z.strictObject({
    ACCEPT: DialogueBeatSchema,
    REJECT: DialogueBeatSchema,
  }),
}).superRefine((v, ctx) => addChoiceCoverageIssues(v.options, PleaDecisionSchema.options, ctx));

export const MotionDialogueSchema = z.strictObject({
  kind: z.literal('MOTION'),
  evidenceId: z.string().min(1).max(40),
  promptBeat: DialogueBeatSchema,
  options: z.array(dialogueOption(EvidenceRulingSchema)).min(2).max(8),
  reactionBeats: z.strictObject({
    ADMITTED: DialogueBeatSchema,
    EXCLUDED: DialogueBeatSchema,
  }),
}).superRefine((v, ctx) => addChoiceCoverageIssues(v.options, EvidenceRulingSchema.options, ctx));

export const VerdictDialogueSchema = z.strictObject({
  kind: z.literal('VERDICT'),
  chargeId: z.string().min(1).max(40),
  promptBeat: DialogueBeatSchema,
  options: z.array(dialogueOption(VerdictValueSchema)).min(2).max(8),
  reactionBeats: z.strictObject({
    GUILTY: DialogueBeatSchema,
    NOT_GUILTY: DialogueBeatSchema,
  }),
}).superRefine((v, ctx) => addChoiceCoverageIssues(v.options, VerdictValueSchema.options, ctx));

// plea is null for NO_OFFER cases (the prosecution's declination is scripted
// into openingBeat); there is no judicial plea decision to voice. Whether the
// script's evidenceIds/chargeIds/witness characterIds resolve against the
// active CasePayload is a hydration-time check, not intra-script validation.
export const DialogueScriptSchema = z.strictObject({
  openingBeat: DialogueBeatSchema,
  plea: PleaDialogueSchema.nullable(),
  motions: z.array(MotionDialogueSchema).min(1).max(20),
  verdicts: z.array(VerdictDialogueSchema).min(1).max(10),
}).superRefine((script, ctx) => {
  const beatIds = new Set<string>();
  const addBeat = (beat: z.infer<typeof DialogueBeatSchema>) => {
    if (beatIds.has(beat.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate beat id: ${beat.id}` });
    }
    beatIds.add(beat.id);
  };

  addBeat(script.openingBeat);
  if (script.plea !== null) {
    addBeat(script.plea.promptBeat);
    addBeat(script.plea.reactionBeats.ACCEPT);
    addBeat(script.plea.reactionBeats.REJECT);
  }

  const evidenceIds = new Set<string>();
  for (const motion of script.motions) {
    if (evidenceIds.has(motion.evidenceId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate motion evidenceId: ${motion.evidenceId}` });
    }
    evidenceIds.add(motion.evidenceId);
    addBeat(motion.promptBeat);
    addBeat(motion.reactionBeats.ADMITTED);
    addBeat(motion.reactionBeats.EXCLUDED);
  }

  const chargeIds = new Set<string>();
  for (const verdict of script.verdicts) {
    if (chargeIds.has(verdict.chargeId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate verdict chargeId: ${verdict.chargeId}` });
    }
    chargeIds.add(verdict.chargeId);
    addBeat(verdict.promptBeat);
    addBeat(verdict.reactionBeats.GUILTY);
    addBeat(verdict.reactionBeats.NOT_GUILTY);
  }
});

// ==========================================
// TYPE EXPORTS
// ==========================================
export type SecurityPayload     = z.infer<typeof BYOKSchema>;
export type Sentence            = z.infer<typeof SentenceSchema>;
export type CasePayload         = z.infer<typeof CasePayloadSchema>;
export type GamePhase           = z.infer<typeof GamePhaseSchema>;
export type Environment         = z.infer<typeof EnvironmentSchema>;
export type Charge              = z.infer<typeof ChargeSchema>;
export type PleaPosture         = z.infer<typeof PleaPostureSchema>;
export type PleaNarrative       = z.infer<typeof PleaNarrativeSchema>;
export type PleaDecision        = z.infer<typeof PleaDecisionSchema>;
export type MotionRuling        = z.infer<typeof MotionRulingSchema>;
export type ChargeVerdict       = z.infer<typeof ChargeVerdictSchema>;
export type Verdict             = z.infer<typeof VerdictSchema>;
export type ProsecutionStrength = z.infer<typeof ProsecutionStrengthSchema>;
export type DefenseRisk         = z.infer<typeof DefenseRiskSchema>;
export type FinalResult         = z.infer<typeof FinalResultSchema>;
export type EvidenceRuling      = z.infer<typeof EvidenceRulingSchema>;
export type VerdictValue        = z.infer<typeof VerdictValueSchema>;
export type TranscriptSpeaker   = z.infer<typeof TranscriptSpeakerSchema>;
export type TranscriptLine      = z.infer<typeof TranscriptLineSchema>;
export type DialogueBeat        = z.infer<typeof DialogueBeatSchema>;
export type PleaDialogue        = z.infer<typeof PleaDialogueSchema>;
export type MotionDialogue      = z.infer<typeof MotionDialogueSchema>;
export type VerdictDialogue     = z.infer<typeof VerdictDialogueSchema>;
export type DialogueScript      = z.infer<typeof DialogueScriptSchema>;
