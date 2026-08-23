import { describe, it, expect } from 'vitest';
import { deriveSentenceSeverity } from '../sentenceSeverity';
import type { Sentence } from '../../schemas/gameSchemas';

const exposure = (max: Sentence[], min: Sentence[] = []) => ({
  maximumPenalties: max,
  mandatoryMinimums: min,
});
const prison = (amount: number): Sentence => ({ type: 'PRISON', unit: 'YEARS', amount });
const fine = (amount: number): Sentence => ({ type: 'FINE', unit: 'DOLLARS', amount });

describe('deriveSentenceSeverity — where the term sits in the range', () => {
  it('reads the floor of the range as leniency', () => {
    const severity = deriveSentenceSeverity([prison(1)], exposure([prison(10)]), null);
    expect(severity?.band).toBe('LENIENT');
    expect(severity?.shareOfExposure).toBe(0.1);
  });

  it('reads the ceiling as severity', () => {
    expect(deriveSentenceSeverity([prison(10)], exposure([prison(10)]), null)?.band).toBe('SEVERE');
  });

  it('reads the middle of the range as measured', () => {
    expect(deriveSentenceSeverity([prison(5)], exposure([prison(10)]), null)?.band).toBe('MEASURED');
  });

  it('measures custody alone when the sentence mixes custody with a fine', () => {
    // A maxed-out fine alongside a year of a ten-year exposure is still a
    // lenient sentence: time is what a person serves.
    const severity = deriveSentenceSeverity([prison(1), fine(10_000)], exposure([prison(10), fine(10_000)]), null);
    expect(severity?.band).toBe('LENIENT');
    expect(severity?.shareOfExposure).toBe(0.1);
  });

  it('falls back to the non-custodial terms when no custody is imposed', () => {
    expect(deriveSentenceSeverity([fine(10_000)], exposure([fine(10_000)]), null)?.band).toBe('SEVERE');
    expect(deriveSentenceSeverity([fine(1_000)], exposure([fine(10_000)]), null)?.band).toBe('LENIENT');
  });

  it('is null when nothing was imposed — an acquittal has no severity', () => {
    expect(deriveSentenceSeverity([], exposure([prison(10)]), null)).toBeNull();
  });

  it('reads a sentence at the mandatory minimum as lenient even in a narrow range', () => {
    // Floor 5, ceiling 6: the court gave everything the statute allowed it to.
    const severity = deriveSentenceSeverity([prison(5)], exposure([prison(6)], [prison(5)]), null);
    expect(severity?.band).toBe('LENIENT');
    expect(severity?.atFloor).toBe(true);
  });

  it('reads a maxed sentence as severe even when the floor is high', () => {
    const severity = deriveSentenceSeverity([prison(6)], exposure([prison(6)], [prison(5)]), null);
    expect(severity?.band).toBe('SEVERE');
    expect(severity?.atCeiling).toBe(true);
  });
});

describe('deriveSentenceSeverity — against the deal the judge refused', () => {
  it('records a term below the offer the defendant turned down', () => {
    const severity = deriveSentenceSeverity([prison(5)], exposure([prison(10)]), [prison(8)]);
    expect(severity?.versusOffer).toBe('BELOW');
  });

  it('records a trial penalty — more time than the offer on the table', () => {
    expect(deriveSentenceSeverity([prison(9)], exposure([prison(10)]), [prison(8)])?.versusOffer).toBe('ABOVE');
  });

  it('records a term that matches the offer', () => {
    expect(deriveSentenceSeverity([prison(8)], exposure([prison(10)]), [prison(8)])?.versusOffer).toBe('MATCHES');
  });

  it('has nothing to compare against when no offer was ever made', () => {
    expect(deriveSentenceSeverity([prison(8)], exposure([prison(10)]), null)?.versusOffer).toBeNull();
  });
});
