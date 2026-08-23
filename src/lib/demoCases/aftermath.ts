import type { CaseOutcome } from '../outcome';
import type { DemoCaseBundle } from './types';

export function selectAftermath(bundle: DemoCaseBundle, outcome: CaseOutcome): string {
  const text = bundle.aftermath[outcome];
  // defineDemoCase pins variant presence to the outcomes the deterministic
  // engine makes reachable, so a miss here is an off-path call.
  if (text === undefined) {
    throw new Error(`Demo case ${bundle.id} has no aftermath variant for unreachable outcome ${outcome}`);
  }
  return text;
}
