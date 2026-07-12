import { useMemo } from 'react';
import { useGameStore } from '../store/useGameStore';
import { usePleaPosture } from './usePleaPosture';
import { buildLedger, type LedgerEntry } from '../lib/buildLedger';
import { findDemoCaseById } from '../lib/demoCases';

export function useLedgerEntries(): LedgerEntry[] {
  const currentPhase = useGameStore((state) => state.currentPhase);
  const activeCase = useGameStore((state) => state.activeCase);
  const activePleaNarrative = useGameStore((state) => state.activePleaNarrative);
  const pleaDecision = useGameStore((state) => state.pleaDecision);
  const motionRulings = useGameStore((state) => state.motionRulings);
  const verdict = useGameStore((state) => state.verdict);
  const imposedSentence = useGameStore((state) => state.imposedSentence);
  const postureResult = usePleaPosture();

  // [LLM-FILL: Aftermath] — GameService's post-sentencing Aftermath call
  // replaces this on the BYOK path. Demo is the only playable path today, so
  // END_STATE reads the active bundle's aftermath from the registry.
  const aftermathNarrative = currentPhase === 'END_STATE' && activeCase !== null
    ? findDemoCaseById(activeCase.caseId)?.aftermathNarrative ?? null
    : null;

  return useMemo(() => {
    if (activeCase === null) return [];
    return buildLedger({
      caseData: activeCase,
      pleaNarrative: activePleaNarrative,
      pleaPosture: postureResult?.posture ?? null,
      pleaDecision,
      motionRulings,
      verdict,
      imposedSentence,
      aftermathNarrative,
    });
  }, [activeCase, activePleaNarrative, postureResult, pleaDecision, motionRulings, verdict, imposedSentence, aftermathNarrative]);
}
