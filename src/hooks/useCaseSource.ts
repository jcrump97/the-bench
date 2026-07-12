import { useMemo } from 'react';
import { useGameStore } from '../store/useGameStore';
import { demoCaseSource, type CaseSource } from '../lib/caseSource';
import { findDemoCaseById } from '../lib/demoCases';

// Resolves the CaseSource behind the active case. Today the demo registry is
// the only playable path, so this is a registry lookup; null means the active
// case has no known source (off-path — callers should force ERROR_STATE).
//
// [LLM-FILL: Aftermath] — when GameService exists, a BYOK-vaulted session
// resolves to the GameService-backed CaseSource here instead.
export function useCaseSource(): CaseSource | null {
  const activeCase = useGameStore((state) => state.activeCase);
  const bundle = activeCase !== null ? findDemoCaseById(activeCase.caseId) : undefined;
  return useMemo(() => (bundle !== undefined ? demoCaseSource(bundle) : null), [bundle]);
}
