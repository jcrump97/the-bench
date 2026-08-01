import type { StatementBeat, StatementEntryKind } from './courtroomScript';

// ============================================================================
// Progressive reveal: what has the judge lawfully seen?
//
// Derived — never stored — from the revealed prefix of the courtroom script,
// so the panels and detail modals can only ever show what has actually been
// spoken into the record. Two tiers:
//
//   DISCLOSED — counsel disclosed the item in Act 1 discovery. The judge
//               knows it exists and has counsel's brief, unverified summary.
//   PRESENTED — the item was actually presented: the exhibit offered in
//               Act 2, the witness sworn and examined in Act 3. Full detail.
//
// The upgrade is monotonic (PRESENTED never falls back to DISCLOSED), and an
// accepted plea correctly never upgrades past DISCLOSED: no trial happened,
// nothing was presented.
// ============================================================================

export type RevealTier = 'DISCLOSED' | 'PRESENTED';

export interface RevealState {
  evidence: Map<string, RevealTier>;
  witnesses: Map<string, RevealTier>;
  // Charges have one tier: read into the record at arraignment.
  charges: Set<string>;
  // The People have stated the case — gates the narrative summary.
  factsStated: boolean;
}

// The beats that change what the judge has seen, and to which tier. Every
// other subject-stamped beat (objections, rulings, cross, playback, verdicts)
// follows one of these in the record, so the minimal set is the total one.
const TIER_BY_KIND: Partial<Record<StatementEntryKind, RevealTier>> = {
  DISCOVERY_EXHIBIT: 'DISCLOSED',
  DISCOVERY_WITNESS: 'DISCLOSED',
  EXHIBIT_OFFERED: 'PRESENTED',
  TESTIMONY_DIRECT: 'PRESENTED',
};

function upgrade(map: Map<string, RevealTier>, id: string, tier: RevealTier): void {
  if (tier === 'PRESENTED' || !map.has(id)) {
    map.set(id, tier);
  }
}

export function deriveRevealState(visibleBeats: readonly StatementBeat[]): RevealState {
  const state: RevealState = {
    evidence: new Map(),
    witnesses: new Map(),
    charges: new Set(),
    factsStated: false,
  };

  for (const beat of visibleBeats) {
    if (beat.entryKind === 'STATEMENT_OF_FACTS') {
      state.factsStated = true;
    }
    if (beat.subject === undefined) continue;
    if (beat.subject.type === 'CHARGE' && beat.entryKind === 'CHARGE_READ') {
      state.charges.add(beat.subject.id);
      continue;
    }
    const tier = TIER_BY_KIND[beat.entryKind];
    if (tier === undefined) continue;
    if (beat.subject.type === 'EVIDENCE') {
      upgrade(state.evidence, beat.subject.id, tier);
    } else if (beat.subject.type === 'WITNESS') {
      upgrade(state.witnesses, beat.subject.id, tier);
    }
  }

  return state;
}
