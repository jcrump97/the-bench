import { z } from 'zod';

export const ChargeVerdictSchema = z.object({
    chargeId: z.string(),
    verdict: z.enum(['Guilty', 'Not Guilty', 'No Contest']),
    reasoning: z.string(),
});

export const SentenceRulingSchema = z.object({
    months: z.number().int(),
    conditions: z.array(z.string()),
    reasoning: z.string(),
});

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
    severity: z.enum(['Low', 'Med', 'High']).optional(),
});

export const EvidenceSchema = z.object({
    id: z.string(),
    description: z.string(),
    type: z.string(),
    prosecution_argument: z.string(),
    defense_argument: z.string(),
    admissibility_status: z.enum(['Pending', 'Admitted', 'Suppressed']),
    ruling_reasoning: z.string().optional(),
    strength: z.enum(['Low', 'Med', 'High']),
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

export const ArraignmentRulingSchema = z.object({
    bailType: z.enum(['ROR', 'Cash', 'Remand']),
    bailAmount: z.number().int().optional(),
    conditions: z.array(z.string()),
    rulingReasoning: z.string(),
});

export const TranscriptEntrySchema = z.object({
    id: z.string(),
    speaker: z.string(),
    text: z.string(),
    timestamp: z.string(),
    type: z.enum(['testimony', 'ruling', 'procedure']),
});

export const MotionSchema = z.object({
    id: z.string(),
    title: z.string(),
    type: z.enum(['Suppression', 'Dismissal', 'Limine']),
    description: z.string(),
    proposed_order_text: z.string(),
    status: z.enum(['Pending', 'Granted', 'Denied', 'Modified']),
    final_ruling_text: z.string().optional(),
    merit: z.boolean(),
});

export const CourtCaseSchema = z.object({
    case_metadata: CaseMetadataSchema,
    defendant: DefendantSchema,
    charges: z.array(ChargeSchema),
    evidence: z.array(EvidenceSchema),
    witnesses: z.array(WitnessSchema),
    game_state: GameStateSchema,
    transcript: z.array(TranscriptEntrySchema).default([]),
    motions: z.array(MotionSchema).default([]),
    outcome: CaseOutcomeSchema.optional(),
    arraignment_ruling: ArraignmentRulingSchema.optional(),
    verdict_rulings: z.array(ChargeVerdictSchema).optional(),
    sentence_ruling: SentenceRulingSchema.optional(),
});

export const ResolvedCaseSchema = CourtCaseSchema.extend({
    outcome: CaseOutcomeSchema,
    verdict_rulings: z.array(ChargeVerdictSchema),
    sentence_ruling: SentenceRulingSchema,
});
