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

  setPhase: (newPhase: unknown) => void;
  setActiveCase: (caseData: unknown) => void;
  resetGameState: () => void;
}

const INITIAL_STATE: Pick<GameState, 'currentPhase' | 'activeCase'> = {
  currentPhase: 'WELCOME',
  activeCase: null,
};

const ERROR_PHASE: GamePhase = 'ERROR_STATE';

const ALLOWED_PHASE_TRANSITIONS: Record<GamePhase, ReadonlySet<GamePhase>> = {
  WELCOME: new Set(['ACT_1_INTAKE', 'ERROR_STATE']),
  ACT_1_INTAKE: new Set(['ACT_2_MOTIONS', 'ACT_3_VERDICT', 'ERROR_STATE']),
  ACT_2_MOTIONS: new Set(['ACT_3_VERDICT', 'ERROR_STATE']),
  ACT_3_VERDICT: new Set(['END_STATE', 'ERROR_STATE']),
  END_STATE: new Set(['ERROR_STATE']),
  ERROR_STATE: new Set(['WELCOME']),
};

const CASE_REHYDRATION_ALLOWED_PHASES: ReadonlySet<GamePhase> = new Set(['WELCOME']);

function logValidationFailure(error: unknown): void {
  console.error('State validation failed');
  if (import.meta.env.DEV) {
    console.error(error);
  }
}

function logSecurityWarning(): void {
  console.warn('Security boundary violation blocked');
}

export const useGameStore = create<GameState>((set, get) => ({
  ...INITIAL_STATE,

  setPhase: (newPhase) => {
    const currentPhase = get().currentPhase;
    const allowedTransitions = ALLOWED_PHASE_TRANSITIONS[currentPhase];
    if (!allowedTransitions.has(newPhase as GamePhase)) {
      logSecurityWarning();
      set({ currentPhase: ERROR_PHASE, activeCase: null });
      return;
    }

    const result = GamePhaseSchema.safeParse(newPhase);
    if (!result.success) {
      logValidationFailure(result.error);
      set({ currentPhase: ERROR_PHASE, activeCase: null });
      return;
    }
    set({ currentPhase: result.data });
  },

  setActiveCase: (caseData) => {
    const currentPhase = get().currentPhase;
    if (!CASE_REHYDRATION_ALLOWED_PHASES.has(currentPhase)) {
      logSecurityWarning();
      set({ currentPhase: ERROR_PHASE, activeCase: null });
      return;
    }

    const result = CasePayloadSchema.safeParse(caseData);
    if (!result.success) {
      logValidationFailure(result.error);
      set({ currentPhase: ERROR_PHASE, activeCase: null });
      return;
    }
    set({ activeCase: result.data });
  },

  resetGameState: () => set({ ...INITIAL_STATE }),
}));
