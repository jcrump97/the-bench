import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { deriveSentencingExposure, selectSentenceableCharges } from '../sentencingExposure';
import { ChargeSchema, sentenceDayEquivalent, type ChargeVerdict } from '../../schemas/gameSchemas';

type RawCharge = z.input<typeof ChargeSchema>;

let nextId = 0;
function charge(overrides: Partial<RawCharge>): z.infer<typeof ChargeSchema> {
  nextId += 1;
  return ChargeSchema.parse({
    id: `c${nextId}`,
    name: 'Test charge',
    classification: 'FELONY',
    elements: [{ id: `c${nextId}-el`, description: 'An element.' }],
    mandatoryMinimums: [],
    maximumPenalties: [{ type: 'PRISON', unit: 'YEARS', amount: 3 }],
    verdictReactions: {
      GUILTY: [{ speaker: 'DEFENSE', text: 'The defense gives notice of appeal.' }],
      NOT_GUILTY: [{ speaker: 'PROSECUTION', text: 'The People accept the verdict.' }],
    },
    verdictOptions: [
      { choice: 'GUILTY', lineText: 'The court finds the defendant guilty.' },
      { choice: 'NOT_GUILTY', lineText: 'The court finds the defendant not guilty.' },
    ],
    ...overrides,
  });
}

describe('deriveSentencingExposure', () => {
  it('passes a single charge through unchanged', () => {
    const c = charge({
      mandatoryMinimums: [{ type: 'PRISON', unit: 'YEARS', amount: 1 }],
      maximumPenalties: [{ type: 'PRISON', unit: 'YEARS', amount: 3 }],
    });
    expect(deriveSentencingExposure([c])).toEqual({
      mandatoryMinimums: [{ type: 'PRISON', unit: 'YEARS', amount: 1 }],
      maximumPenalties: [{ type: 'PRISON', unit: 'YEARS', amount: 3 }],
    });
  });

  it('sums same-type, same-unit maxima across charges (consecutive exposure)', () => {
    const a = charge({ maximumPenalties: [{ type: 'PRISON', unit: 'YEARS', amount: 3 }] });
    const b = charge({ maximumPenalties: [{ type: 'PRISON', unit: 'YEARS', amount: 2 }] });
    expect(deriveSentencingExposure([a, b]).maximumPenalties).toEqual([
      { type: 'PRISON', unit: 'YEARS', amount: 5 },
    ]);
  });

  it('sums mixed time units in the finest unit present (exact YEARS→MONTHS)', () => {
    const a = charge({ maximumPenalties: [{ type: 'PRISON', unit: 'YEARS', amount: 1 }] });
    const b = charge({ maximumPenalties: [{ type: 'PRISON', unit: 'MONTHS', amount: 6 }] });
    expect(deriveSentencingExposure([a, b]).maximumPenalties).toEqual([
      { type: 'PRISON', unit: 'MONTHS', amount: 18 },
    ]);
  });

  it('keeps different sentence types as separate entries, in first-appearance order', () => {
    const a = charge({
      maximumPenalties: [
        { type: 'PRISON', unit: 'YEARS', amount: 3 },
        { type: 'FINE', unit: 'DOLLARS', amount: 10000 },
      ],
    });
    const b = charge({ maximumPenalties: [{ type: 'FINE', unit: 'DOLLARS', amount: 5000 }] });
    expect(deriveSentencingExposure([a, b]).maximumPenalties).toEqual([
      { type: 'PRISON', unit: 'YEARS', amount: 3 },
      { type: 'FINE', unit: 'DOLLARS', amount: 15000 },
    ]);
  });

  it('takes the largest same-type minimum across charges (concurrent floor)', () => {
    const a = charge({
      mandatoryMinimums: [{ type: 'PRISON', unit: 'YEARS', amount: 1 }],
      maximumPenalties: [{ type: 'PRISON', unit: 'YEARS', amount: 3 }],
    });
    // 18 months (~547 days) outranks 1 year (365 days) despite the coarser unit on a.
    const b = charge({
      mandatoryMinimums: [{ type: 'PRISON', unit: 'MONTHS', amount: 18 }],
      maximumPenalties: [{ type: 'PRISON', unit: 'YEARS', amount: 5 }],
    });
    expect(deriveSentencingExposure([a, b]).mandatoryMinimums).toEqual([
      { type: 'PRISON', unit: 'MONTHS', amount: 18 },
    ]);
  });

  it('merges PROBATION maxima with a union of conditions in the finest unit', () => {
    const a = charge({
      maximumPenalties: [
        { type: 'PROBATION', unit: 'YEARS', amount: 2, conditions: ['RANDOM_DRUG_TESTING'] },
      ],
    });
    const b = charge({
      maximumPenalties: [
        { type: 'PROBATION', unit: 'MONTHS', amount: 6, conditions: ['RANDOM_DRUG_TESTING', 'NO_CONTACT_ORDER'] },
      ],
    });
    expect(deriveSentencingExposure([a, b]).maximumPenalties).toEqual([
      {
        type: 'PROBATION',
        unit: 'MONTHS',
        amount: 30,
        conditions: ['RANDOM_DRUG_TESTING', 'NO_CONTACT_ORDER'],
      },
    ]);
  });

  it('returns empty minimums when no charge carries one', () => {
    expect(deriveSentencingExposure([charge({}), charge({})]).mandatoryMinimums).toEqual([]);
  });

  it('collapses to PRISON when a case mixes a prison-eligible charge with a jail-only charge', () => {
    const felony = charge({
      maximumPenalties: [
        { type: 'PRISON', unit: 'YEARS', amount: 3 },
        { type: 'FINE', unit: 'DOLLARS', amount: 10000 },
      ],
    });
    const misdemeanor = charge({
      classification: 'MISDEMEANOR',
      maximumPenalties: [{ type: 'JAIL', unit: 'MONTHS', amount: 6 }],
    });
    expect(deriveSentencingExposure([felony, misdemeanor])).toEqual({
      mandatoryMinimums: [],
      maximumPenalties: [
        { type: 'PRISON', unit: 'YEARS', amount: 3 },
        { type: 'FINE', unit: 'DOLLARS', amount: 10000 },
      ],
    });
  });

  it('keeps the stricter minimum (as PRISON) when both a PRISON and a JAIL minimum are present', () => {
    const felony = charge({
      mandatoryMinimums: [{ type: 'PRISON', unit: 'YEARS', amount: 1 }],
      maximumPenalties: [{ type: 'PRISON', unit: 'YEARS', amount: 3 }],
    });
    const misdemeanor = charge({
      classification: 'MISDEMEANOR',
      mandatoryMinimums: [{ type: 'JAIL', unit: 'DAYS', amount: 30 }],
      maximumPenalties: [{ type: 'JAIL', unit: 'MONTHS', amount: 6 }],
    });
    // The felony's own 1-year PRISON floor outranks the misdemeanor's
    // 30-day JAIL floor, so it survives unchanged.
    expect(deriveSentencingExposure([felony, misdemeanor]).mandatoryMinimums).toEqual([
      { type: 'PRISON', unit: 'YEARS', amount: 1 },
    ]);
  });

  it('converts a JAIL minimum to PRISON rather than dropping it when the PRISON charge carries no minimum of its own', () => {
    const felony = charge({
      maximumPenalties: [{ type: 'PRISON', unit: 'YEARS', amount: 3 }],
    });
    const misdemeanor = charge({
      classification: 'MISDEMEANOR',
      mandatoryMinimums: [{ type: 'JAIL', unit: 'DAYS', amount: 30 }],
      maximumPenalties: [{ type: 'JAIL', unit: 'MONTHS', amount: 6 }],
    });
    // A real statutory floor must not silently vanish just because the
    // charge that carried it wasn't the one that decided the custody type.
    expect(deriveSentencingExposure([felony, misdemeanor]).mandatoryMinimums).toEqual([
      { type: 'PRISON', unit: 'DAYS', amount: 30 },
    ]);
  });

  it('leaves an all-JAIL case untouched (no PRISON to collapse toward)', () => {
    const a = charge({ classification: 'MISDEMEANOR', maximumPenalties: [{ type: 'JAIL', unit: 'MONTHS', amount: 6 }] });
    const b = charge({ classification: 'MISDEMEANOR', maximumPenalties: [{ type: 'JAIL', unit: 'MONTHS', amount: 3 }] });
    expect(deriveSentencingExposure([a, b]).maximumPenalties).toEqual([
      { type: 'JAIL', unit: 'MONTHS', amount: 9 },
    ]);
  });

  it('never derives a floor above its own ceiling when a JAIL minimum converts', () => {
    // The felony's PRISON ceiling (6 months) is *shorter* than the
    // misdemeanor's JAIL floor (1 year), so converting the floor to PRISON
    // unclamped produced min 1 YEAR against max 6 MONTHS — a range the plea
    // offer and the sentencing picker read in opposite directions.
    const felony = charge({
      maximumPenalties: [{ type: 'PRISON', unit: 'MONTHS', amount: 6 }],
    });
    const misdemeanor = charge({
      classification: 'MISDEMEANOR',
      mandatoryMinimums: [{ type: 'JAIL', unit: 'YEARS', amount: 1 }],
      maximumPenalties: [{ type: 'JAIL', unit: 'YEARS', amount: 1 }],
    });

    const exposure = deriveSentencingExposure([felony, misdemeanor]);
    const floor = exposure.mandatoryMinimums.find((s) => s.type === 'PRISON');
    const ceiling = exposure.maximumPenalties.find((s) => s.type === 'PRISON');

    expect(floor).toBeDefined();
    expect(ceiling).toBeDefined();
    expect(sentenceDayEquivalent(floor!)!).toBeLessThanOrEqual(sentenceDayEquivalent(ceiling!)!);
    // The ceiling wins: a floor cannot exceed the longest authorized term.
    expect(floor).toEqual({ type: 'PRISON', unit: 'MONTHS', amount: 6 });
  });

  it('keeps both custody options on a single wobbler count that lists PRISON and JAIL', () => {
    // §1170(h)/§17(b) alternative sentencing on one count is not §669
    // aggregation across counts — both terms are genuinely available to the
    // court, so collapsing to PRISON would delete a lawful option.
    const wobbler = charge({
      maximumPenalties: [
        { type: 'PRISON', unit: 'YEARS', amount: 3 },
        { type: 'JAIL', unit: 'YEARS', amount: 1 },
      ],
    });

    expect(deriveSentencingExposure([wobbler]).maximumPenalties).toEqual([
      { type: 'PRISON', unit: 'YEARS', amount: 3 },
      { type: 'JAIL', unit: 'YEARS', amount: 1 },
    ]);
  });

  it('still collapses when a separate count is jail-only (the §669 case)', () => {
    const felony = charge({ maximumPenalties: [{ type: 'PRISON', unit: 'YEARS', amount: 3 }] });
    const misdemeanor = charge({
      classification: 'MISDEMEANOR',
      maximumPenalties: [{ type: 'JAIL', unit: 'MONTHS', amount: 6 }],
    });

    expect(deriveSentencingExposure([felony, misdemeanor]).maximumPenalties).toEqual([
      { type: 'PRISON', unit: 'YEARS', amount: 3 },
    ]);
  });
});

describe('selectSentenceableCharges', () => {
  const felony = charge({ maximumPenalties: [{ type: 'PRISON', unit: 'YEARS', amount: 3 }] });
  const misdemeanor = charge({
    classification: 'MISDEMEANOR',
    maximumPenalties: [{ type: 'JAIL', unit: 'MONTHS', amount: 6 }],
  });
  const verdict = (id: string, value: 'GUILTY' | 'NOT_GUILTY'): ChargeVerdict => ({
    chargeId: id,
    chargeName: 'Test charge',
    classification: 'FELONY',
    verdict: value,
  });

  it('takes every count on the plea path (the defendant pleads to all of them)', () => {
    expect(selectSentenceableCharges([felony, misdemeanor], true, [])).toEqual([felony, misdemeanor]);
  });

  it('takes only GUILTY counts on the trial path', () => {
    const selected = selectSentenceableCharges([felony, misdemeanor], false, [
      verdict(felony.id, 'NOT_GUILTY'),
      verdict(misdemeanor.id, 'GUILTY'),
    ]);
    expect(selected).toEqual([misdemeanor]);
  });

  it('leaves the convicted count its own custody type when the prison-eligible count is acquitted', () => {
    // The regression: exposure was derived from all charges, so the acquitted
    // felony's PRISON range collapsed away the convicted misdemeanor's JAIL
    // range — the bench was offered prison on a count the defendant beat, and
    // no jail on the count they lost.
    const selected = selectSentenceableCharges([felony, misdemeanor], false, [
      verdict(felony.id, 'NOT_GUILTY'),
      verdict(misdemeanor.id, 'GUILTY'),
    ]);
    expect(deriveSentencingExposure(selected).maximumPenalties).toEqual([
      { type: 'JAIL', unit: 'MONTHS', amount: 6 },
    ]);
  });

  it('returns nothing on a full acquittal, so the caller adjourns', () => {
    const selected = selectSentenceableCharges([felony, misdemeanor], false, [
      verdict(felony.id, 'NOT_GUILTY'),
      verdict(misdemeanor.id, 'NOT_GUILTY'),
    ]);
    expect(selected).toEqual([]);
    expect(deriveSentencingExposure(selected)).toEqual({ mandatoryMinimums: [], maximumPenalties: [] });
  });
});
