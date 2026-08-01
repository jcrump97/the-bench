import type { CasePayload } from '../schemas/gameSchemas';

// ============================================================================
// The interrogation room, derived. Traits decide what happened; prose decides
// how it sounded.
//
// deriveInterrogationProfile is the OCEAN traits' second deterministic
// consumer (alongside assessDefense's risk tolerance): it maps the
// defendant's temperament and record to the closed structural facts of the
// custodial interview — what the interview produced, and on what ground the
// defense attacks the tape. The authored transcript (later, the
// InterrogationGen pipeline stage) must dramatize exactly this structure;
// defineDemoCase enforces the match through the schema's echo fields.
// ============================================================================

type Defendant = CasePayload['defendant'];

export type TraitBand = 'LOW' | 'MID' | 'HIGH';

// Shared banding for every trait-driven derivation (this profile, the
// sentencing demeanor notes): 1–3 LOW, 4–7 MID, 8–10 HIGH.
export function traitBand(value: number): TraitBand {
  if (value <= 3) return 'LOW';
  if (value <= 7) return 'MID';
  return 'HIGH';
}

// Discriminated on outcome: an invocation of counsel produces no usable tape,
// so there is nothing for the defense to move against — no challengeGround
// exists, and no INTERROGATION exhibit can be authored for such a defendant.
export type InterrogationProfile =
  | { outcome: 'INVOKED_COUNSEL' }
  | {
      outcome: 'FULL_CONFESSION' | 'PARTIAL_ADMISSION' | 'DENIAL';
      challengeGround: 'MIRANDA' | 'VOLUNTARINESS';
    };

export function deriveInterrogationProfile(defendant: Defendant): InterrogationProfile {
  const { neuroticism, agreeableness } = defendant.oceanTraits;
  const priors = defendant.pastConvictions.length;

  // HIGH neuroticism talks despite knowing better — anxiety outranks the
  // learned caution of a long record. The pressure that opened them up is
  // exactly what the defense attacks: voluntariness.
  if (traitBand(neuroticism) === 'HIGH') {
    return {
      outcome: traitBand(agreeableness) === 'HIGH' ? 'FULL_CONFESSION' : 'PARTIAL_ADMISSION',
      challengeGround: 'VOLUNTARINESS',
    };
  }

  // Three or more priors knows the drill: lawyer, immediately. The interview
  // ends before it begins and no exhibit ever exists.
  if (priors >= 3) {
    return { outcome: 'INVOKED_COUNSEL' };
  }

  // HIGH agreeableness cooperates: waives Miranda too readily and talks all
  // the way into a full confession — so the waiver itself is the fight.
  if (traitBand(agreeableness) === 'HIGH') {
    return { outcome: 'FULL_CONFESSION', challengeGround: 'MIRANDA' };
  }

  // Everyone else holds the line — terse, combative, or simply careful —
  // and the defense contests the waiver.
  return { outcome: 'DENIAL', challengeGround: 'MIRANDA' };
}
