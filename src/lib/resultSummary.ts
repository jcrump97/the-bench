import type { FinalResult } from '../schemas/gameSchemas';
import { classifyOutcome, type CaseOutcome } from './outcome';

// Read-side projections of a persisted judgment: how the case came out, in
// the one sentence a docket line or a judgment card needs. Pure and separate
// from the components so the wording is testable and every surface — the
// END_STATE card, the bench record — says the same thing.

export function dispositionOf(result: FinalResult): CaseOutcome {
  return result.resolutionPath === 'PLEA'
    ? classifyOutcome('ACCEPT', null)
    : classifyOutcome(null, result.verdict);
}

// Counts tried, and how many came back guilty. Zero of zero on the plea path:
// a plea resolves the charges without any count being returned.
export function countsReturned(result: FinalResult): { guilty: number; total: number } {
  if (result.resolutionPath === 'PLEA') return { guilty: 0, total: 0 };
  return {
    guilty: result.verdict.filter((v) => v.verdict === 'GUILTY').length,
    total: result.verdict.length,
  };
}

export function describeDisposition(result: FinalResult): string {
  const { guilty, total } = countsReturned(result);
  switch (dispositionOf(result)) {
    case 'PLEA_ACCEPTED':
      return 'Plea accepted';
    // A single-count case reads as a verdict, not as arithmetic.
    case 'CONVICTED':
      return total === 1 ? 'Guilty' : `Guilty on all ${total} counts`;
    case 'ACQUITTED':
      return total === 1 ? 'Not guilty' : `Not guilty on all ${total} counts`;
    case 'SPLIT':
      return `Guilty on ${guilty} of ${total} counts`;
  }
}
