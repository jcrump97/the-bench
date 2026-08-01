import { describe, it, expect } from 'vitest';
import { deriveInterrogationProfile, traitBand, type InterrogationProfile } from '../interrogation';
import { validCase } from './fixtures';

// Builds a defendant off the fixture with the traits/priors under test.
function defendantWith(
  traits: Partial<(typeof validCase)['defendant']['oceanTraits']>,
  priorCount = 0,
) {
  const prior = {
    chargeName: 'Petty Theft (Cal. Penal Code § 484)',
    year: 2015,
    sentences: [],
  };
  return {
    ...validCase.defendant,
    oceanTraits: { ...validCase.defendant.oceanTraits, ...traits },
    pastConvictions: Array.from({ length: priorCount }, () => prior),
  };
}

describe('traitBand', () => {
  it('bands 1–3 LOW, 4–7 MID, 8–10 HIGH at the boundaries', () => {
    expect(traitBand(1)).toBe('LOW');
    expect(traitBand(3)).toBe('LOW');
    expect(traitBand(4)).toBe('MID');
    expect(traitBand(7)).toBe('MID');
    expect(traitBand(8)).toBe('HIGH');
    expect(traitBand(10)).toBe('HIGH');
  });
});

describe('deriveInterrogationProfile', () => {
  it('HIGH neuroticism talks — and outranks a record that should know better', () => {
    // Webb's shape: neuroticism 9, four priors, mid agreeableness.
    const profile = deriveInterrogationProfile(defendantWith({ neuroticism: 9, agreeableness: 5 }, 4));
    expect(profile).toEqual({ outcome: 'PARTIAL_ADMISSION', challengeGround: 'VOLUNTARINESS' });
  });

  it('HIGH neuroticism plus HIGH agreeableness confesses in full', () => {
    const profile = deriveInterrogationProfile(defendantWith({ neuroticism: 8, agreeableness: 9 }));
    expect(profile).toEqual({ outcome: 'FULL_CONFESSION', challengeGround: 'VOLUNTARINESS' });
  });

  it('three priors without the anxiety invokes counsel — no usable tape exists', () => {
    const profile = deriveInterrogationProfile(defendantWith({ neuroticism: 2, agreeableness: 9 }, 3));
    expect(profile).toEqual({ outcome: 'INVOKED_COUNSEL' });
  });

  it('HIGH agreeableness with a clean-enough record waives too readily and confesses', () => {
    const profile = deriveInterrogationProfile(defendantWith({ neuroticism: 4, agreeableness: 8 }, 2));
    expect(profile).toEqual({ outcome: 'FULL_CONFESSION', challengeGround: 'MIRANDA' });
  });

  it('everyone else holds the line: denial, with the waiver contested', () => {
    // Reyes's shape (low neuroticism, low agreeableness, no priors) and the
    // all-MID fixture defendant both land here.
    expect(deriveInterrogationProfile(defendantWith({ neuroticism: 2, agreeableness: 3 }))).toEqual({
      outcome: 'DENIAL',
      challengeGround: 'MIRANDA',
    });
    expect(deriveInterrogationProfile(validCase.defendant)).toEqual({
      outcome: 'DENIAL',
      challengeGround: 'MIRANDA',
    });
  });

  it('is total: every neuroticism × agreeableness band × prior count yields a well-formed profile', () => {
    const outcomes = new Set<InterrogationProfile['outcome']>();
    for (let neuroticism = 1; neuroticism <= 10; neuroticism++) {
      for (let agreeableness = 1; agreeableness <= 10; agreeableness++) {
        for (const priors of [0, 1, 2, 3, 4]) {
          const profile = deriveInterrogationProfile(
            defendantWith({ neuroticism, agreeableness }, priors),
          );
          outcomes.add(profile.outcome);
          if (profile.outcome === 'INVOKED_COUNSEL') {
            // Discriminated: no challenge ground exists without a tape.
            expect('challengeGround' in profile).toBe(false);
          } else {
            expect(['MIRANDA', 'VOLUNTARINESS']).toContain(profile.challengeGround);
          }
        }
      }
    }
    // Every outcome in the vocabulary is reachable.
    expect(outcomes).toEqual(
      new Set(['FULL_CONFESSION', 'PARTIAL_ADMISSION', 'DENIAL', 'INVOKED_COUNSEL']),
    );
  });

  it('is pure: identical input produces an identical profile', () => {
    const defendant = defendantWith({ neuroticism: 9 }, 4);
    expect(deriveInterrogationProfile(defendant)).toEqual(deriveInterrogationProfile(defendant));
  });
});
