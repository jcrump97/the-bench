import { describe, it, expect } from 'vitest';
import { describeDemeanor } from '../demeanorNotes';
import { validCase } from './fixtures';

type Traits = (typeof validCase)['defendant']['oceanTraits'];
const TRAITS = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'] as const;

const allMid: Traits = { openness: 5, conscientiousness: 5, extraversion: 5, agreeableness: 5, neuroticism: 5 };

describe('describeDemeanor', () => {
  it('falls back to the unremarkable line when every trait is MID', () => {
    expect(describeDemeanor(allMid)).toBe(
      'Presented as unremarkable in interview: cooperative, measured, and steady throughout.',
    );
  });

  it.each(TRAITS)('produces a distinct observation for LOW and HIGH %s', (trait) => {
    const low = describeDemeanor({ ...allMid, [trait]: 1 });
    const high = describeDemeanor({ ...allMid, [trait]: 10 });
    expect(low).not.toBe(high);
    expect(low).not.toContain('unremarkable');
    expect(high).not.toContain('unremarkable');
  });

  it('reads as the anxious talker for Webb-shaped traits', () => {
    const note = describeDemeanor({ openness: 3, conscientiousness: 6, extraversion: 5, agreeableness: 5, neuroticism: 9 });
    expect(note).toContain('Visibly anxious under questioning');
    expect(note).toContain('Holds rigidly to a single account');
  });

  it('never leaks a digit, across every band combination', () => {
    for (let value = 1; value <= 10; value++) {
      for (const trait of TRAITS) {
        expect(describeDemeanor({ ...allMid, [trait]: value })).not.toMatch(/\d/);
      }
    }
    // A fully extreme profile stays digit-free too.
    expect(
      describeDemeanor({ openness: 1, conscientiousness: 10, extraversion: 1, agreeableness: 10, neuroticism: 10 }),
    ).not.toMatch(/\d/);
  });

  it('is deterministic and ordered: same traits, same note', () => {
    const traits: Traits = { openness: 9, conscientiousness: 2, extraversion: 8, agreeableness: 1, neuroticism: 10 };
    expect(describeDemeanor(traits)).toBe(describeDemeanor(traits));
  });
});
