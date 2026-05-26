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
  z.object({
    type: z.enum(['PRISON', 'JAIL', 'FINE', 'COMMUNITY_SERVICE']),
    unit: z.enum(['YEARS', 'MONTHS', 'DAYS', 'HOURS', 'DOLLARS']),
    amount: z.number().int().positive(),
  }),
  z.object({
    type: z.literal('PROBATION'),
    unit: z.enum(['YEARS', 'MONTHS']),
    amount: z.number().int().positive(),
    conditions: z.array(ProbationConditionEnum).min(1),
  })
]);

export const ChargeSchema = z.object({
  statuteId: z.string(), // e.g., "CA Penal Code § 459"
  name: z.string(),      // e.g., "Burglary in the Second Degree"
  class: z.enum(['INFRACTION', 'MISDEMEANOR', 'FELONY']),
  counts: z.number().int().positive().default(1),
});

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
  firstName: z.string(),
  lastName: z.string(),
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
  description: z.string(), 
});

export const CasePayloadSchema = z.object({
  caseId: z.string().regex(/^[0-9]{2}-CR-[0-9]{5}$/, "Must be a standard CA format (YY-CR-XXXXX)"),
  defendant: CharacterSchema,
  environment: EnvironmentSchema,
  
  charges: z.array(ChargeSchema).min(1),
  statuteContexts: z.array(z.string()).min(1),
  
  // TODO: Define WitnessSchema
  witnesses: z.array(z.any()).default([]), 
  // TODO: Define EvidenceSchema
  evidence: z.array(z.any()).default([]),  
  
  mandatoryMinimums: z.array(SentenceSchema), 
  maximumPenalties: z.array(SentenceSchema), 
  
  summary: z.string(),
});

// ==========================================
// 5. STATE MACHINE SCHEMA
// ==========================================
export const GamePhaseSchema = z.enum([
  'WELCOME', 
  'ACT_1_INTAKE', 
  'ACT_2_MOTIONS', 
  'ACT_3_VERDICT', 
  'END_STATE'
]);

// ==========================================
// TYPE EXPORTS
// ==========================================
export type SecurityPayload = z.infer<typeof BYOKSchema>;
export type CasePayload = z.infer<typeof CasePayloadSchema>;
export type GamePhase = z.infer<typeof GamePhaseSchema>;
export type Environment = z.infer<typeof EnvironmentSchema>;
export type Charge = z.infer<typeof ChargeSchema>;
