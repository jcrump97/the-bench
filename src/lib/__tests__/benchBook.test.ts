import { describe, it, expect } from 'vitest';
import { BENCH_BOOK_TERMS, SIMPLIFICATIONS, UNDER_THE_HOOD } from '../benchBook';

const allTerms = BENCH_BOOK_TERMS.flatMap((group) => group.terms);
const allText = [
  ...allTerms.flatMap((t) => [t.term, t.plain, t.authority ?? '', t.inThisCourt ?? '']),
  ...SIMPLIFICATIONS,
  ...UNDER_THE_HOOD.flatMap((item) => [item.heading, item.body]),
].join('\n');

describe('Bench Book', () => {
  it('defines each term once', () => {
    const names = allTerms.map((t) => t.term.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it('gives every term a plain-English definition written as a sentence', () => {
    for (const { term, plain } of allTerms) {
      expect(plain.length, term).toBeGreaterThan(20);
      expect(plain.endsWith('.'), term).toBe(true);
    }
  });

  it('cites authorities in a recognizable form', () => {
    const cited = allTerms.flatMap((t) => (t.authority === undefined ? [] : [t.authority]));
    expect(cited.length).toBeGreaterThan(0);
    for (const authority of cited) {
      expect(authority).toMatch(/^(Cal\. (Penal|Evid\.) Code §|Cal\. Const\.|[A-Z][a-z]+ v\. [A-Z][a-z]+ \(\d{4}\) \d+ U\.S\. \d+)/);
    }
  });

  // The defendant's personality traits drive behavior but are never display
  // data (CLAUDE.md, Vision). A reference page must not name them either.
  it('never names the hidden personality model', () => {
    expect(allText).not.toMatch(/\bOCEAN\b|openness|conscientiousness|extraversion|agreeableness|neuroticism/i);
  });
});
