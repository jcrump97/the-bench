import { create } from 'zustand';
import {
  GamePhaseSchema,
  CasePayloadSchema,
  PleaDecisionSchema,
  MotionRulingSchema,
  VerdictSchema,
  SentenceSchema,
  PleaNarrativeSchema,
  AftermathNarrativeSchema,
  DialogueScriptSchema,
  type GamePhase,
  type CasePayload,
  type PleaDecision,
  type MotionRuling,
  type Verdict,
  type PleaNarrative,
  type DialogueScript,
} from '../schemas/gameSchemas';
import { z } from 'zod';
import { computePleaPostureForCase } from '../lib/pleaAssessment';
import { validateDialogueScriptAgainstCase } from '../lib/validateDialogueScriptAgainstCase';

type Sentence = z.infer<typeof SentenceSchema>;

interface GameState {
  currentPhase: GamePhase;
  activeCase: CasePayload | null;
  // The LLM's/demo case's narrative-only plea input. Upstream input data
  // (like activeCase), not a derived value — the computed PleaPosture stays
  // a pure derivation and is never stored here.
  activePleaNarrative: PleaNarrative | null;
  // The narrative-only dialogue sidecar (courtroom-transcript redesign).
  // Upstream input data, like activeCase/activePleaNarrative — hydrated once
  // at WELCOME, cross-validated against activeCase + the computed PleaPosture.
  activeDialogueScript: DialogueScript | null;

  // Player decisions — null until the player acts in each act
  pleaDecision:    PleaDecision | null;
  motionRulings:   MotionRuling[];
  verdict:         Verdict | null;
  imposedSentence: Sentence[];

  // [LLM-FILL: Aftermath] — narrative input like activeCase, written after
  // sentencing by the CaseSource (demo registry today, GameService's
  // Aftermath call on the BYOK path) and read at END_STATE.
  aftermathNarrative: string | null;

  // The chosen judge line per decision point, keyed by decision-point id
  // ('plea' | `motion-${evidenceId}` | `verdict-${chargeId}`). Narrative
  // voice record only — game logic must never read this field; the
  // structural stores (pleaDecision/motionRulings/verdict) stay the sole
  // inputs to derivations.
  spokenJudgeLines: Record<string, string>;

  setPhase:               (newPhase: unknown) => void;
  setActiveCase:          (caseData: unknown) => void;
  setActivePleaNarrative: (narrative: unknown) => void;
  setActiveDialogueScript:(script: unknown) => void;
  setPleaDecision:        (decision: unknown) => void;
  addMotionRuling:        (ruling: unknown) => void;
  setVerdict:             (verdict: unknown) => void;
  setImposedSentence:     (sentences: unknown) => void;
  setAftermathNarrative:  (narrative: unknown) => void;
  recordSpokenJudgeLine:  (decisionId: unknown, lineText: unknown) => void;
  // Sanctioned escape hatch from END_STATE; bypasses transition matrix by design.
  resetGameState:    () => void;
}

const INITIAL_STATE: Pick<
  GameState,
  'currentPhase' | 'activeCase' | 'activePleaNarrative' | 'activeDialogueScript' | 'pleaDecision' | 'motionRulings' | 'verdict' | 'imposedSentence' | 'aftermathNarrative' | 'spokenJudgeLines'
> = {
  currentPhase:    'WELCOME',
  activeCase:      null,
  activePleaNarrative: null,
  activeDialogueScript: null,
  pleaDecision:    null,
  motionRulings:   [],
  verdict:         null,
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

  setActiveDialogueScript: (script) => {
    const currentPhase = get().currentPhase;
    if (!CASE_REHYDRATION_ALLOWED_PHASES.has(currentPhase)) {
      logSecurityWarning();
      set(ERROR_RESET);
      return;
    }

    const { activeCase, activePleaNarrative } = get();
    if (activeCase === null || activePleaNarrative === null) {
      logSecurityWarning();
      set(ERROR_RESET);
      return;
    }

    const result = DialogueScriptSchema.safeParse(script);
    if (!result.success) {
      logValidationFailure(result.error);
      set(ERROR_RESET);
      return;
    }

    // computePleaPostureForCase throws (not a Zod failure) on a schema-valid
    // but inconsistent case/narrative pairing — e.g. an offering band with no
    // defenseRationale. This setter is a trust boundary that will eventually
    // receive LLM-shaped input, so that throw becomes ERROR_STATE, not a crash.
    let issues: string[];
    try {
      const { posture } = computePleaPostureForCase(activeCase, activePleaNarrative);
      issues = validateDialogueScriptAgainstCase(result.data, activeCase, posture);
    } catch (error) {
      logValidationFailure(error);
      set(ERROR_RESET);
      return;
    }
    if (issues.length > 0) {
      logValidationFailure(issues);
      set(ERROR_RESET);
      return;
    }

    set({ activeDialogueScript: result.data });
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

  setVerdict: (verdict) => {
    const result = VerdictSchema.safeParse(verdict);
    if (!result.success) {
      logValidationFailure(result.error);
      set(ERROR_RESET);
      return;
    }
    set({ verdict: result.data });
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
