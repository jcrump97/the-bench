import { useGameStore } from '../store/useGameStore';
import { buildFinalResult } from './resultGenerator';
import { saveFinalResult } from './resultArchive';
import type { Sentence } from '../schemas/gameSchemas';

// ===========================================================================
// The three-step close of a case, in the order the architecture requires:
//
//   ResultGenerator (assemble)  →  ValidationLayer (the store's schema gate)
//                               →  archive (localStorage)
//
// Deliberately the one module in lib/ that talks to the store: it exists to
// be that wiring, and putting it here rather than in the sentencing control
// keeps the sequence testable end to end (the store runs happily in node) and
// keeps the component down to a single call.
//
// The archive is fed from `getState()` rather than from the candidate, so
// only a snapshot that actually came back through FinalResultSchema can ever
// be persisted; a rejected one has already forced ERROR_STATE inside the
// store and leaves the record untouched.
//
// Called in the last moment of ACT_3_VERDICT, immediately before the hop to
// END_STATE. The two values written in that same handler are passed in rather
// than re-read, so the snapshot cannot depend on write ordering.
// ===========================================================================
export function recordJudgment(aftermathNarrative: string, imposedSentence: Sentence[]): void {
  const { activeCase, activePleaNarrative, pleaDecision, motionRulings, chargeVerdicts, setFinalResult } =
    useGameStore.getState();

  // Precondition: sentencing is unreachable without a hydrated case, so this
  // is an off-path call (programming error), not a player-visible state.
  if (activeCase === null || activePleaNarrative === null) {
    throw new Error('recordJudgment: no active case to snapshot');
  }

  setFinalResult(buildFinalResult({
    caseData: activeCase,
    pleaNarrative: activePleaNarrative,
    pleaDecision,
    motionRulings,
    chargeVerdicts,
    imposedSentence,
    aftermathNarrative,
    completedAt: new Date().toISOString(),
  }));

  const validated = useGameStore.getState().finalResult;
  if (validated !== null) saveFinalResult(validated);
}
