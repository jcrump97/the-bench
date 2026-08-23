import type { PleaDecision, Verdict } from '../schemas/gameSchemas';

// How the player's run of a case ended, as the four classes any end-of-game
// consumer cares about. Lives here rather than in demoCases/ because it is
// not a demo concern: the aftermath variant picker, the persisted
// FinalResult's disposition, and the BYOK Aftermath prompt context all read
// the same classification, and a second copy of the guilty-count rule is
// exactly the kind of thing that drifts.
export type CaseOutcome = 'PLEA_ACCEPTED' | 'CONVICTED' | 'ACQUITTED' | 'SPLIT';

// Pure projection of end-of-game state onto those classes.
export function classifyOutcome(
  pleaDecision: PleaDecision | null,
  verdict: Verdict | null
): CaseOutcome {
  if (pleaDecision === 'ACCEPT') return 'PLEA_ACCEPTED';

  // Precondition: on every non-plea path the state machine requires a verdict
  // before END_STATE, so a missing/empty verdict here is an off-path call
  // (programming error), not a real outcome.
  if (verdict === null || verdict.length === 0) {
    throw new Error('classifyOutcome requires an accepted plea or a non-empty verdict');
  }

  const guiltyCount = verdict.filter((v) => v.verdict === 'GUILTY').length;
  if (guiltyCount === verdict.length) return 'CONVICTED';
  if (guiltyCount === 0) return 'ACQUITTED';
  return 'SPLIT';
}
