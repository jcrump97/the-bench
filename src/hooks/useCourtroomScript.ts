import { useMemo } from 'react';
import { useGameStore } from '../store/useGameStore';
import { useUIStore } from '../store/useUIStore';
import { usePleaPosture } from './usePleaPosture';
import {
  buildCourtroomScript,
  type ScriptBeat,
  type StatementBeat,
} from '../lib/courtroomScript';

export interface CourtroomScriptView {
  // The full known script (up to and including the first unresolved decision).
  script: ScriptBeat[];
  // The reveal cursor, clamped to the script (defensive — prefix stability
  // means the script never shrinks under the cursor in practice).
  cursor: number;
  // The transcript as revealed so far: statements among the first `cursor` beats.
  visibleEntries: StatementBeat[];
  // The beat waiting at the cursor: a statement (Continue reveals it), a
  // decision (its control renders), or undefined when the script is exhausted.
  pendingBeat: ScriptBeat | undefined;
}

// Single derivation joining the courtroom script (pure projection of game
// state) with the UI store's reveal cursor. Successor to useLedgerEntries.
export function useCourtroomScript(): CourtroomScriptView {
  const currentPhase = useGameStore((state) => state.currentPhase);
  const activeCase = useGameStore((state) => state.activeCase);
  const activePleaNarrative = useGameStore((state) => state.activePleaNarrative);
  const pleaDecision = useGameStore((state) => state.pleaDecision);
  const motionRulings = useGameStore((state) => state.motionRulings);
  const chargeVerdicts = useGameStore((state) => state.chargeVerdicts);
  const imposedSentence = useGameStore((state) => state.imposedSentence);
  const aftermathNarrative = useGameStore((state) => state.aftermathNarrative);
  const beatCursor = useUIStore((state) => state.beatCursor);
  const postureResult = usePleaPosture();

  const script = useMemo(() => {
    if (activeCase === null) return [];
    return buildCourtroomScript({
      caseData: activeCase,
      pleaNarrative: activePleaNarrative,
      pleaPosture: postureResult?.posture ?? null,
      currentPhase,
      pleaDecision,
      motionRulings,
      chargeVerdicts,
      imposedSentence,
      aftermathNarrative,
    });
  }, [activeCase, activePleaNarrative, postureResult, currentPhase, pleaDecision, motionRulings, chargeVerdicts, imposedSentence, aftermathNarrative]);

  return useMemo(() => {
    const cursor = Math.min(beatCursor, script.length);
    return {
      script,
      cursor,
      visibleEntries: script
        .slice(0, cursor)
        .filter((beat): beat is StatementBeat => beat.kind === 'STATEMENT'),
      pendingBeat: script[cursor],
    };
  }, [script, beatCursor]);
}
