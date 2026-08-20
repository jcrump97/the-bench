import { useMemo } from 'react';
import { useGameStore } from '../store/useGameStore';
import { useSecurityStore } from '../store/useSecurityStore';
import { demoCaseSource, type CaseSource } from '../lib/caseSource';
import { findDemoCaseById, type DemoCaseBundle } from '../lib/demoCases';
import { createGameService } from '../lib/llm/gameService';

// Which source backs a case, given what the stores hold. Exported separately
// from the hook so the precedence rule can be tested directly — the hook
// itself is only the store reads and the memo.
//
// The demo bundle wins when both are available, and deliberately: a demo case
// is hand-authored and offline, so resolving it through GameService would
// spend the player's own API quota regenerating a case that already exists.
export function selectCaseSource(
  bundle: DemoCaseBundle | undefined,
  apiKey: string | null,
): CaseSource | null {
  if (bundle !== undefined) return demoCaseSource(bundle);
  if (apiKey !== null) return createGameService(apiKey);
  return null;
}

// Resolves the CaseSource behind the active case: the demo registry when the
// active case is a hardcoded bundle, otherwise the GameService-backed source
// for a BYOK-vaulted session. Null means the active case has no known source
// at all (off-path — callers should force ERROR_STATE).
export function useCaseSource(): CaseSource | null {
  const activeCase = useGameStore((state) => state.activeCase);
  const vault = useSecurityStore((state) => state.vault);
  const bundle = activeCase !== null ? findDemoCaseById(activeCase.caseId) : undefined;

  const apiKey = vault !== null && !vault.isDemo ? vault.apiKey : null;

  return useMemo(() => selectCaseSource(bundle, apiKey), [bundle, apiKey]);
}
