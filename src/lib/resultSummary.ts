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
    // A verdict is read out, not tallied: one count reads as the verdict
    // alone, two as "both counts", and only three or more get a number.
    case 'CONVICTED':
      if (total === 1) return 'Guilty';
      return total === 2 ? 'Guilty on both counts' : `Guilty on all ${total} counts`;
    case 'ACQUITTED':
      if (total === 1) return 'Not guilty';
      return total === 2 ? 'Not guilty on either count' : `Not guilty on all ${total} counts`;
    case 'SPLIT':
      return `Guilty on ${guilty} of ${total} counts`;
  }
}

// ─── The judge's record across cases ─────────────────────────────────────────

export interface BenchRecordSummary {
  casesHeard: number;
  pleasAccepted: number;
  trialsHeld: number;
  convictions: number;
  acquittals: number;
  splits: number;
  countsTried: number;
  countsGuilty: number;
  // Share of tried counts returned guilty, 0-100. Null when nothing has been
  // tried — a docket of accepted pleas has no rate, and reporting 0% for it
  // would read as a judge who acquits everyone.
  guiltyRate: number | null;
}

export function summarizeRecord(results: FinalResult[]): BenchRecordSummary {
  const tally = {
    casesHeard: results.length,
    pleasAccepted: 0,
    trialsHeld: 0,
    convictions: 0,
    acquittals: 0,
    splits: 0,
    countsTried: 0,
    countsGuilty: 0,
  };

  for (const result of results) {
    const { guilty, total } = countsReturned(result);
    tally.countsTried += total;
    tally.countsGuilty += guilty;

    switch (dispositionOf(result)) {
      case 'PLEA_ACCEPTED': tally.pleasAccepted += 1; break;
      case 'CONVICTED':     tally.trialsHeld += 1; tally.convictions += 1; break;
      case 'ACQUITTED':     tally.trialsHeld += 1; tally.acquittals += 1; break;
      case 'SPLIT':         tally.trialsHeld += 1; tally.splits += 1; break;
    }
  }

  return {
    ...tally,
    guiltyRate: tally.countsTried === 0
      ? null
      : Math.round((tally.countsGuilty / tally.countsTried) * 100),
  };
}
