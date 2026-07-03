import { useMemo } from 'react';
import { useGameStore } from '../store/useGameStore';
import { computePleaPostureForCase, type PleaPostureResult } from '../lib/pleaAssessment';

// Single memoized derivation of the plea posture. PleaPosture is never stored
// (that would create a second source of truth); every consumer reads it here.
export function usePleaPosture(): PleaPostureResult | null {
  const activeCase = useGameStore((state) => state.activeCase);
  const activePleaNarrative = useGameStore((state) => state.activePleaNarrative);

  return useMemo(() => {
    if (activeCase === null || activePleaNarrative === null) return null;
    return computePleaPostureForCase(activeCase, activePleaNarrative);
  }, [activeCase, activePleaNarrative]);
}
