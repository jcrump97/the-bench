import { z } from 'zod';

// The Bench is always a bench trial: the judge (the player) alone rules on
// every objection and decides every verdict. There is no jury anywhere in the
// state machine, so no party's in-character dialogue may reference one — a
// live Gemini run once produced exactly that ("the jury is entitled to hear
// it"), which a Zod string-length check can't catch on its own. Applied to
// every voiced/narrative string field below; failing this sends the LLM
// pipeline's retry-with-feedback loop the concrete correction instead of
// silently letting anachronistic dialogue into the record.
const JURY_PATTERN = /\bjur(?:y|ies|or|ors)\b/i;
function noJury<T extends z.ZodString>(schema: T) {
  return schema.refine((text) => !JURY_PATTERN.test(text), {
    message: 'must not reference a jury or jurors — this is a bench trial; the judge alone rules and decides the verdict',
  });
}

// A live pipeline stage once authored verdict lines for "defendant Arthur
// Pendelton" when the actual defendant was Marcus Vance. The wrong name was
// a prosecution witness. In a bench trial there is only one defendant, so any
// field that writes "defendant <Name>" must name the actual defendant.
function addDefendantNameIssues(
  caseData: z.infer<typeof CaseSchema>,
  ctx: z.RefinementCtx,
): void {
  const fullName = `${caseData.defendant.firstName} ${caseData.defendant.lastName}`.trim();
  const firstName = caseData.defendant.firstName.trim();
  const lastName = caseData.defendant.lastName.trim();
  if (fullName.length === 0) return;

  // Match "defendant" followed by one or two capitalized name tokens. The
  // possessive "defendant's" is excluded by requiring whitespace after the
  // word. Lowercase verbs like "defendant entered" simply do not match.
  const pattern = /\b[Dd]efendant\s+([A-Z][A-Za-z'-]*(?:\s+[A-Z][A-Za-z'-]*)?)\b/g;
  const fields: Array<{ label: string; text: string }> = [];

  const push = (label: string, text: string | null | undefined) => {
    if (typeof text === 'string' && text.length > 0) fields.push({ label, text });
  };

  push('summary', caseData.summary);
  push('statementOfFacts', caseData.statementOfFacts);
  push('closingArguments.prosecution', caseData.closingArguments.prosecution);
  push('closingArguments.defense', caseData.closingArguments.defense);

  for (const charge of caseData.charges) {
    for (const reaction of charge.verdictReactions.GUILTY) push(`charge.${charge.id}.verdictReactions.GUILTY`, reaction.text);
    for (const reaction of charge.verdictReactions.NOT_GUILTY) push(`charge.${charge.id}.verdictReactions.NOT_GUILTY`, reaction.text);
    for (const option of charge.verdictOptions) push(`charge.${charge.id}.verdictOptions`, option.lineText);
  }

  for (const ev of caseData.evidence) {
    push(`evidence.${ev.id}.disclosureSummary`, ev.disclosureSummary);
    push(`evidence.${ev.id}.prosecutionArgument`, ev.prosecutionArgument);
    push(`evidence.${ev.id}.defenseObjection`, ev.defenseObjection);
    for (const reaction of ev.rulingReactions.ADMITTED) push(`evidence.${ev.id}.rulingReactions.ADMITTED`, reaction.text);
    for (const reaction of ev.rulingReactions.EXCLUDED) push(`evidence.${ev.id}.rulingReactions.EXCLUDED`, reaction.text);
  }

  for (const w of caseData.witnesses) {
    push(`witness.${w.id}.statement`, w.statement);
    push(`witness.${w.id}.directExamination`, w.directExamination);
    push(`witness.${w.id}.crossExamination`, w.crossExamination);
  }

  for (const { label, text } of fields) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const found = match[1]!.trim();
      const foundFull = found === fullName;
      const foundLast = found === lastName;
      const foundFirst = found === firstName;
      if (!foundFull && !foundLast && !foundFirst) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} names "defendant ${found}" but the defendant is ${fullName}`,
        });
      }
    }
  }
}

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

export const EvidenceTypeEnum = z.enum(['DOCUMENTARY', 'PHYSICAL', 'DIGITAL', 'FORENSIC', 'CIRCUMSTANTIAL', 'INTERROGATION']);
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

// The closed decision vocabularies. Every judge decision resolves to one of
// these values; the voiced dialogue below (reactions, judge-line options)
// keys off them, so authored or LLM text can never invent an outcome the
// decision schemas don't accept.
export const PleaDecisionSchema   = z.enum(['ACCEPT', 'REJECT']);
export const EvidenceRulingSchema = z.enum(['ADMITTED', 'EXCLUDED']);
export const VerdictValueSchema   = z.enum(['GUILTY', 'NOT_GUILTY']);

// One in-character line spoken in reaction to a ruling of the court. Reaction
// *selection* is deterministic (closed records keyed by the decision enums
// below); reaction *content* is narrative — the same color/structure split as
// every other authored field. The court itself never reacts to its own
// rulings, so COURT is not a reaction speaker.
export const ReactionLineSchema = z.strictObject({
  speaker: z.enum(['PROSECUTION', 'DEFENSE', 'CLERK']),
  text: noJury(z.string().min(1).max(600)),
});

// A short scripted exchange — one to four reaction lines played in order
// after a ruling enters the record.
export const ReactionBeatSchema = z.array(ReactionLineSchema).min(1).max(4);

// One selectable judge line: the words the court speaks when the player picks
// it, bound to a choice from a closed decision vocabulary. Multiple options
// may share a choice — variants multiply voice, never the state space.
function judgeLineOption<T extends z.ZodEnum<Record<string, string>>>(choice: T) {
  return z.strictObject({
    choice,
    lineText: noJury(z.string().min(1).max(300)),
  });
}

// Every value in the closed choice set must be reachable through at least one
// option — a decision the player cannot express is an illegal payload.
function addChoiceCoverageIssues(
  options: readonly { choice: string }[],
  allChoices: readonly string[],
  ctx: z.RefinementCtx,
): void {
  for (const choice of allChoices) {
    if (!options.some((o) => o.choice === choice)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `No judge-line option covers choice ${choice}` });
    }
  }
}

// The structural/legal half of a charge — the part the LLM must produce first,
// before the voiced verdict layer is authored in a separate pipeline stage.
const ChargeCoreShape = {
  id: z.string().min(1).max(40),
  name: z.string().min(1).max(200),
  classification: z.enum(['FELONY', 'MISDEMEANOR', 'INFRACTION']),
  elements: z.array(StatuteElementSchema).min(1),
  mandatoryMinimums: z.array(SentenceSchema),
  maximumPenalties: z.array(SentenceSchema).min(1),
};

export const ChargeCoreSchema = z.strictObject(ChargeCoreShape).superRefine((charge, ctx) => {
  addMinimumCeilingIssues(charge.mandatoryMinimums, charge.maximumPenalties, ctx);
});

// Charges carry their own statutory range; case-level exposure is derived
// deterministically from these in src/lib/sentencingExposure.ts.
export const ChargeSchema = z.strictObject({
  ...ChargeCoreShape,
  // The courtroom's voiced reaction to each possible verdict on this charge,
  // spoken immediately after the verdict enters the record.
  verdictReactions: z.strictObject({
    GUILTY: ReactionBeatSchema,
    NOT_GUILTY: ReactionBeatSchema,
  }),
  // The judge's selectable verdict lines for this charge — what the court
  // actually says from the bench when the player calls the count.
  verdictOptions: z.array(judgeLineOption(VerdictValueSchema)).min(2).max(6),
}).superRefine((charge, ctx) => {
  addMinimumCeilingIssues(charge.mandatoryMinimums, charge.maximumPenalties, ctx);
  addChoiceCoverageIssues(charge.verdictOptions, VerdictValueSchema.options, ctx);
});

// One line of a recorded custodial interview — the tape is played into the
// record line by line when the exhibit is offered, so each line is a spoken
// beat, not document prose.
export const InterrogationLineSchema = z.strictObject({
  speaker: z.enum(['DETECTIVE', 'DEFENDANT']),
  text: noJury(z.string().min(1).max(400)),
});

// The recorded custodial interview behind an INTERROGATION exhibit. The
// structural facts — what the interview produced and how the defense attacks
// it — are decided deterministically by deriveInterrogationProfile
// (src/lib/interrogation.ts) from the defendant's OCEAN traits and priors;
// `outcome` and `challengeGround` are echo fields the author (later, the
// InterrogationGen pipeline stage) must declare to match, enforced by
// defineDemoCase. INVOKED_COUNSEL is deliberately absent from the outcome
// vocabulary: a defendant who lawyered up produced no usable tape, so no
// INTERROGATION exhibit can exist for one.
export const InterrogationSchema = z.strictObject({
  detectiveName: z.string().min(1).max(101).describe("The interviewing detective — must match the case's INVESTIGATOR witness when one exists."),
  outcome: z.enum(['FULL_CONFESSION', 'PARTIAL_ADMISSION', 'DENIAL']).describe("Echo of the derived interrogation profile; the transcript must dramatize exactly this outcome."),
  challengeGround: z.enum(['MIRANDA', 'VOLUNTARINESS']).describe("Echo of the derived profile: the ground on which the defense moves to suppress the tape."),
  lines: z.array(InterrogationLineSchema).min(4).max(24),
});

export const WitnessSchema = z.strictObject({
  id: z.string().min(1).max(40),
  name: z.string().max(101).describe("Full fictional name. Do not include race or protected demographics."),
  role: WitnessRoleEnum,
  bias: BiasIndicatorEnum,
  statement: noJury(z.string().max(1000)).describe("A summary of their expected testimony."),
  credibilityScore: z.number().int().min(1).max(10),
  // Voiced testimony beats for the trial phase. Which side conducts direct
  // (and which crosses) is derived from `bias` — PROSECUTION/NEUTRAL
  // witnesses are the People's, DEFENSE witnesses are the defense's.
  directExamination: noJury(z.string().min(1).max(1200)).describe("The witness's testimony on direct examination, first person, as spoken from the stand."),
  crossExamination: noJury(z.string().min(1).max(1200)).nullable().describe("The witness's testimony under cross-examination, first person; null when opposing counsel declines to cross."),
});

export const EvidenceSchema = z.strictObject({
  id: z.string().min(1).max(40),
  name: z.string().min(3).max(100),
  type: EvidenceTypeEnum,
  description: z.string().max(600).describe("A purely factual, objective description of the item."),
  // Tier-1 discovery text: what counsel says about the item when disclosing
  // it in Act 1, before anything is verified or presented. Brief and
  // counsel-voiced — the full detail stays hidden until the exhibit is
  // actually offered.
  disclosureSummary: noJury(z.string().min(1).max(400)).describe("Counsel's brief, unverified summary of the item as disclosed in discovery, spoken to the court."),
  relevanceScore: z.number().int().min(1).max(10).describe("Scale of 1-10 on impact to the case."),
  objectionRisk: z.enum(['LOW', 'MEDIUM', 'HIGH']).describe("Likelihood of opposing counsel objecting."),
  targetElementId: z.string().min(1).max(40).nullable().describe("The ID of the StatuteElement this evidence is meant to prove."),
  isAdmitted: z.boolean().optional().transform((): boolean => false).describe("Always initialized to false. Mutated by player action during the trial phase."),
  // Voiced motion-hearing beats: the prosecutor offers the exhibit, defense
  // counsel objects (or waives), and the judge rules on that exchange.
  prosecutionArgument: noJury(z.string().min(1).max(600)).describe("The prosecutor's in-character offer of this exhibit to the court."),
  defenseObjection: noJury(z.string().min(1).max(600)).nullable().describe("Defense counsel's in-character objection to this exhibit; null when the defense waives objection."),
  // The courtroom's voiced reaction to each possible ruling on this exhibit,
  // spoken immediately after the ruling enters the record.
  rulingReactions: z.strictObject({
    ADMITTED: ReactionBeatSchema,
    EXCLUDED: ReactionBeatSchema,
  }),
  // The judge's selectable ruling lines for this exhibit.
  rulingOptions: z.array(judgeLineOption(EvidenceRulingSchema)).min(2).max(6),
  // The recorded interview itself — present exactly when type is
  // INTERROGATION (enforced below).
  interrogation: InterrogationSchema.optional(),
}).superRefine((ev, ctx) => {
  addChoiceCoverageIssues(ev.rulingOptions, EvidenceRulingSchema.options, ctx);
  // The objectionRisk score and the voiced objection must agree: a MEDIUM or
  // HIGH risk exhibit is one the defense fights, so waiving (null) is only
  // coherent on LOW. (A LOW-risk exhibit may still carry an objection.)
  if (ev.objectionRisk !== 'LOW' && ev.defenseObjection === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Evidence ${ev.id} has ${ev.objectionRisk} objectionRisk but no defenseObjection — the defense only waives on LOW-risk exhibits`,
    });
  }
  // An INTERROGATION exhibit is the tape and nothing else: the transcript
  // block travels with the type, and the defense always moves against a
  // custodial interview (the challengeGround names how).
  if ((ev.type === 'INTERROGATION') !== (ev.interrogation !== undefined)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Evidence ${ev.id}: the interrogation block must be present exactly when type is INTERROGATION`,
    });
  }
  if (ev.type === 'INTERROGATION' && ev.defenseObjection === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Evidence ${ev.id}: an INTERROGATION exhibit is always challenged — defenseObjection cannot be null`,
    });
  }
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
  prosecutionRationale: noJury(z.string().min(1).max(1000)).describe("The People's plea position as spoken to the court on the record — never privileged strategy or internal deliberation."),
  defenseRationale:     noJury(z.string().min(1).max(1000)).optional().describe("Defense counsel's plea position as spoken to the court on the record — never privileged advice to the client."),
  // The defendant's own statement to the court on the accepted-plea path,
  // spoken before sentencing. Only meaningful when an offer can reach the
  // bench (PENDING_JUDICIAL_REVIEW) — defineDemoCase enforces that pairing
  // for authored cases, mirroring the defenseRationale convention above.
  allocution:           noJury(z.string().min(1).max(800)).optional(),
  // The courtroom's voiced reaction to the judge's ruling on the negotiated
  // plea. Authored exactly when an offer reaches the bench — same pairing
  // rule as allocution, enforced by defineDemoCase.
  pleaReactions: z.strictObject({
    ACCEPT: ReactionBeatSchema,
    REJECT: ReactionBeatSchema,
  }).optional(),
  // The judge's selectable ruling lines on the negotiated plea. Paired with
  // pleaReactions above: authored exactly when an offer reaches the bench.
  pleaRulingOptions: z.array(judgeLineOption(PleaDecisionSchema)).min(2).max(6).optional(),
}).superRefine((narrative, ctx) => {
  if (narrative.pleaRulingOptions !== undefined) {
    addChoiceCoverageIssues(narrative.pleaRulingOptions, PleaDecisionSchema.options, ctx);
  }
});

export const CaseSchema = z.strictObject({
  caseId: z.string().regex(/^[0-9]{2}-CR-[0-9]{5}$/, "Must be a standard CA format (YY-CR-XXXXX)"),
  defendant: CharacterSchema,
  environment: EnvironmentSchema,

  charges: z.array(ChargeSchema).min(1),
  statuteContexts: z.array(z.string().max(500)).min(1),

  witnesses: z.array(WitnessSchema).min(2),
  evidence: z.array(EvidenceSchema).min(3),

  summary: noJury(z.string().max(1500)).describe("A dry, allegations-only docket synopsis for the case file — no narrative color, no party's framing. The People's version of events belongs in statementOfFacts."),

  // The People's in-character statement of the case, spoken into the record
  // at a dedicated Act 1 beat. Facts always come from a party — the clerk
  // only calls the case and reads the charges.
  statementOfFacts: noJury(z.string().min(1).max(1500)).describe("The People's statement of the case as spoken to the court on the record, in character."),

  // Voiced closing arguments, delivered after testimony and before the
  // per-charge verdicts on the trial path.
  closingArguments: z.strictObject({
    prosecution: noJury(z.string().min(1).max(1200)).describe("The People's closing argument, in character."),
    defense: noJury(z.string().min(1).max(1200)).describe("The defense's closing argument, in character."),
  }),
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

  // Structural backstop: any "defendant <Name>" phrase must name the actual
  // defendant. This catches the VerdictVoice/wrong-person class of error that
  // prompt text alone cannot guarantee against.
  addDefendantNameIssues(v, ctx);
});

export const CasePayloadSchema = CaseSchema;

// ==========================================
// 5. PLAYER DECISIONS
// ==========================================
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
export const AftermathNarrativeSchema = noJury(z.string().min(1).max(4000));

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
// TYPE EXPORTS
// ==========================================
export type SecurityPayload     = z.infer<typeof BYOKSchema>;
export type Sentence            = z.infer<typeof SentenceSchema>;
export type CasePayload         = z.infer<typeof CasePayloadSchema>;
export type GamePhase           = z.infer<typeof GamePhaseSchema>;
export type Environment         = z.infer<typeof EnvironmentSchema>;
export type Charge              = z.infer<typeof ChargeSchema>;
export type ChargeCore          = z.infer<typeof ChargeCoreSchema>;
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
export type ReactionLine        = z.infer<typeof ReactionLineSchema>;
export type ReactionBeat        = z.infer<typeof ReactionBeatSchema>;
export type InterrogationLine   = z.infer<typeof InterrogationLineSchema>;
export type Interrogation       = z.infer<typeof InterrogationSchema>;
