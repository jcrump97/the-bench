import { create } from 'zustand';
import {
  GamePhaseSchema,
  CasePayloadSchema,
  type GamePhase,
  type CasePayload,
} from '../schemas/gameSchemas';

interface GameState {
  currentPhase: GamePhase;
  activeCase: CasePayload | null;

  setPhase: (phase: GamePhase) => void;
  setActiveCase: (caseData: CasePayload) => void;
  resetGameState: () => void;
}

const INITIAL_STATE: Pick<GameState, 'currentPhase' | 'activeCase'> = {
  currentPhase: 'WELCOME',
  activeCase: null,
};

export const useGameStore = create<GameState>((set) => ({
  ...INITIAL_STATE,

  setPhase: (phase) => {
    const validated = GamePhaseSchema.parse(phase);
    set({ currentPhase: validated });
  },

  setActiveCase: (caseData) => {
    const validated = CasePayloadSchema.parse(caseData);
    set({ activeCase: validated });
  },

  resetGameState: () => set({ ...INITIAL_STATE }),
}));
