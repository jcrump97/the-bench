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

// The aftermath is assembled, not quoted — the same shape as
// assembleClosingArgument: an authored base that answers the outcome, plus a
// coda that answers the sentence the judge actually chose. Without it a
// docket case reads identically whether the court gave the floor of the range
// or the ceiling, which is the one decision the judge makes alone.
//
// The coda is authored per case and per severity band rather than per
// outcome × band: the base already carries what happened, so the coda only
// has to carry how the term landed on the people the base just named.
export function assembleAftermath(base: string, coda: string | null): string {
  return coda === null ? base : `${base}\n\n${coda}`;
}
