import { useMemo } from 'react';
import { useGameStore } from '../store/useGameStore';
import { useUIStore } from '../store/useUIStore';
import { usePleaPosture } from './usePleaPosture';
import {
  buildCourtroomScript,
  projectScriptView,
  type CourtroomScriptView,
} from '../lib/courtroomScript';

// Re-exported so consumers keep importing the view type from the hook they
// already use; the definition lives with the projection that produces it.
export type { CourtroomScriptView };

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
  const spokenJudgeLines = useGameStore((state) => state.spokenJudgeLines);
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
      spokenJudgeLines,
    });
  }, [activeCase, activePleaNarrative, postureResult, currentPhase, pleaDecision, motionRulings, chargeVerdicts, imposedSentence, aftermathNarrative, spokenJudgeLines]);

  return useMemo(() => projectScriptView(script, beatCursor), [script, beatCursor]);
}
