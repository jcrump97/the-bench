import { describe, it, expect } from 'vitest';
import { dispositionOf, describeDisposition, countsReturned } from '../resultSummary';
import { FinalResultSchema, type ChargeVerdict, type FinalResult } from '../../schemas/gameSchemas';
import { buildFinalResult } from '../resultGenerator';
import { webbCase } from '../demoCases/webb';
import { vaughnCase } from '../demoCases/vaughn';
import type { DemoCaseBundle } from '../demoCases';

function verdicts(bundle: DemoCaseBundle, values: ChargeVerdict['verdict'][]): ChargeVerdict[] {
  return bundle.payload.charges.map((charge, i) => ({
    chargeId: charge.id,
    chargeName: charge.name,
    classification: charge.classification,
    verdict: values[i] ?? 'GUILTY',
  }));
}

function finish(bundle: DemoCaseBundle, chargeVerdicts: ChargeVerdict[] | null): FinalResult {
  return FinalResultSchema.parse(buildFinalResult({
    caseData: bundle.payload,
    pleaNarrative: bundle.pleaNarrative,
    pleaDecision: chargeVerdicts === null ? 'ACCEPT' : 'REJECT',
    motionRulings: bundle.payload.evidence.map((e) => ({ evidenceId: e.id, ruling: 'ADMITTED' as const })),
    chargeVerdicts: chargeVerdicts ?? [],
    imposedSentence: [{ type: 'PRISON', unit: 'YEARS', amount: 2 }],
    aftermathNarrative: 'The courthouse emptied by four.',
    completedAt: '2026-08-23T17:04:05.000Z',
  }));
}

describe('dispositionOf', () => {
  it('reads an accepted plea straight off the resolution path', () => {
    expect(dispositionOf(finish(webbCase, null))).toBe('PLEA_ACCEPTED');
  });

  it('classifies trial verdicts the same way the aftermath variants are picked', () => {
    expect(dispositionOf(finish(webbCase, verdicts(webbCase, ['GUILTY'])))).toBe('CONVICTED');
    expect(dispositionOf(finish(webbCase, verdicts(webbCase, ['NOT_GUILTY'])))).toBe('ACQUITTED');
    expect(dispositionOf(finish(vaughnCase, verdicts(vaughnCase, ['NOT_GUILTY', 'GUILTY'])))).toBe('SPLIT');
  });
});

describe('countsReturned', () => {
  it('counts the guilty verdicts against the counts tried', () => {
    // Vaughn is the docket's multi-count case: two charges, split verdict.
    expect(countsReturned(finish(vaughnCase, verdicts(vaughnCase, ['NOT_GUILTY', 'GUILTY']))))
      .toEqual({ guilty: 1, total: 2 });
  });

  it('reports no counts tried on the plea path', () => {
    expect(countsReturned(finish(webbCase, null))).toEqual({ guilty: 0, total: 0 });
  });
});

describe('describeDisposition', () => {
  it('names the plea path', () => {
    expect(describeDisposition(finish(webbCase, null))).toBe('Plea accepted');
  });

  it('names a single-count verdict without counting', () => {
    expect(describeDisposition(finish(webbCase, verdicts(webbCase, ['GUILTY'])))).toBe('Guilty');
    expect(describeDisposition(finish(webbCase, verdicts(webbCase, ['NOT_GUILTY'])))).toBe('Not guilty');
  });

  it('counts the counts on a multi-count verdict', () => {
    expect(describeDisposition(finish(vaughnCase, verdicts(vaughnCase, ['GUILTY', 'GUILTY']))))
      .toBe('Guilty on all 2 counts');
    expect(describeDisposition(finish(vaughnCase, verdicts(vaughnCase, ['NOT_GUILTY', 'NOT_GUILTY']))))
      .toBe('Not guilty on all 2 counts');
    expect(describeDisposition(finish(vaughnCase, verdicts(vaughnCase, ['NOT_GUILTY', 'GUILTY']))))
      .toBe('Guilty on 1 of 2 counts');
  });
});
