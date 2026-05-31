import { z } from 'zod';

// ==========================================
// 1. SECURITY PERIMETER
// ==========================================
export const BYOKSchema = z.discriminatedUnion("isDemo", [
  z.object({
    isDemo: z.literal(false),
    apiKey: z.string().min(30, "Invalid API Key").startsWith("AIza", "Must be a valid Gemini key"),
  }),
  z.object({
    isDemo: z.literal(true),
    apiKey: z.string().optional(),
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

export const SentenceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal('PRISON'),            unit: z.enum(['YEARS', 'MONTHS', 'DAYS']), amount: z.number().int().positive() }),
  z.object({ type: z.literal('JAIL'),              unit: z.enum(['YEARS', 'MONTHS', 'DAYS']), amount: z.number().int().positive() }),
  z.object({ type: z.literal('FINE'),              unit: z.literal('DOLLARS'),               amount: z.number().int().positive() }),
  z.object({ type: z.literal('COMMUNITY_SERVICE'), unit: z.literal('HOURS'),                 amount: z.number().int().positive() }),
  z.object({ type: z.literal('PROBATION'),         unit: z.enum(['YEARS', 'MONTHS']),        amount: z.number().int().positive(), conditions: z.array(ProbationConditionEnum).min(1) }),
]);

export const EvidenceTypeEnum = z.enum(['DOCUMENTARY', 'PHYSICAL', 'DIGITAL', 'FORENSIC', 'CIRCUMSTANTIAL']);
export const WitnessRoleEnum = z.enum(['EYEWITNESS', 'EXPERT', 'CHARACTER', 'VICTIM', 'INVESTIGATOR']);
export const BiasIndicatorEnum = z.enum(['PROSECUTION', 'DEFENSE', 'NEUTRAL']);
export const StatuteElementSchema = z.object({
  id: z.string().uuid(),
  description: z.string().describe("The specific legal requirement or element of the crime that must be proven."),
  isProven: z.boolean().default(false)
}).strict();
export const ChargeSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  classification: z.enum(['FELONY', 'MISDEMEANOR', 'INFRACTION']),
  elements: z.array(StatuteElementSchema).min(1)
}).strict();
export const WitnessSchema = z.object({
  id: z.string().uuid(),
  name: z.string().describe("Full fictional name. Do not include race or protected demographics."),
  role: WitnessRoleEnum,
  bias: BiasIndicatorEnum,
  statement: z.string().max(1000).describe("A summary of their expected testimony."),
  credibilityScore: z.number().min(1).max(10)
}).strict();
export const EvidenceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(3).max(100),
  type: EvidenceTypeEnum,
  description: z.string().max(600).describe("A purely factual, objective description of the item."),
  relevanceScore: z.number().min(1).max(10).describe("Scale of 1-10 on impact to the case."),
  objectionRisk: z.enum(['LOW', 'MEDIUM', 'HIGH']).describe("Likelihood of opposing counsel objecting. Used by the player to determine if they should attempt admission."),
  targetElementId: z.string().uuid().nullable().describe("The ID of the StatuteElement this evidence is meant to prove."),
  isAdmitted: z.boolean().default(false).describe("Always initialized to false. Mutated by player action during the trial phase.")
}).strict();

// ==========================================
// 3. DEMOGRAPHICS & CHARACTER ENTITIES
// ==========================================
export const PastConvictionSchema = z.object({
  chargeName: z.string(),
  year: z.number().int().min(1900).max(new Date().getFullYear()),
  sentences: z.array(SentenceSchema),
});

export const SubstanceAbuseSchema = z.object({
  substance: z.string(),
  status: z.enum(['ACTIVE', 'IN_RECOVERY', 'NONE_REPORTED']),
});

export const CharacterSchema = z.object({
  firstName: z.string().max(50),
  lastName: z.string().max(50),
  age: z.number().int().min(18).max(120),

  demographics: z.object({
    relationshipStatus: z.enum(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED']),
    children: z.number().int().min(0).max(30),
    employmentStatus: z.enum(['EMPLOYED', 'UNEMPLOYED', 'STUDENT', 'RETIRED']),
    educationLevel: z.enum(['SOME_HIGH_SCHOOL', 'HIGH_SCHOOL', 'COLLEGE', 'ADVANCED_DEGREE']),
    substanceAbuseHistory: z.array(SubstanceAbuseSchema),
  }),

  pastConvictions: z.array(PastConvictionSchema),

  oceanTraits: z.object({
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
export const EnvironmentSchema = z.object({
  locationType: z.enum(['RESIDENTIAL', 'COMMERCIAL', 'PUBLIC_SPACE', 'VEHICLE', 'DIGITAL']),
  timeOfDay: z.enum(['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT']),
  weather: z.enum(['CLEAR', 'RAIN', 'FOG', 'SNOW', 'N/A']),
  description: z.string().max(500),
});

export const CaseSchema = z.object({
  caseId: z.string().regex(/^[0-9]{2}-CR-[0-9]{5}$/, "Must be a standard CA format (YY-CR-XXXXX)"),
  defendant: CharacterSchema,
  environment: EnvironmentSchema,

  charges: z.array(ChargeSchema).min(1),
  statuteContexts: z.array(z.string()).min(1),

  witnesses: z.array(WitnessSchema).min(2),
  evidence: z.array(EvidenceSchema).min(3),

  mandatoryMinimums: z.array(SentenceSchema),
  maximumPenalties: z.array(SentenceSchema),

  summary: z.string().max(1500),
}).strict();
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
