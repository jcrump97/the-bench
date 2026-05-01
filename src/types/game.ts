export interface ChargeVerdict {
    chargeId: string;
    verdict: 'Guilty' | 'Not Guilty' | 'No Contest';
    reasoning: string;
}

export interface SentenceRuling {
    months: number;
    conditions: string[];
    reasoning: string;
}

export interface CaseOutcome {
    verdict: string;
    sentence?: string;
    rationale: string;
    public_reaction: string;
}

export interface CaseMetadata {
    docket_number: string;
    charge_level: string;
    presiding_judge_reputation_stake: number;
}

export interface Defendant {
    name: string;
    demographics: string;
    prior_history: string[];
    flight_risk_score: number;
    public_trust_impact: 'High' | 'Med' | 'Low';
}

export interface Charge {
    code: string;
    description: string;
    min_sentence_months: number;
    max_sentence_months: number;
    severity?: 'Low' | 'Med' | 'High';
}

export interface Evidence {
    id: string;
    description: string;
    type: string;
    prosecution_argument: string;
    defense_argument: string;
    admissibility_status: 'Pending' | 'Admitted' | 'Suppressed';
    ruling_reasoning?: string;
    strength: 'Low' | 'Med' | 'High';
}

export interface Witness {
    id: string;
    name: string;
    role: string;
    credibility_score: number;
    key_testimony: string;
}

export interface GameState {
    current_stage: string;
    is_mistrial: boolean;
    defense_attorney_aggression: number;

    prosecutor_competence: number;
    presiding_judge_reputation?: number;
}

export interface CourtCase {
    case_metadata: CaseMetadata;
    defendant: Defendant;
    charges: Charge[];
    evidence: Evidence[];
    witnesses: Witness[];
    game_state: GameState;
    outcome?: CaseOutcome;
    arraignment_ruling?: ArraignmentRuling;
    verdict_rulings?: ChargeVerdict[];
    sentence_ruling?: SentenceRuling;
    transcript: TranscriptEntry[];
    motions: Motion[];
}

export interface TranscriptEntry {
    id: string;
    speaker: string;
    text: string;
    timestamp: string;
    type: 'testimony' | 'ruling' | 'procedure';
}

export interface ArraignmentRuling {
    bailType?: "ROR" | "Cash" | "Remand";
    bailAmount?: number;
    conditions: string[];
    rulingReasoning: string;
}

export interface Motion {
    id: string;
    title: string;
    type: "Suppression" | "Dismissal" | "Limine";
    description: string;
    proposed_order_text: string;
    status: "Pending" | "Granted" | "Denied" | "Modified";
    final_ruling_text?: string;
    merit: boolean;
}
