import type { CourtCase } from '../types/game';

export const MOCK_ACTIVE_CASE: CourtCase = {
    case_metadata: {
        docket_number: "CR-2026-MOCK",
        charge_level: "Felony Class B",
        presiding_judge_reputation_stake: 5
    },
    defendant: {
        name: "John Doe",
        demographics: "34yo Male, Machinist",
        prior_history: ["2022 - DUI - Convicted"],
        flight_risk_score: 5,
        public_trust_impact: "Med" as const,
    },
    charges: [{
        code: "13A-6-2",
        description: "Assault 2nd Degree",
        min_sentence_months: 12,
        max_sentence_months: 60
    }],
    evidence: [],
    witnesses: [],
    game_state: {
        current_stage: "Trial", // This triggers JudicialLayout
        is_mistrial: false,
        defense_attorney_aggression: 5,
        prosecutor_competence: 5,
        presiding_judge_reputation: 100
    },
    transcript: [],
    motions: []
};
