import { describe, it, expect } from 'vitest';
import { CourtCaseSchema, CaseOutcomeSchema } from '../schemas';

describe('Gemini Schemas', () => {
    it('should validate a valid CourtCase object', () => {
        const validCase = {
            case_metadata: {
                docket_number: 'CR-2024-001',
                charge_level: 'Felony B',
                presiding_judge_reputation_stake: 5,
            },
            defendant: {
                name: 'Jane Doe',
                demographics: 'Female, 40',
                prior_history: ['Theft'],
                flight_risk_score: 2,
                public_trust_impact: 'Low',
            },
            charges: [
                {
                    code: '123.45',
                    description: 'Grand Theft',
                    min_sentence_months: 12,
                    max_sentence_months: 60,
                },
            ],
            evidence: [
                {
                    id: 'E1',
                    description: 'Video',
                    type: 'Physical',
                    prosecution_argument: 'Shows guilt',
                    defense_argument: 'Blurry',
                    admissibility_status: 'Pending',
                },
            ],
            witnesses: [
                {
                    id: 'W1',
                    name: 'Bob',
                    role: 'Witness',
                    credibility_score: 8,
                    key_testimony: 'I saw it',
                },
            ],
            game_state: {
                current_stage: 'Arraignment',
                is_mistrial: false,
                defense_attorney_aggression: 3,
                prosecutor_competence: 7,
            },
        };

        const result = CourtCaseSchema.safeParse(validCase);
        expect(result.success).toBe(true);
    });

    it('should reject an invalid CourtCase object', () => {
        const invalidCase = {
            case_metadata: {
                docket_number: 123, // Should be string
            },
        };
        const result = CourtCaseSchema.safeParse(invalidCase);
        expect(result.success).toBe(false);
    });

    it('should validate a valid CaseOutcome object', () => {
        const validOutcome = {
            verdict: 'Guilty',
            sentence: '10 years',
            rationale: 'Solid evidence',
            public_reaction: 'Mixed',
        };
        const result = CaseOutcomeSchema.safeParse(validOutcome);
        expect(result.success).toBe(true);
    });
});
