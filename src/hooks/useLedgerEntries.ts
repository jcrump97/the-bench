import { useMemo } from 'react';
import { useGameStore } from '../store/useGameStore';
import { usePleaPosture } from './usePleaPosture';
import { buildLedger, type LedgerEntry } from '../lib/buildLedger';

export function useLedgerEntries(): LedgerEntry[] {
  const currentPhase = useGameStore((state) => state.currentPhase);
  const activeCase = useGameStore((state) => state.activeCase);
  const activePleaNarrative = useGameStore((state) => state.activePleaNarrative);
  const pleaDecision = useGameStore((state) => state.pleaDecision);
  const motionRulings = useGameStore((state) => state.motionRulings);
  const chargeVerdicts = useGameStore((state) => state.chargeVerdicts);
  const imposedSentence = useGameStore((state) => state.imposedSentence);
  const storedAftermath = useGameStore((state) => state.aftermathNarrative);
  const postureResult = usePleaPosture();

  // The aftermath is upstream narrative state, written through the CaseSource
  // seam at sentencing time and already validated by the store; the ledger
  // only surfaces it once the game reaches END_STATE.
  const aftermathNarrative = currentPhase === 'END_STATE' ? storedAftermath : null;

  return useMemo(() => {
    if (activeCase === null) return [];
    return buildLedger({
      caseData: activeCase,
      pleaNarrative: activePleaNarrative,
      pleaPosture: postureResult?.posture ?? null,
      pleaDecision,
      motionRulings,
      // buildLedger predates incremental verdicts and takes the whole
      // verdict or nothing; its courtroomScript successor consumes the
      // accumulating array directly.
      verdict: chargeVerdicts.length > 0 ? chargeVerdicts : null,
      imposedSentence,
      aftermathNarrative,
    });
  }, [activeCase, activePleaNarrative, postureResult, pleaDecision, motionRulings, chargeVerdicts, imposedSentence, aftermathNarrative]);
}
