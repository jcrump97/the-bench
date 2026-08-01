import { useMemo } from 'react';
import { useGameStore } from '../store/useGameStore';
import { useSecurityStore } from '../store/useSecurityStore';
import { demoCaseSource, type CaseSource } from '../lib/caseSource';
import { findDemoCaseById } from '../lib/demoCases';
import { createGameService } from '../lib/llm/gameService';

// Resolves the CaseSource behind the active case: the demo registry when the
// active case is a hardcoded bundle, otherwise the GameService-backed source
// for a BYOK-vaulted session. Null means the active case has no known source
// at all (off-path — callers should force ERROR_STATE).
export function useCaseSource(): CaseSource | null {
  const activeCase = useGameStore((state) => state.activeCase);
  const vault = useSecurityStore((state) => state.vault);
  const bundle = activeCase !== null ? findDemoCaseById(activeCase.caseId) : undefined;

  const apiKey = vault !== null && !vault.isDemo ? vault.apiKey : null;

  return useMemo(() => {
    if (bundle !== undefined) return demoCaseSource(bundle);
    if (apiKey !== null) return createGameService(apiKey);
    return null;
  }, [bundle, apiKey]);
}
