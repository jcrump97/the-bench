import { z } from 'zod';

export const CaseOutcomeSchema = z.object({
    verdict: z.string(),
    sentence: z.string().optional(),
    rationale: z.string(),
    public_reaction: z.string(),
});

export const CaseMetadataSchema = z.object({
    docket_number: z.string(),
    charge_level: z.string(),
    presiding_judge_reputation_stake: z.number().int().min(1).max(10),
});

export const DefendantSchema = z.object({
    name: z.string(),
    demographics: z.string(),
    prior_history: z.array(z.string()),
    flight_risk_score: z.number().int().min(1).max(10),
    public_trust_impact: z.enum(['High', 'Med', 'Low']),
});

export const ChargeSchema = z.object({
    code: z.string(),
    description: z.string(),
    min_sentence_months: z.number().int(),
    max_sentence_months: z.number().int(),
});

export const EvidenceSchema = z.object({
    id: z.string(),
    description: z.string(),
    type: z.string(),
    prosecution_argument: z.string(),
    defense_argument: z.string(),
    admissibility_status: z.enum(['Pending', 'Admitted', 'Suppressed']),
});

export const WitnessSchema = z.object({
    id: z.string(),
    name: z.string(),
    role: z.string(),
    credibility_score: z.number().int().min(1).max(10),
    key_testimony: z.string(),
});

export const GameStateSchema = z.object({
    current_stage: z.string(),
    is_mistrial: z.boolean(),
    defense_attorney_aggression: z.number().int().min(1).max(10),
    prosecutor_competence: z.number().int().min(1).max(10),
    presiding_judge_reputation: z.number().optional(),
});

export const CourtCaseSchema = z.object({
    case_metadata: CaseMetadataSchema,
    defendant: DefendantSchema,
    charges: z.array(ChargeSchema),
    evidence: z.array(EvidenceSchema),
    witnesses: z.array(WitnessSchema),
    game_state: GameStateSchema,
    transcript: z.array(z.object({
        id: z.string(),
        speaker: z.string(),
        text: z.string(),
        timestamp: z.string(),
        type: z.enum(['testimony', 'ruling', 'procedure'])
    })).default([]),
    outcome: CaseOutcomeSchema.optional(),
});
