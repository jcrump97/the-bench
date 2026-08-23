import { describe, it, expect } from 'vitest';
import { dispositionOf, describeDisposition, countsReturned, summarizeRecord } from '../resultSummary';
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
      .toBe('Guilty on both counts');
    expect(describeDisposition(finish(vaughnCase, verdicts(vaughnCase, ['NOT_GUILTY', 'NOT_GUILTY']))))
      .toBe('Not guilty on either count');
    expect(describeDisposition(finish(vaughnCase, verdicts(vaughnCase, ['NOT_GUILTY', 'GUILTY']))))
      .toBe('Guilty on 1 of 2 counts');
  });
});

describe('summarizeRecord', () => {
  it('reports an empty record with no rate to speak of', () => {
    expect(summarizeRecord([])).toEqual({
      casesHeard: 0, pleasAccepted: 0, trialsHeld: 0, convictions: 0,
      acquittals: 0, splits: 0, countsTried: 0, countsGuilty: 0, guiltyRate: null,
    });
  });

  it('has no guilty rate on a docket of accepted pleas (0% would libel the judge)', () => {
    const record = summarizeRecord([finish(webbCase, null), finish(webbCase, null)]);
    expect(record.casesHeard).toBe(2);
    expect(record.pleasAccepted).toBe(2);
    expect(record.trialsHeld).toBe(0);
    expect(record.guiltyRate).toBeNull();
  });

  it('tallies dispositions and rates counts, not cases', () => {
    const record = summarizeRecord([
      finish(webbCase, null),                                              // plea
      finish(webbCase, verdicts(webbCase, ['GUILTY'])),                    // 1/1 guilty
      finish(webbCase, verdicts(webbCase, ['NOT_GUILTY'])),                // 0/1 guilty
      finish(vaughnCase, verdicts(vaughnCase, ['NOT_GUILTY', 'GUILTY'])),  // 1/2 guilty
    ]);

    expect(record).toEqual({
      casesHeard: 4,
      pleasAccepted: 1,
      trialsHeld: 3,
      convictions: 1,
      acquittals: 1,
      splits: 1,
      countsTried: 4,
      countsGuilty: 2,
      guiltyRate: 50,
    });
  });
});
