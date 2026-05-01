import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../game-store';
import type { CourtCase, CaseOutcome, TranscriptEntry } from '../../types/game';

// Mock Case Data
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
            gameStage: 'intro',
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
        expect(useGameStore.getState().playerReputation).toBe(110);
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
});
