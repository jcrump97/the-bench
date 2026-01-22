import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import type { CourtCase, CaseOutcome, ArraignmentRuling } from '../types/game';

interface GameState {
    apiKey: string | null;
    currentCase: CourtCase | null;
    caseHistory: CourtCase[];
    playerReputation: number;
    gameStage: 'intro' | 'active' | 'scoring';

    setApiKey: (key: string) => void;
    setCurrentCase: (caseData: CourtCase) => void;
    resolveCurrentCase: (outcome: CaseOutcome) => void;
    submitArraignmentRuling: (ruling: ArraignmentRuling) => void;
    updateReputation: (amount: number) => void;
    setGameStage: (stage: 'intro' | 'active' | 'scoring') => void;
}

export const useGameStore = create<GameState>()(
    devtools(
        persist(
            (set) => ({
                apiKey: null,
                currentCase: null,
                caseHistory: [],
                playerReputation: 100,
                gameStage: 'intro',

                setApiKey: (key) => set({ apiKey: key }),

                setCurrentCase: (caseData) => set({ currentCase: caseData }),

                resolveCurrentCase: (outcome) =>
                    set((state) => {
                        if (!state.currentCase) return state;

                        const completedCase: CourtCase = {
                            ...state.currentCase,
                            outcome,
                        };

                        return {
                            currentCase: null,
                            caseHistory: [...state.caseHistory, completedCase],
                        };
                    }),

                submitArraignmentRuling: (ruling) =>
                    set((state) => {
                        if (!state.currentCase) return state;
                        return {
                            currentCase: {
                                ...state.currentCase,
                                arraignment_ruling: ruling
                            }
                        };
                    }),

                updateReputation: (amount) =>
                    set((state) => ({
                        playerReputation: Math.max(0, state.playerReputation + amount),
                    })),

                setGameStage: (stage) => set({ gameStage: stage }),
            }),
            {
                name: 'the-bench-storage',
                partialize: (state) => ({
                    apiKey: state.apiKey,
                    caseHistory: state.caseHistory,
                    playerReputation: state.playerReputation,
                    // currentCase and gameStage might not be desirable to persist across hard reloads depending on UX,
                    // but for now we follow the general "persist data layer" instruction.
                    // If the user wants a fresh start on reload for the active case, we might exclude it.
                    // However, to resume a session, persisting everything is usually safer.
                    currentCase: state.currentCase,
                    gameStage: state.gameStage,
                }),
            }
        )
    )
);
