import { describe, it, expect } from 'vitest';
import { PRICED_MODELS, PRICE_TABLE_AS_OF, costPerCase, findPricedModel, priceOn } from '../modelPricing';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

describe('PRICED_MODELS', () => {
  it('has unique ids written as ListModels names them', () => {
    const ids = PRICED_MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).not.toMatch(/^models\//);
      expect(id).not.toMatch(/-latest$/);
    }
  });

  it('dates every entry and orders each price history oldest first, starting no earlier than release', () => {
    expect(PRICE_TABLE_AS_OF).toMatch(DAY);
    for (const m of PRICED_MODELS) {
      expect(m.released).toMatch(DAY);
      if (m.shutdown !== null) {
        expect(m.shutdown).toMatch(DAY);
        expect(m.shutdown > m.released).toBe(true);
      }
      expect(m.prices.length).toBeGreaterThan(0);
      expect(m.prices[0]?.from).toBe(m.released);
      for (let i = 1; i < m.prices.length; i += 1) {
        expect((m.prices[i]?.from ?? '') > (m.prices[i - 1]?.from ?? '')).toBe(true);
      }
      for (const p of m.prices) {
        expect(p.from).toMatch(DAY);
        expect(p.inputPerMillionTokens).toBeGreaterThan(0);
        expect(p.outputPerMillionTokens).toBeGreaterThan(0);
      }
      expect(m.source).toMatch(/^https:\/\/ai\.google\.dev\//);
    }
  });
});

describe('priceOn', () => {
  const flash38 = findPricedModel('gemini-3.8-flash');
  const lite31 = findPricedModel('gemini-3.1-flash-lite');

  it('returns the period in effect on the UTC day', () => {
    expect(flash38).toBeDefined();
    if (flash38 === undefined) return;
    expect(priceOn(flash38, new Date('2026-12-31T23:59:59Z'))?.inputPerMillionTokens).toBe(0.75);
    expect(priceOn(flash38, new Date('2027-01-01T00:00:00Z'))?.inputPerMillionTokens).toBe(1.5);
  });

  it('returns null before release and from the shutdown day on', () => {
    expect(flash38).toBeDefined();
    expect(lite31).toBeDefined();
    if (flash38 === undefined || lite31 === undefined) return;
    expect(priceOn(flash38, new Date('2026-09-01T12:00:00Z'))).toBeNull();
    expect(priceOn(lite31, new Date('2027-05-06T12:00:00Z'))).not.toBeNull();
    expect(priceOn(lite31, new Date('2027-05-07T00:00:00Z'))).toBeNull();
  });
});

describe('costPerCase', () => {
  it('weights input and output by the measured per-case token mix', () => {
    // 4,300 input tokens at $1/M plus 5,600 output tokens at $1/M.
    expect(costPerCase({ from: '2026-01-01', inputPerMillionTokens: 1, outputPerMillionTokens: 1 })).toBeCloseTo(
      0.0099,
      6,
    );
    // Output dominates: dearer output outweighs cheaper input.
    const cheapIn = costPerCase({ from: '2026-01-01', inputPerMillionTokens: 0.1, outputPerMillionTokens: 3 });
    const cheapOut = costPerCase({ from: '2026-01-01', inputPerMillionTokens: 0.5, outputPerMillionTokens: 2 });
    expect(cheapOut).toBeLessThan(cheapIn);
  });
});
