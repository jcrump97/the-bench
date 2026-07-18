import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { deriveSentencingExposure } from '../sentencingExposure';
import { ChargeSchema } from '../../schemas/gameSchemas';

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
});
