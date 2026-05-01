import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../game-store';
import type { CourtCase, CaseOutcome, TranscriptEntry } from '../../types/game';

// Mock Case Data
const mockCaseWithMotions: CourtCase = {
    case_metadata: {
        docket_number: 'TEST-001',
        charge_level: 'Felony A',
        presiding_judge_reputation_stake: 5,
    },
    defendant: {
        name: 'John Doe',
        demographics: 'Male, 30',
        prior_history: [],
        flight_risk_score: 3,
        public_trust_impact: 'Med',
    },
    charges: [],
    evidence: [],
    witnesses: [],
    game_state: {
        current_stage: 'Motions',
        is_mistrial: false,
        defense_attorney_aggression: 5,
        prosecutor_competence: 5,
    },
    transcript: [],
    motions: [
        {
            id: 'M-001',
            title: 'Motion to Suppress Evidence',
            type: 'Suppression',
            description: 'Defense argues the search was unconstitutional.',
            proposed_order_text: 'The Court orders the evidence suppressed.',
            status: 'Pending',
            merit: true,
        },
        {
            id: 'M-002',
            title: 'Motion to Dismiss',
            type: 'Dismissal',
            description: 'Defense argues lack of probable cause.',
            proposed_order_text: 'The Court dismisses the charge.',
            status: 'Pending',
            merit: false,
        },
    ],
};

const mockCase: CourtCase = {
    case_metadata: {
        docket_number: 'TEST-001',
        charge_level: 'Felony A',
        presiding_judge_reputation_stake: 5,
    },
    defendant: {
        name: 'John Doe',
        demographics: 'Male, 30',
        prior_history: [],
        flight_risk_score: 3,
        public_trust_impact: 'Med',
    },
    charges: [],
    evidence: [],
    witnesses: [],
    game_state: {
        current_stage: 'Trial',
        is_mistrial: false,
        defense_attorney_aggression: 5,
        prosecutor_competence: 5,
    },
    transcript: [],
    motions: [],
};

const mockCaseWithEvidence: CourtCase = {
    case_metadata: {
        docket_number: 'TEST-EVID-001',
        charge_level: 'Felony B',
        presiding_judge_reputation_stake: 7,
    },
    defendant: {
        name: 'Jane Smith',
        demographics: 'Female, 28',
        prior_history: [],
        flight_risk_score: 4,
        public_trust_impact: 'Low',
    },
    charges: [],
    evidence: [
        {
            id: 'E-001',
            description: 'Fingerprint analysis linking defendant to weapon',
            type: 'Physical',
            prosecution_argument: 'Fingerprints prove the defendant handled the weapon.',
            defense_argument: 'Fingerprints could have been transferred via secondary contact.',
            admissibility_status: 'Pending',
            strength: 'High',
        },
        {
            id: 'E-002',
            description: 'Hearsay testimony from neighbor',
            type: 'Testimonial',
            prosecution_argument: 'Neighbor heard the defendant threaten the victim.',
            defense_argument: 'The neighbor was 200 feet away and the statement is hearsay.',
            admissibility_status: 'Pending',
            strength: 'Low',
        },
        {
            id: 'E-003',
            description: 'Surveillance footage from convenience store',
            type: 'Physical',
            prosecution_argument: 'Video shows defendant near the scene at time of incident.',
            defense_argument: 'Video quality is poor; identification is speculative.',
            admissibility_status: 'Pending',
            strength: 'Med',
        },
    ],
    witnesses: [],
    game_state: {
        current_stage: 'Evidence',
        is_mistrial: false,
        defense_attorney_aggression: 6,
        prosecutor_competence: 7,
    },
    transcript: [],
    motions: [],
};

const mockOutcome: CaseOutcome = {
    verdict: 'Guilty',
    sentence: '5 years',
    rationale: 'Evidence was clear',
    public_reaction: 'Positive',
};

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => {
            store[key] = value.toString();
        },
        removeItem: (key: string) => {
            delete store[key];
        },
        clear: () => {
            store = {};
        },
    };
})();

Object.defineProperty(global, 'localStorage', {
    value: localStorageMock,
});

describe('Game Store', () => {
    beforeEach(() => {
        localStorage.clear();
        useGameStore.setState({
            apiKey: null,
            currentCase: null,
            caseHistory: [],
            playerReputation: 100,
            gameStage: 'landing',
            sessionCaseCount: 0,
        });
    });

    it('should initialize with default values', () => {
        const state = useGameStore.getState();
        expect(state.apiKey).toBeNull();
        expect(state.currentCase).toBeNull();
        expect(state.caseHistory).toEqual([]);
        expect(state.playerReputation).toBe(100);
    });

    it('should set API key', () => {
        useGameStore.getState().setApiKey('test-key');
        expect(useGameStore.getState().apiKey).toBe('test-key');
    });

    it('should set current case with transcript entries', () => {
        useGameStore.getState().setCurrentCase(mockCase);
        const currentCase = useGameStore.getState().currentCase!;
        expect(currentCase.case_metadata).toEqual(mockCase.case_metadata);
        expect(currentCase.transcript.length).toBeGreaterThan(0);
    });

    it('should resolve current case and move it to history', () => {
        useGameStore.getState().setCurrentCase(mockCase);
        useGameStore.getState().resolveCurrentCase(mockOutcome);

        const state = useGameStore.getState();
        expect(state.currentCase).toBeNull();
        expect(state.caseHistory).toHaveLength(1);
        expect(state.caseHistory[0].outcome).toEqual(mockOutcome);
        expect(state.caseHistory[0].case_metadata.docket_number).toBe('TEST-001');
    });

    it('should update reputation', () => {
        useGameStore.getState().updateReputation(-10);
        expect(useGameStore.getState().playerReputation).toBe(90);

        useGameStore.getState().updateReputation(20);
        expect(useGameStore.getState().playerReputation).toBe(100);
    });

    it('should prevent reputation from dropping below 0', () => {
        useGameStore.getState().updateReputation(-150);
        expect(useGameStore.getState().playerReputation).toBe(0);
    });

    it('should add transcript entries when setting a case', () => {
        useGameStore.getState().setCurrentCase(mockCase);
        const transcript = useGameStore.getState().currentCase!.transcript;
        expect(transcript.length).toBe(2);
        expect(transcript[0].type).toBe('procedure');
        expect(transcript[0].speaker).toBe('System');
        expect(transcript[0].text).toContain('TEST-001');
        expect(transcript[1].text).toContain('arraignment');
    });

    it('should add transcript entries when submitting arraignment ruling', () => {
        useGameStore.getState().setCurrentCase(mockCase);
        useGameStore.getState().submitArraignmentRuling({
            bailType: 'ROR',
            conditions: [],
            rulingReasoning: 'Low flight risk.',
        });
        const transcript = useGameStore.getState().currentCase!.transcript;
        expect(transcript.length).toBeGreaterThanOrEqual(4);
        const rulingEntries = transcript.filter(e => e.type === 'ruling');
        expect(rulingEntries.length).toBe(2);
        expect(rulingEntries[0].text).toContain('Release on Recognizance');
    });

    it('should add transcript entry via addTranscriptEntry', () => {
        useGameStore.getState().setCurrentCase(mockCase);
        const entry: TranscriptEntry = {
            id: 'test-entry-1',
            speaker: 'Judge',
            text: 'Order in the court.',
            timestamp: new Date().toISOString(),
            type: 'procedure',
        };
        useGameStore.getState().addTranscriptEntry(entry);
        const transcript = useGameStore.getState().currentCase!.transcript;
        expect(transcript).toContainEqual(entry);
    });

    it('should update case stage and add transcript entry via setCaseStage', () => {
        useGameStore.getState().setCurrentCase(mockCase);
        useGameStore.getState().setCaseStage('Motions');
        const currentCase = useGameStore.getState().currentCase!;
        expect(currentCase.game_state.current_stage).toBe('Motions');
        const lastEntry = currentCase.transcript[currentCase.transcript.length - 1];
        expect(lastEntry.type).toBe('procedure');
        expect(lastEntry.text).toContain('motions');
    });

    it('should grant a meritorious motion and increase reputation', () => {
        useGameStore.getState().setCurrentCase(mockCaseWithMotions);
        useGameStore.getState().ruleMotion('M-001', 'Granted', 'Defense arguments are valid.');
        const currentCase = useGameStore.getState().currentCase!;
        expect(currentCase.motions[0].status).toBe('Granted');
        expect(currentCase.motions[0].final_ruling_text).toBe('Defense arguments are valid.');
        expect(useGameStore.getState().playerReputation).toBe(100); // capped at max
        expect(currentCase.transcript.length).toBeGreaterThan(0);
    });

    it('should deny a non-meritorious motion and increase reputation', () => {
        useGameStore.getState().setCurrentCase(mockCaseWithMotions);
        useGameStore.getState().ruleMotion('M-002', 'Denied', 'Probable cause is established.');
        const currentCase = useGameStore.getState().currentCase!;
        expect(currentCase.motions[1].status).toBe('Denied');
        expect(useGameStore.getState().playerReputation).toBe(100); // capped at max
    });

    it('should advance to Evidence stage when all motions ruled', () => {
        useGameStore.getState().setCurrentCase(mockCaseWithMotions);
        useGameStore.getState().ruleMotion('M-001', 'Granted', 'Valid.');
        useGameStore.getState().ruleMotion('M-002', 'Denied', 'PC established.');
        const currentCase = useGameStore.getState().currentCase!;
        expect(currentCase.game_state.current_stage).toBe('Evidence');
    });

    describe('ruleEvidence', () => {
        it('should admit strong evidence and increase reputation', () => {
            useGameStore.setState({ playerReputation: 90 });
            useGameStore.getState().setCurrentCase(mockCaseWithEvidence);
            useGameStore.getState().ruleEvidence('E-001', 'Admitted', 'Fingerprints are reliable identification.');
            const currentCase = useGameStore.getState().currentCase!;
            expect(currentCase.evidence[0].admissibility_status).toBe('Admitted');
            expect(currentCase.evidence[0].ruling_reasoning).toBe('Fingerprints are reliable identification.');
            expect(useGameStore.getState().playerReputation).toBe(95);
        });

        it('should suppress strong evidence and decrease reputation', () => {
            useGameStore.setState({ playerReputation: 90 });
            useGameStore.getState().setCurrentCase(mockCaseWithEvidence);
            useGameStore.getState().ruleEvidence('E-001', 'Suppressed', 'Chain of custody issues.');
            const currentCase = useGameStore.getState().currentCase!;
            expect(currentCase.evidence[0].admissibility_status).toBe('Suppressed');
            expect(useGameStore.getState().playerReputation).toBe(80);
        });

        it('should suppress weak evidence and increase reputation', () => {
            useGameStore.setState({ playerReputation: 90 });
            useGameStore.getState().setCurrentCase(mockCaseWithEvidence);
            useGameStore.getState().ruleEvidence('E-002', 'Suppressed', 'Hearsay is inadmissible.');
            const currentCase = useGameStore.getState().currentCase!;
            expect(currentCase.evidence[1].admissibility_status).toBe('Suppressed');
            expect(useGameStore.getState().playerReputation).toBe(92);
        });

        it('should admit weak evidence and decrease reputation', () => {
            useGameStore.setState({ playerReputation: 90 });
            useGameStore.getState().setCurrentCase(mockCaseWithEvidence);
            useGameStore.getState().ruleEvidence('E-002', 'Admitted', 'Relevant to the case.');
            const currentCase = useGameStore.getState().currentCase!;
            expect(currentCase.evidence[1].admissibility_status).toBe('Admitted');
            expect(useGameStore.getState().playerReputation).toBe(85);
        });

        it('should admit medium evidence and moderately increase reputation', () => {
            useGameStore.setState({ playerReputation: 90 });
            useGameStore.getState().setCurrentCase(mockCaseWithEvidence);
            useGameStore.getState().ruleEvidence('E-003', 'Admitted', 'Video is probative.');
            const currentCase = useGameStore.getState().currentCase!;
            expect(currentCase.evidence[2].admissibility_status).toBe('Admitted');
            expect(useGameStore.getState().playerReputation).toBe(93);
        });

        it('should suppress medium evidence and moderately decrease reputation', () => {
            useGameStore.setState({ playerReputation: 90 });
            useGameStore.getState().setCurrentCase(mockCaseWithEvidence);
            useGameStore.getState().ruleEvidence('E-003', 'Suppressed', 'Quality too poor.');
            const currentCase = useGameStore.getState().currentCase!;
            expect(currentCase.evidence[2].admissibility_status).toBe('Suppressed');
            expect(useGameStore.getState().playerReputation).toBe(83);
        });

        it('should add transcript entries when ruling on evidence', () => {
            useGameStore.getState().setCurrentCase(mockCaseWithEvidence);
            useGameStore.getState().ruleEvidence('E-001', 'Admitted', 'Fingerprints are reliable.');
            const currentCase = useGameStore.getState().currentCase!;
            const transcript = currentCase.transcript;
            const rulingEntries = transcript.filter(e => e.type === 'ruling');
            expect(rulingEntries.length).toBeGreaterThanOrEqual(1);
            expect(rulingEntries[rulingEntries.length - 1].text).toContain('Admitted');
        });

        it('should advance to Verdict stage when all evidence is ruled upon', () => {
            useGameStore.getState().setCurrentCase(mockCaseWithEvidence);
            useGameStore.getState().ruleEvidence('E-001', 'Admitted', 'Fingerprints are reliable.');
            useGameStore.getState().ruleEvidence('E-002', 'Suppressed', 'Hearsay is inadmissible.');
            useGameStore.getState().ruleEvidence('E-003', 'Admitted', 'Video is probative.');
            const currentCase = useGameStore.getState().currentCase!;
            expect(currentCase.game_state.current_stage).toBe('Verdict');
            const lastEntry = currentCase.transcript[currentCase.transcript.length - 1];
            expect(lastEntry.text).toContain('verdict');
        });

        it('should not advance to Verdict stage when some evidence is still pending', () => {
            useGameStore.getState().setCurrentCase(mockCaseWithEvidence);
            useGameStore.getState().ruleEvidence('E-001', 'Admitted', 'Fingerprints are reliable.');
            const currentCase = useGameStore.getState().currentCase!;
            expect(currentCase.game_state.current_stage).toBe('Evidence');
        });

        it('should cap reputation at 100', () => {
            useGameStore.setState({ playerReputation: 98 });
            useGameStore.getState().setCurrentCase(mockCaseWithEvidence);
            useGameStore.getState().ruleEvidence('E-001', 'Admitted', 'Fingerprints are reliable.');
            expect(useGameStore.getState().playerReputation).toBe(100);
        });

        it('should cap reputation at 0', () => {
            useGameStore.setState({ playerReputation: 5 });
            useGameStore.getState().setCurrentCase(mockCaseWithEvidence);
            useGameStore.getState().ruleEvidence('E-001', 'Suppressed', 'Chain of custody issues.');
            expect(useGameStore.getState().playerReputation).toBe(0);
        });

        it('should prevent re-ruling on already-ruled evidence', () => {
            useGameStore.setState({ playerReputation: 90 });
            useGameStore.getState().setCurrentCase(mockCaseWithEvidence);
            useGameStore.getState().ruleEvidence('E-001', 'Admitted', 'Admitted.');
            useGameStore.getState().ruleEvidence('E-001', 'Suppressed', 'Chain of custody.');
            const currentCase = useGameStore.getState().currentCase!;
            expect(currentCase.evidence[0].admissibility_status).toBe('Admitted');
            expect(currentCase.evidence[0].ruling_reasoning).toBe('Admitted.');
            expect(useGameStore.getState().playerReputation).toBe(95);
        });
    });

    describe('submitVerdict', () => {
        const mockCaseWithCharges: CourtCase = {
            case_metadata: { docket_number: 'TEST-VERDICT-001', charge_level: 'Felony', presiding_judge_reputation_stake: 5 },
            defendant: { name: 'Alex Roe', demographics: 'Male, 40', prior_history: [], flight_risk_score: 5, public_trust_impact: 'Med' },
            charges: [
                { code: 'C-001', description: 'Armed Robbery', min_sentence_months: 60, max_sentence_months: 120, severity: 'High' },
                { code: 'C-002', description: 'Petty Theft', min_sentence_months: 1, max_sentence_months: 6, severity: 'Low' },
            ],
            evidence: [
                { id: 'E-001', description: 'DNA evidence', type: 'Physical', prosecution_argument: 'DNA match', defense_argument: 'Contaminated', admissibility_status: 'Admitted' as const, strength: 'High' as const },
                { id: 'E-002', description: 'Video footage', type: 'Physical', prosecution_argument: 'Shows defendant', defense_argument: 'Poor quality', admissibility_status: 'Admitted' as const, strength: 'Med' as const },
            ],
            witnesses: [],
            game_state: { current_stage: 'Verdict', is_mistrial: false, defense_attorney_aggression: 5, prosecutor_competence: 5 },
            transcript: [],
            motions: [],
        };

        const mockCaseWeakEvidence: CourtCase = {
            case_metadata: { docket_number: 'TEST-VERDICT-002', charge_level: 'Misdemeanor', presiding_judge_reputation_stake: 3 },
            defendant: { name: 'Jane Roe', demographics: 'Female, 25', prior_history: [], flight_risk_score: 2, public_trust_impact: 'Low' },
            charges: [
                { code: 'C-001', description: 'Armed Robbery', min_sentence_months: 60, max_sentence_months: 120, severity: 'High' },
            ],
            evidence: [
                { id: 'E-001', description: 'Weak testimony', type: 'Testimonial', prosecution_argument: 'Witness saw it', defense_argument: 'Unreliable', admissibility_status: 'Admitted' as const, strength: 'Low' as const },
                { id: 'E-002', description: 'Hearsay', type: 'Testimonial', prosecution_argument: 'Rumor', defense_argument: 'Hearsay', admissibility_status: 'Suppressed' as const, strength: 'Med' as const },
            ],
            witnesses: [],
            game_state: { current_stage: 'Verdict', is_mistrial: false, defense_attorney_aggression: 5, prosecutor_competence: 5 },
            transcript: [],
            motions: [],
        };

        it('should submit Guilty verdict with strong evidence and increase reputation', () => {
            useGameStore.setState({ playerReputation: 80 });
            useGameStore.getState().setCurrentCase(mockCaseWithCharges);
            useGameStore.getState().submitVerdict([
                { chargeId: 'C-001', verdict: 'Guilty', reasoning: 'Overwhelming evidence of armed robbery.' },
                { chargeId: 'C-002', verdict: 'Guilty', reasoning: 'Clear video evidence.' },
            ]);
            const currentCase = useGameStore.getState().currentCase!;
            expect(currentCase.verdict_rulings).toHaveLength(2);
            expect(currentCase.game_state.current_stage).toBe('Sentencing');
            expect(useGameStore.getState().gameStage).toBe('sentencing');
            expect(useGameStore.getState().playerReputation).toBe(95);
            expect(currentCase.transcript.some(e => e.text.includes('Verdict on charge C-001: Guilty'))).toBe(true);
        });

        it('should submit Not Guilty verdict with weak evidence and increase reputation', () => {
            useGameStore.setState({ playerReputation: 80 });
            useGameStore.getState().setCurrentCase(mockCaseWeakEvidence);
            useGameStore.getState().submitVerdict([
                { chargeId: 'C-001', verdict: 'Not Guilty', reasoning: 'Prosecution failed to prove beyond reasonable doubt.' },
            ]);
        expect(useGameStore.getState().playerReputation).toBe(90);
        expect(useGameStore.getState().currentCase!.game_state.current_stage).toBe('Sentencing');
        });

        it('should submit Not Guilty verdict with strong evidence and decrease reputation', () => {
            useGameStore.setState({ playerReputation: 90 });
            useGameStore.getState().setCurrentCase(mockCaseWithCharges);
            useGameStore.getState().submitVerdict([
                { chargeId: 'C-001', verdict: 'Not Guilty', reasoning: 'Prosecution failed to prove beyond reasonable doubt.' },
            ]);
            expect(useGameStore.getState().playerReputation).toBe(75);
        });

        it('should submit No Contest verdict with neutral reputation', () => {
            useGameStore.setState({ playerReputation: 50 });
            useGameStore.getState().setCurrentCase(mockCaseWithCharges);
            useGameStore.getState().submitVerdict([
                { chargeId: 'C-001', verdict: 'No Contest', reasoning: 'Defendant accepts penalty without admitting guilt.' },
            ]);
            expect(useGameStore.getState().playerReputation).toBe(53);
        });

        it('should trigger gameover when reputation drops to 0', () => {
            useGameStore.setState({ playerReputation: 10 });
            useGameStore.getState().setCurrentCase(mockCaseWithCharges);
            useGameStore.getState().submitVerdict([
                { chargeId: 'C-001', verdict: 'Not Guilty', reasoning: 'Insufficient evidence.' },
            ]);
            expect(useGameStore.getState().playerReputation).toBe(0);
            expect(useGameStore.getState().gameStage).toBe('gameover');
        });
    });

    describe('submitSentence', () => {
        const mockCaseForSentencing: CourtCase = {
            case_metadata: { docket_number: 'TEST-SENT-001', charge_level: 'Felony', presiding_judge_reputation_stake: 5 },
            defendant: { name: 'Sam Doe', demographics: 'Male, 35', prior_history: [], flight_risk_score: 5, public_trust_impact: 'Med' },
            charges: [
                { code: 'C-001', description: 'Burglary', min_sentence_months: 12, max_sentence_months: 36, severity: 'Med' },
            ],
            evidence: [],
            witnesses: [],
            game_state: { current_stage: 'Sentencing', is_mistrial: false, defense_attorney_aggression: 5, prosecutor_competence: 5 },
            transcript: [],
            motions: [],
            verdict_rulings: [{ chargeId: 'C-001', verdict: 'Guilty', reasoning: 'Proven beyond doubt.' }],
        };

        it('should submit sentence within range and increase reputation', () => {
            useGameStore.setState({ playerReputation: 80 });
            useGameStore.getState().setCurrentCase(mockCaseForSentencing);
            useGameStore.getState().submitSentence({ months: 24, conditions: ['Probation'], reasoning: 'Within statutory guidelines.' });
            const currentCase = useGameStore.getState().currentCase!;
            expect(currentCase.sentence_ruling).toEqual({ months: 24, conditions: ['Probation'], reasoning: 'Within statutory guidelines.' });
            expect(currentCase.game_state.current_stage).toBe('Outcome');
            expect(useGameStore.getState().playerReputation).toBe(85); // 80+5
        });

        it('should submit sentence outside range and decrease reputation', () => {
            useGameStore.setState({ playerReputation: 80 });
            useGameStore.getState().setCurrentCase(mockCaseForSentencing);
            useGameStore.getState().submitSentence({ months: 6, conditions: [], reasoning: 'Mitigating circumstances.' });
            expect(useGameStore.getState().playerReputation).toBe(72); // 80-8
            expect(useGameStore.getState().currentCase!.game_state.current_stage).toBe('Outcome');
        });

        it('should allow zero-month sentence when no guilty verdicts', () => {
            const caseNoGuilty: CourtCase = {
                ...mockCaseForSentencing,
                verdict_rulings: [{ chargeId: 'C-001', verdict: 'Not Guilty', reasoning: 'Acquitted.' }],
            };
            useGameStore.setState({ playerReputation: 80 });
            useGameStore.getState().setCurrentCase(caseNoGuilty);
            useGameStore.getState().submitSentence({ months: 0, conditions: [], reasoning: 'Defendant acquitted.' });
            expect(useGameStore.getState().currentCase!.sentence_ruling!.months).toBe(0);
            expect(useGameStore.getState().currentCase!.game_state.current_stage).toBe('Outcome');
        });
    });
});
