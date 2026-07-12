import type { PleaDecision, Verdict } from '../../schemas/gameSchemas';
import type { AftermathOutcome, DemoCaseBundle } from './types';

// Pure projection of end-of-game state onto the outcome classes an aftermath
// narrative is conditioned on. The future GameService Aftermath call uses the
// same classification to build its prompt context; the demo path uses it to
// pick an authored variant.
export function classifyOutcome(
  pleaDecision: PleaDecision | null,
  verdict: Verdict | null
): AftermathOutcome {
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

export function selectAftermath(bundle: DemoCaseBundle, outcome: AftermathOutcome): string {
  const text = bundle.aftermath[outcome];
  // defineDemoCase pins variant presence to the outcomes the deterministic
  // engine makes reachable, so a miss here is an off-path call.
  if (text === undefined) {
    throw new Error(`Demo case ${bundle.id} has no aftermath variant for unreachable outcome ${outcome}`);
  }
  return text;
}
