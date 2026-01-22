import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../game-store';
import type { CourtCase, CaseOutcome } from '../../types/game';

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

    it('should set current case', () => {
        useGameStore.getState().setCurrentCase(mockCase);
        expect(useGameStore.getState().currentCase).toEqual(mockCase);
    });

    it('should resolve current case and move it to history', () => {
        useGameStore.getState().setCurrentCase(mockCase);
        useGameStore.getState().resolveCurrentCase(mockOutcome);

        const state = useGameStore.getState();
        expect(state.currentCase).toBeNull();
        expect(state.caseHistory).toHaveLength(1);
        expect(state.caseHistory[0]).toMatchObject({
            ...mockCase,
            outcome: mockOutcome,
        });
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
});
