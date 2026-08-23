import { describe, it, expect } from 'vitest';
import { formatCustodyTotal, formatJudgmentDate, enumLabel, formatSentence, formatSentenceList } from '../format';

describe('enumLabel', () => {
  it('title-cases a single-word enum value', () => {
    expect(enumLabel('FELONY')).toBe('Felony');
  });

  it('title-cases and spaces a multi-word enum value', () => {
    expect(enumLabel('NOT_GUILTY')).toBe('Not Guilty');
    expect(enumLabel('SUBSTANCE_ABUSE_TREATMENT')).toBe('Substance Abuse Treatment');
    expect(enumLabel('PUBLIC_SPACE')).toBe('Public Space');
  });

  it('passes N/A through unchanged', () => {
    expect(enumLabel('N/A')).toBe('N/A');
  });
});

describe('formatSentence', () => {
  it('formats PRISON with correct pluralization', () => {
    expect(formatSentence({ type: 'PRISON', unit: 'YEARS', amount: 1 })).toBe('1 year in prison');
    expect(formatSentence({ type: 'PRISON', unit: 'YEARS', amount: 3 })).toBe('3 years in prison');
  });

  it('formats JAIL', () => {
    expect(formatSentence({ type: 'JAIL', unit: 'DAYS', amount: 90 })).toBe('90 days in jail');
  });

  it('formats FINE with thousands separators', () => {
    expect(formatSentence({ type: 'FINE', unit: 'DOLLARS', amount: 5000 })).toBe('$5,000 fine');
  });

  it('formats COMMUNITY_SERVICE', () => {
    expect(formatSentence({ type: 'COMMUNITY_SERVICE', unit: 'HOURS', amount: 1 })).toBe('1 hour of community service');
    expect(formatSentence({ type: 'COMMUNITY_SERVICE', unit: 'HOURS', amount: 40 })).toBe('40 hours of community service');
  });

  it('formats PROBATION with its conditions listed', () => {
    expect(
      formatSentence({
        type: 'PROBATION',
        unit: 'YEARS',
        amount: 2,
        conditions: ['RANDOM_DRUG_TESTING', 'SUBSTANCE_ABUSE_TREATMENT'],
      })
    ).toBe('2 years probation (Random Drug Testing, Substance Abuse Treatment)');
  });
});

describe('formatSentenceList', () => {
  it('returns a fallback message for an empty list', () => {
    expect(formatSentenceList([])).toBe('No sentence recorded');
  });

  it('joins multiple sentences', () => {
    expect(
      formatSentenceList([
        { type: 'PRISON', unit: 'YEARS', amount: 2 },
        { type: 'FINE', unit: 'DOLLARS', amount: 1000 },
      ])
    ).toBe('2 years in prison; $1,000 fine');
  });
});

describe('formatJudgmentDate', () => {
  it('renders a stored ISO timestamp as a readable filing date', () => {
    // Locale and timezone are the reader's, so the assertion pins the parts
    // that cannot move rather than one machine's formatting.
    expect(formatJudgmentDate('2026-08-23T17:04:05.000Z')).toMatch(/2026/);
    expect(formatJudgmentDate('2026-08-23T17:04:05.000Z')).toMatch(/Aug 2[34]/);
  });

  it('never renders Invalid Date onto the record', () => {
    expect(formatJudgmentDate('not a timestamp')).toBe('date unavailable');
  });
});

describe('formatCustodyTotal', () => {
  it('reports a running total in the units people say', () => {
    expect(formatCustodyTotal(0)).toBe('none');
    expect(formatCustodyTotal(365)).toBe('1 year');
    expect(formatCustodyTotal(365 * 4 + 365 / 12 * 3)).toBe('4 years, 3 months');
    expect(formatCustodyTotal(365 / 12 * 8)).toBe('8 months');
  });

  it('never rounds a real term down to nothing', () => {
    expect(formatCustodyTotal(9)).toBe('9 days');
    expect(formatCustodyTotal(0.4)).toBe('1 day');
  });
});
