import type { CasePayload } from '../schemas/gameSchemas';
import { traitBand } from './interrogation';

// ============================================================================
// Demeanor notes: the OCEAN traits, rendered invisible.
//
// The traits are behavior drivers, never display data — they steer plea
// tolerance (assessDefense) and the interrogation room
// (deriveInterrogationProfile) without the player ever seeing a number.
// What the judge gets instead is what a real judge gets: a probation
// officer's qualitative read of the defendant. Derived, deterministic, and
// digit-free by contract — no score ever leaks into the prose.
// ============================================================================

type OceanTraits = CasePayload['defendant']['oceanTraits'];

// One observation per non-MID trait, in the probation report's register.
const TRAIT_OBSERVATIONS: Record<keyof OceanTraits, { LOW: string; HIGH: string }> = {
  openness: {
    LOW: 'Holds rigidly to a single account of events and resists engaging with alternatives.',
    HIGH: 'Engages readily with hypotheticals and alternative accounts of events.',
  },
  conscientiousness: {
    LOW: 'Has missed scheduled appointments and arrived without requested documentation.',
    HIGH: 'Arrived prepared and on time, documentation in order; keeps commitments to the letter.',
  },
  extraversion: {
    LOW: 'Spoke only when addressed and offered nothing beyond the question asked.',
    HIGH: 'Talkative and expansive in interview, volunteering more than was asked.',
  },
  agreeableness: {
    LOW: 'Combative in interview and quick to dispute characterizations of the record.',
    HIGH: 'Cooperative to the point of deference; agrees readily with figures of authority.',
  },
  neuroticism: {
    LOW: 'Notably composed throughout, including when confronted with the conduct at issue.',
    HIGH: 'Visibly anxious under questioning; composure deteriorates under sustained pressure.',
  },
};

// Fixed iteration order so the note reads the same for the same defendant.
const TRAIT_ORDER: readonly (keyof OceanTraits)[] = [
  'openness',
  'conscientiousness',
  'extraversion',
  'agreeableness',
  'neuroticism',
];

export function describeDemeanor(traits: OceanTraits): string {
  const observations: string[] = [];
  for (const trait of TRAIT_ORDER) {
    const band = traitBand(traits[trait]);
    if (band === 'MID') continue;
    observations.push(TRAIT_OBSERVATIONS[trait][band]);
  }
  if (observations.length === 0) {
    return 'Presented as unremarkable in interview: cooperative, measured, and steady throughout.';
  }
  return observations.join(' ');
}
