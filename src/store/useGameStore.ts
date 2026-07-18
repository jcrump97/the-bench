import { create } from 'zustand';
import {
  GamePhaseSchema,
  CasePayloadSchema,
  PleaDecisionSchema,
  MotionRulingSchema,
  ChargeVerdictSchema,
  SentenceSchema,
  PleaNarrativeSchema,
  AftermathNarrativeSchema,
  type GamePhase,
  type CasePayload,
  type PleaDecision,
  type MotionRuling,
  type ChargeVerdict,
  type PleaNarrative,
} from '../schemas/gameSchemas';
import { z } from 'zod';

type Sentence = z.infer<typeof SentenceSchema>;

interface GameState {
  currentPhase: GamePhase;
  activeCase: CasePayload | null;
  // The LLM's/demo case's narrative-only plea input. Upstream input data
  // (like activeCase), not a derived value — the computed PleaPosture stays
  // a pure derivation and is never stored here.
  activePleaNarrative: PleaNarrative | null;

  // Player decisions — empty/null until the player acts in each act.
  // motionRulings and chargeVerdicts accumulate one entry per ruling so the
  // court record can show each ruling the moment it is made.
  pleaDecision:    PleaDecision | null;
  motionRulings:   MotionRuling[];
  chargeVerdicts:  ChargeVerdict[];
  imposedSentence: Sentence[];

  // [LLM-FILL: Aftermath] — narrative input like activeCase, written after
  // sentencing by the CaseSource (demo registry today, GameService's
  // Aftermath call on the BYOK path) and read at END_STATE.
  aftermathNarrative: string | null;

  // The chosen judge line per decision point, keyed by decision-point id
  // ('plea' | `motion-${evidenceId}` | `verdict-${chargeId}`). Narrative
  // voice record only — game logic must never read this field; the
  // structural stores (pleaDecision/motionRulings/chargeVerdicts) stay the
  // sole inputs to derivations.
  spokenJudgeLines: Record<string, string>;

  setPhase:              (newPhase: unknown) => void;
  setActiveCase:         (caseData: unknown) => void;
  setActivePleaNarrative:(narrative: unknown) => void;
  setPleaDecision:       (decision: unknown) => void;
  addMotionRuling:       (ruling: unknown) => void;
  addChargeVerdict:      (chargeVerdict: unknown) => void;
  setImposedSentence:    (sentences: unknown) => void;
  setAftermathNarrative: (narrative: unknown) => void;
  recordSpokenJudgeLine: (decisionId: unknown, lineText: unknown) => void;
  // Sanctioned escape hatch from END_STATE; bypasses transition matrix by design.
  resetGameState:    () => void;
}

const INITIAL_STATE: Pick<
  GameState,
  'currentPhase' | 'activeCase' | 'activePleaNarrative' | 'pleaDecision' | 'motionRulings' | 'chargeVerdicts' | 'imposedSentence' | 'aftermathNarrative' | 'spokenJudgeLines'
> = {
  currentPhase:    'WELCOME',
  activeCase:      null,
  activePleaNarrative: null,
  pleaDecision:    null,
  motionRulings:   [],
  chargeVerdicts:  [],
  imposedSentence: [],
  aftermathNarrative: null,
  spokenJudgeLines: {},
};

const ERROR_PHASE: GamePhase = 'ERROR_STATE';

const ERROR_RESET: typeof INITIAL_STATE = {
  ...INITIAL_STATE,
  currentPhase:    ERROR_PHASE,
};

const ALLOWED_PHASE_TRANSITIONS: Record<GamePhase, ReadonlySet<GamePhase>> = {
  WELCOME:       new Set(['ACT_1_INTAKE', 'ERROR_STATE']),
  ACT_1_INTAKE:  new Set(['ACT_2_MOTIONS', 'ACT_3_VERDICT', 'ERROR_STATE']),
  ACT_2_MOTIONS: new Set(['ACT_3_VERDICT', 'ERROR_STATE']),
  ACT_3_VERDICT: new Set(['END_STATE', 'ERROR_STATE']),
  END_STATE:     new Set(['ERROR_STATE']),
  ERROR_STATE:   new Set(['WELCOME']),
};

const CASE_REHYDRATION_ALLOWED_PHASES: ReadonlySet<GamePhase> = new Set(['WELCOME']);

// spokenJudgeLines key shape: 'plea' | `motion-${evidenceId}` | `verdict-${chargeId}`.
// Defined locally (not in gameSchemas.ts) — this is a store-internal voice
// record, never a trust-boundary payload shared with other modules.
const SpokenDecisionIdSchema = z.union([
  z.literal('plea'),
  z.string().regex(/^motion-.{1,40}$/),
  z.string().regex(/^verdict-.{1,40}$/),
]);
const SpokenLineTextSchema = z.string().min(1).max(300);

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
      set(ERROR_RESET);
      return;
    }

    if (!allowedTransitions.has(phaseResult.data)) {
      logSecurityWarning();
      set(ERROR_RESET);
      return;
    }

    // Guard: entering ACT_1_INTAKE requires an active case already loaded
    if (phaseResult.data === 'ACT_1_INTAKE' && activeCase === null) {
      logSecurityWarning();
      set(ERROR_RESET);
      return;
    }

    set({ currentPhase: phaseResult.data });
  },

  setActiveCase: (caseData) => {
    const currentPhase = get().currentPhase;
    if (!CASE_REHYDRATION_ALLOWED_PHASES.has(currentPhase)) {
      logSecurityWarning();
      set(ERROR_RESET);
      return;
    }

    const result = CasePayloadSchema.safeParse(caseData);
    if (!result.success) {
      logValidationFailure(result.error);
      set(ERROR_RESET);
      return;
    }
    set({ activeCase: result.data });
  },

  setActivePleaNarrative: (narrative) => {
    const currentPhase = get().currentPhase;
    if (!CASE_REHYDRATION_ALLOWED_PHASES.has(currentPhase)) {
      logSecurityWarning();
      set(ERROR_RESET);
      return;
    }

    const result = PleaNarrativeSchema.safeParse(narrative);
    if (!result.success) {
      logValidationFailure(result.error);
      set(ERROR_RESET);
      return;
    }
    set({ activePleaNarrative: result.data });
  },

  setPleaDecision: (decision) => {
    const result = PleaDecisionSchema.safeParse(decision);
    if (!result.success) {
      logValidationFailure(result.error);
      set(ERROR_RESET);
      return;
    }
    set({ pleaDecision: result.data });
  },

  addMotionRuling: (ruling) => {
    // Motion rulings are made from the bench during the evidentiary
    // hearing — any other phase is an off-path write.
    if (get().currentPhase !== 'ACT_2_MOTIONS') {
      logSecurityWarning();
      set(ERROR_RESET);
      return;
    }

    const result = MotionRulingSchema.safeParse(ruling);
    if (!result.success) {
      logValidationFailure(result.error);
      set(ERROR_RESET);
      return;
    }
    const existing = get().motionRulings;
    const deduplicated = existing.filter(r => r.evidenceId !== result.data.evidenceId);
    set({ motionRulings: [...deduplicated, result.data] });
  },

  addChargeVerdict: (chargeVerdict) => {
    // Verdicts are entered one charge at a time from the bench during
    // ACT_3_VERDICT, mirroring addMotionRuling's accumulate-and-dedupe shape.
    if (get().currentPhase !== 'ACT_3_VERDICT') {
      logSecurityWarning();
      set(ERROR_RESET);
      return;
    }

    const result = ChargeVerdictSchema.safeParse(chargeVerdict);
    if (!result.success) {
      logValidationFailure(result.error);
      set(ERROR_RESET);
      return;
    }
    const existing = get().chargeVerdicts;
    const deduplicated = existing.filter(v => v.chargeId !== result.data.chargeId);
    set({ chargeVerdicts: [...deduplicated, result.data] });
  },

  setImposedSentence: (sentences) => {
    const result = z.array(SentenceSchema).safeParse(sentences);
    if (!result.success) {
      logValidationFailure(result.error);
      set(ERROR_RESET);
      return;
    }
    set({ imposedSentence: result.data });
  },

  setAftermathNarrative: (narrative) => {
    // The aftermath is generated after sentencing, immediately before the
    // END_STATE transition — any other phase is an off-path write.
    if (get().currentPhase !== 'ACT_3_VERDICT') {
      logSecurityWarning();
      set(ERROR_RESET);
      return;
    }

    const result = AftermathNarrativeSchema.safeParse(narrative);
    if (!result.success) {
      logValidationFailure(result.error);
      set(ERROR_RESET);
      return;
    }
    set({ aftermathNarrative: result.data });
  },

  recordSpokenJudgeLine: (decisionId, lineText) => {
    const idResult = SpokenDecisionIdSchema.safeParse(decisionId);
    const textResult = SpokenLineTextSchema.safeParse(lineText);
    if (!idResult.success || !textResult.success) {
      logValidationFailure(!idResult.success ? idResult.error : textResult.error);
      set(ERROR_RESET);
      return;
    }
    set({ spokenJudgeLines: { ...get().spokenJudgeLines, [idResult.data]: textResult.data } });
  },

  resetGameState: () => set({ ...INITIAL_STATE }),
}));
