import { describe, it, expect } from 'vitest';
import { describeConsequences } from '../consequences';
import { buildFinalResult } from '../resultGenerator';
import { FinalResultSchema, CasePayloadSchema, type ChargeVerdict, type FinalResult, type Sentence } from '../../schemas/gameSchemas';
import { rawValidCase, validCase } from './fixtures';
import { webbCase } from '../demoCases/webb';

const PLEA_NARRATIVE = {
  prosecutionRationale: 'Provable but contestable.',
  defenseRationale: 'A deal beats the downside.',
};

function close(
  caseData = validCase,
  imposedSentence: Sentence[] = [],
  chargeVerdicts: ChargeVerdict[] | null = null,
): FinalResult {
  return FinalResultSchema.parse(buildFinalResult({
    caseData,
    pleaNarrative: PLEA_NARRATIVE,
    pleaDecision: chargeVerdicts === null ? 'ACCEPT' : 'REJECT',
    motionRulings: caseData.evidence.map((e) => ({ evidenceId: e.id, ruling: 'ADMITTED' as const })),
    chargeVerdicts: chargeVerdicts ?? [],
    imposedSentence,
    aftermathNarrative: 'The courthouse emptied by four.',
    completedAt: '2026-08-23T17:04:05.000Z',
  }));
}

const guilty = (caseData = validCase): ChargeVerdict[] => caseData.charges.map((c) => ({
  chargeId: c.id, chargeName: c.name, classification: c.classification, verdict: 'GUILTY' as const,
}));
const acquitted = (caseData = validCase): ChargeVerdict[] =>
  guilty(caseData).map((v) => ({ ...v, verdict: 'NOT_GUILTY' as const }));

const textOf = (list: { text: string }[]) => list.map((c) => c.text).join(' | ');

describe('describeConsequences — custody', () => {
  it('counts the term forward from the day it was imposed', () => {
    const result = close(validCase, [{ type: 'PRISON', unit: 'YEARS', amount: 4 }], guilty());
    // Sentenced in 2026 at 34: out in 2030 at the earliest, aged 38.
    expect(textOf(describeConsequences(validCase, result))).toMatch(/2030/);
    expect(textOf(describeConsequences(validCase, result))).toMatch(/\b38\b/);
  });

  it('counts a term of months to the calendar date it actually ends', () => {
    // Sentenced 2026-08-23 at 34. Eighteen months runs to February 2028 — a
    // release year the term's whole-year floor could never produce.
    const result = close(validCase, [{ type: 'PRISON', unit: 'MONTHS', amount: 18 }], guilty());
    expect(textOf(describeConsequences(validCase, result))).toMatch(/Out in 2028 at the earliest, aged 35/);
  });

  it('never releases a defendant in the year it sentenced them', () => {
    const result = close(validCase, [{ type: 'PRISON', unit: 'MONTHS', amount: 6 }], guilty());
    expect(textOf(describeConsequences(validCase, result))).toMatch(/Out in 2027 at the earliest, aged 34/);
  });

  it('says nothing about release when no custody was imposed', () => {
    const result = close(validCase, [{ type: 'FINE', unit: 'DOLLARS', amount: 2000 }], guilty());
    // The words the custody line actually uses — asserting against a phrase
    // the module never emits passes whether or not the guard is there.
    expect(textOf(describeConsequences(validCase, result))).not.toMatch(/remanded|at the earliest/i);
  });
});

describe('describeConsequences — the household', () => {
  it('names the dependents a custodial term leaves behind', () => {
    const withKids = CasePayloadSchema.parse({
      ...rawValidCase,
      defendant: { ...rawValidCase.defendant, demographics: { ...rawValidCase.defendant.demographics, children: 2 } },
    });
    const result = close(withKids, [{ type: 'PRISON', unit: 'YEARS', amount: 4 }], guilty(withKids));
    // Sentence-cased, because the line leads with the count.
    expect(textOf(describeConsequences(withKids, result))).toMatch(/Two children will spend that time/);
  });

  it('says nothing about children when there are none', () => {
    const result = close(validCase, [{ type: 'PRISON', unit: 'YEARS', amount: 4 }], guilty());
    expect(textOf(describeConsequences(validCase, result))).not.toMatch(/child/i);
  });

  it('does not raise dependents over a fine — the household is not separated by money', () => {
    const withKids = CasePayloadSchema.parse({
      ...rawValidCase,
      defendant: { ...rawValidCase.defendant, demographics: { ...rawValidCase.defendant.demographics, children: 2 } },
    });
    const result = close(withKids, [{ type: 'FINE', unit: 'DOLLARS', amount: 2000 }], guilty(withKids));
    expect(textOf(describeConsequences(withKids, result))).not.toMatch(/child/i);
  });
});

describe('describeConsequences — the record', () => {
  it('spells out what a felony conviction carries', () => {
    const result = close(validCase, [{ type: 'PRISON', unit: 'YEARS', amount: 2 }], guilty());
    expect(textOf(describeConsequences(validCase, result))).toMatch(/felony/i);
  });

  it('records that an acquittal leaves the arrest behind', () => {
    const result = close(validCase, [], acquitted());
    const text = textOf(describeConsequences(validCase, result));
    expect(text).toMatch(/no conviction/i);
    expect(text).toMatch(/arrest/i);
  });
});

describe('describeConsequences — money and supervision', () => {
  it('reads the fine as an obligation, not a line item', () => {
    const result = close(validCase, [{ type: 'FINE', unit: 'DOLLARS', amount: 2500 }], guilty());
    expect(textOf(describeConsequences(validCase, result))).toMatch(/\$2,500/);
  });

  it('supervises for one year, not "1 years"', () => {
    const result = close(validCase, [
      { type: 'PROBATION', unit: 'YEARS', amount: 1, conditions: ['RANDOM_DRUG_TESTING'] },
    ], guilty());
    expect(textOf(describeConsequences(validCase, result))).toMatch(/Supervised for 1 year:/);
  });

  it('lists probation conditions in plain words', () => {
    const result = close(validCase, [
      { type: 'PROBATION', unit: 'YEARS', amount: 3, conditions: ['RANDOM_DRUG_TESTING', 'NO_CONTACT_ORDER'] },
    ], guilty());
    const text = textOf(describeConsequences(validCase, result));
    expect(text).toMatch(/Random Drug Testing/);
    expect(text).toMatch(/No Contact Order/);
  });
});

describe('describeConsequences — shape', () => {
  it('produces a short, non-empty reading on every real docket outcome', () => {
    const plea = close(webbCase.payload, [{ type: 'PRISON', unit: 'YEARS', amount: 2 }]);
    const trial = close(webbCase.payload, [{ type: 'PRISON', unit: 'YEARS', amount: 3 }], guilty(webbCase.payload));
    const walk = close(webbCase.payload, [], acquitted(webbCase.payload));

    for (const result of [plea, trial, walk]) {
      const lines = describeConsequences(webbCase.payload, result);
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.length).toBeLessThanOrEqual(6);
      for (const line of lines) expect(line.text.length).toBeGreaterThan(0);
    }
  });
});
