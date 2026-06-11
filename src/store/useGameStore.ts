import { create } from 'zustand';
import {
  GamePhaseSchema,
  CasePayloadSchema,
  PleaDecisionSchema,
  MotionRulingSchema,
  VerdictSchema,
  SentenceSchema,
  type GamePhase,
  type CasePayload,
  type PleaDecision,
  type MotionRuling,
  type Verdict,
} from '../schemas/gameSchemas';
import { z } from 'zod';

type Sentence = z.infer<typeof SentenceSchema>;

interface GameState {
  currentPhase: GamePhase;
  activeCase: CasePayload | null;

  // Player decisions — null until the player acts in each act
  pleaDecision:    PleaDecision | null;
  motionRulings:   MotionRuling[];
  verdict:         Verdict | null;
  imposedSentence: Sentence[];

  setPhase:          (newPhase: unknown) => void;
  setActiveCase:     (caseData: unknown) => void;
  setPleaDecision:   (decision: unknown) => void;
  addMotionRuling:   (ruling: unknown) => void;
  setVerdict:        (verdict: unknown) => void;
  setImposedSentence:(sentences: unknown) => void;
  // Sanctioned escape hatch from END_STATE; bypasses transition matrix by design.
  resetGameState:    () => void;
}

const INITIAL_STATE: Pick<
  GameState,
  'currentPhase' | 'activeCase' | 'pleaDecision' | 'motionRulings' | 'verdict' | 'imposedSentence'
> = {
  currentPhase:    'WELCOME',
  activeCase:      null,
  pleaDecision:    null,
  motionRulings:   [],
  verdict:         null,
  imposedSentence: [],
};

const ERROR_PHASE: GamePhase = 'ERROR_STATE';

const ALLOWED_PHASE_TRANSITIONS: Record<GamePhase, ReadonlySet<GamePhase>> = {
  WELCOME:       new Set(['ACT_1_INTAKE', 'ERROR_STATE']),
  ACT_1_INTAKE:  new Set(['ACT_2_MOTIONS', 'ACT_3_VERDICT', 'ERROR_STATE']),
  ACT_2_MOTIONS: new Set(['ACT_3_VERDICT', 'ERROR_STATE']),
  ACT_3_VERDICT: new Set(['END_STATE', 'ERROR_STATE']),
  END_STATE:     new Set(['ERROR_STATE']),
  ERROR_STATE:   new Set(['WELCOME']),
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
    const { currentPhase, activeCase } = get();
    const allowedTransitions = ALLOWED_PHASE_TRANSITIONS[currentPhase];

    const phaseResult = GamePhaseSchema.safeParse(newPhase);
    if (!phaseResult.success) {
      logValidationFailure(phaseResult.error);
      set({ currentPhase: ERROR_PHASE, activeCase: null });
      return;
    }

    if (!allowedTransitions.has(phaseResult.data)) {
      logSecurityWarning();
      set({ currentPhase: ERROR_PHASE, activeCase: null });
      return;
    }

    // Guard: entering ACT_1_INTAKE requires an active case already loaded
    if (phaseResult.data === 'ACT_1_INTAKE' && activeCase === null) {
      logSecurityWarning();
      set({ currentPhase: ERROR_PHASE, activeCase: null });
      return;
    }

    set({ currentPhase: phaseResult.data });
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

  setPleaDecision: (decision) => {
    const result = PleaDecisionSchema.safeParse(decision);
    if (!result.success) {
      logValidationFailure(result.error);
      set({ currentPhase: ERROR_PHASE, activeCase: null });
      return;
    }
    set({ pleaDecision: result.data });
  },

  addMotionRuling: (ruling) => {
    const result = MotionRulingSchema.safeParse(ruling);
    if (!result.success) {
      logValidationFailure(result.error);
      set({ currentPhase: ERROR_PHASE, activeCase: null });
      return;
    }
    const existing = get().motionRulings;
    const deduplicated = existing.filter(r => r.evidenceId !== result.data.evidenceId);
    set({ motionRulings: [...deduplicated, result.data] });
  },

  setVerdict: (verdict) => {
    const result = VerdictSchema.safeParse(verdict);
    if (!result.success) {
      logValidationFailure(result.error);
      set({ currentPhase: ERROR_PHASE, activeCase: null });
      return;
    }
    set({ verdict: result.data });
  },

  setImposedSentence: (sentences) => {
    const result = z.array(SentenceSchema).safeParse(sentences);
    if (!result.success) {
      logValidationFailure(result.error);
      set({ currentPhase: ERROR_PHASE, activeCase: null });
      return;
    }
    set({ imposedSentence: result.data });
  },

  resetGameState: () => set({ ...INITIAL_STATE }),
}));
