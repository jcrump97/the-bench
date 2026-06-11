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

const SENTENCE_UNIT_MAX: Record<string, number> = {
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
  if (max !== undefined && v.amount > max) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Amount ${v.amount} exceeds maximum ${max} for unit ${v.unit}`,
    });
  }
});

export const EvidenceTypeEnum = z.enum(['DOCUMENTARY', 'PHYSICAL', 'DIGITAL', 'FORENSIC', 'CIRCUMSTANTIAL']);
export const WitnessRoleEnum = z.enum(['EYEWITNESS', 'EXPERT', 'CHARACTER', 'VICTIM', 'INVESTIGATOR']);
export const BiasIndicatorEnum = z.enum(['PROSECUTION', 'DEFENSE', 'NEUTRAL']);

export const StatuteElementSchema = z.strictObject({
  id: z.string().min(1).max(40),
  description: z.string().max(500).describe("The specific legal requirement or element of the crime that must be proven."),
  isProven: z.boolean().optional().transform((): boolean => false),
});

export const ChargeSchema = z.strictObject({
  id: z.string().min(1).max(40),
  name: z.string().min(1).max(200),
  classification: z.enum(['FELONY', 'MISDEMEANOR', 'INFRACTION']),
  elements: z.array(StatuteElementSchema).min(1),
});

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

export const CaseSchema = z.strictObject({
  caseId: z.string().regex(/^[0-9]{2}-CR-[0-9]{5}$/, "Must be a standard CA format (YY-CR-XXXXX)"),
  defendant: CharacterSchema,
  environment: EnvironmentSchema,

  charges: z.array(ChargeSchema).min(1),
  statuteContexts: z.array(z.string().max(500)).min(1),

  witnesses: z.array(WitnessSchema).min(2),
  evidence: z.array(EvidenceSchema).min(3),

  mandatoryMinimums: z.array(SentenceSchema),
  maximumPenalties: z.array(SentenceSchema),

  summary: z.string().max(1500),
});

export const CasePayloadSchema = CaseSchema;

// ==========================================
// 5. STATE MACHINE SCHEMA
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
export type SecurityPayload = z.infer<typeof BYOKSchema>;
export type CasePayload = z.infer<typeof CasePayloadSchema>;
export type GamePhase = z.infer<typeof GamePhaseSchema>;
export type Environment = z.infer<typeof EnvironmentSchema>;
export type Charge = z.infer<typeof ChargeSchema>;
