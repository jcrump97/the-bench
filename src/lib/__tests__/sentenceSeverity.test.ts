import { describe, it, expect } from 'vitest';
import { deriveSentenceSeverity, severityOfImposedSentence } from '../sentenceSeverity';
import type { Sentence } from '../../schemas/gameSchemas';
import { webbCase } from '../demoCases/webb';

const exposure = (max: Sentence[], min: Sentence[] = []) => ({
  maximumPenalties: max,
  mandatoryMinimums: min,
});
const prison = (amount: number): Sentence => ({ type: 'PRISON', unit: 'YEARS', amount });
const fine = (amount: number): Sentence => ({ type: 'FINE', unit: 'DOLLARS', amount });
const probation = (amount: number): Sentence =>
  ({ type: 'PROBATION', unit: 'YEARS', amount, conditions: ['RANDOM_DRUG_TESTING'] });

describe('deriveSentenceSeverity — where the term sits in the range', () => {
  it('reads the floor of the range as leniency', () => {
    const severity = deriveSentenceSeverity([prison(1)], exposure([prison(10)]), null);
    expect(severity?.band).toBe('LENIENT');
    expect(severity?.shareOfExposure).toBe(0.1);
  });

  it('reads the lightest available term as lenient even on a short range', () => {
    // A three-year exposure with no mandatory minimum: one year is the least
    // the picker allows, so it is mercy, not the middle of the road.
    const severity = deriveSentenceSeverity([prison(1)], exposure([prison(3)]), null);
    expect(severity?.band).toBe('LENIENT');
    expect(severity?.atFloor).toBe(true);
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

  it('reads a range with no room in it as measured, not severe', () => {
    // A mandatory minimum equal to the maximum leaves exactly one lawful
    // term. The court chose nothing, so there is no mercy or hammer to read —
    // calling it "the maximum the statute allowed" credits a decision the
    // judge was never allowed to make.
    const severity = deriveSentenceSeverity([prison(5)], exposure([prison(5)], [prison(5)]), null);
    expect(severity?.band).toBe('MEASURED');
    expect(severity?.atFloor).toBe(true);
    expect(severity?.atCeiling).toBe(true);
  });

  it('positions a term inside a range that carries neither custody nor a fine', () => {
    // Probation and community service have no day or dollar equivalent, so
    // the floor, the ceiling and the imposed term all weighed zero: every
    // sentence read as the lightest one available, the maximum included.
    expect(deriveSentenceSeverity([probation(5)], exposure([probation(5)]), null)?.band).toBe('SEVERE');
    expect(deriveSentenceSeverity([probation(1)], exposure([probation(5)]), null)?.band).toBe('LENIENT');
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

  it('weighs custody against custody when only one side carries any', () => {
    // A partial acquittal can leave a fine standing on the one count that
    // stuck while the refused offer was years of custody. Weighing each side
    // on its own terms put dollars against days and called $5,000 the
    // harsher outcome.
    const severity = deriveSentenceSeverity([fine(5_000)], exposure([fine(5_000)]), [prison(3)]);
    expect(severity?.versusOffer).toBe('BELOW');
  });
});

describe('severityOfImposedSentence — resolved from end-of-game state', () => {
  it('has no refused offer to weigh an accepted plea against', () => {
    // On the plea path the imposed term *is* the bargain. Comparing it to the
    // offer told the aftermath the defendant had turned down the deal they
    // took.
    const severity = severityOfImposedSentence(webbCase.payload, 'ACCEPT', null, [prison(2)]);
    expect(severity).not.toBeNull();
    expect(severity?.versusOffer).toBeNull();
  });

  it('still weighs a trial sentence against the offer that was refused', () => {
    const verdict = webbCase.payload.charges.map((c) => ({
      chargeId: c.id, chargeName: c.name, classification: c.classification, verdict: 'GUILTY' as const,
    }));
    const severity = severityOfImposedSentence(webbCase.payload, 'REJECT', verdict, [prison(1)]);
    expect(severity?.versusOffer).not.toBeNull();
  });
});
