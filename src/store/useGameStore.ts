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

function logValidationFailure(error: unknown): void {
  console.error('State validation failed');
  if (import.meta.env.DEV) {
    console.error(error);
  }
}

export const useGameStore = create<GameState>((set) => ({
  ...INITIAL_STATE,

  setPhase: (phase) => {
    const result = GamePhaseSchema.safeParse(phase);
    if (!result.success) {
      logValidationFailure(result.error);
      set({ currentPhase: 'ERROR_STATE', activeCase: null });
      return;
    }
    set({ currentPhase: result.data });
  },

  setActiveCase: (caseData) => {
    const result = CasePayloadSchema.safeParse(caseData);
    if (!result.success) {
      logValidationFailure(result.error);
      set({ currentPhase: 'ERROR_STATE', activeCase: null });
      return;
    }
    set({ activeCase: result.data });
  },

  resetGameState: () => set({ ...INITIAL_STATE }),
}));
