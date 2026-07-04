import type { Charge, Sentence } from '../schemas/gameSchemas';
import { UNIT_DAYS } from './sentenceBounds';

// Case-level sentencing exposure, derived deterministically from per-charge
// statutory ranges. Charges are the source of truth — the LLM generates only
// per-charge facts; the aggregation policy lives here, in code:
//   - maximumPenalties: consecutive-sentence presumption — same-type maxima
//     sum across charges. Mixed time units sum in the finest unit present
//     (YEARS → MONTHS is exact; conversions involving DAYS round to the
//     nearest day). Merged PROBATION entries union their conditions.
//   - mandatoryMinimums: concurrent presumption — the largest same-type
//     minimum across charges is the floor.
// Per-charge validation (ChargeSchema) guarantees every minimum has a
// same-type maximum on its own charge, so every derived minimum keeps a
// same-type ceiling here too.

export type SentencingExposure = {
  mandatoryMinimums: Sentence[];
  maximumPenalties: Sentence[];
};

type SentenceGroup = [Sentence, ...Sentence[]];

function totalInUnit(entries: SentenceGroup, unit: Sentence['unit']): number {
  const total = entries.reduce((sum, s) => sum + s.amount * (UNIT_DAYS[s.unit] / UNIT_DAYS[unit]), 0);
  return Math.max(1, Math.round(total));
}

// Safe cast: callers only pass groups of one sentence type, whose units are
// already constrained by that type's SentenceSchema variant.
function finestTimeUnit<U extends Sentence['unit']>(entries: SentenceGroup): U {
  return entries.reduce<Sentence['unit']>(
    (finest, s) => (UNIT_DAYS[s.unit] < UNIT_DAYS[finest] ? s.unit : finest),
    entries[0].unit
  ) as U;
}

function sumMaxima(entries: SentenceGroup): Sentence {
  const first = entries[0];
  if (entries.length === 1) return first;
  switch (first.type) {
    case 'FINE':
      return { type: 'FINE', unit: 'DOLLARS', amount: totalInUnit(entries, 'DOLLARS') };
    case 'COMMUNITY_SERVICE':
      return { type: 'COMMUNITY_SERVICE', unit: 'HOURS', amount: totalInUnit(entries, 'HOURS') };
    case 'PROBATION': {
      const unit = finestTimeUnit<'YEARS' | 'MONTHS'>(entries);
      const conditions = [...new Set(entries.flatMap(s => (s.type === 'PROBATION' ? s.conditions : [])))];
      return { type: 'PROBATION', unit, amount: totalInUnit(entries, unit), conditions };
    }
    case 'PRISON':
    case 'JAIL': {
      const unit = finestTimeUnit<'YEARS' | 'MONTHS' | 'DAYS'>(entries);
      return { type: first.type, unit, amount: totalInUnit(entries, unit) };
    }
  }
}

function largestMinimum(entries: SentenceGroup): Sentence {
  return entries.reduce((largest, s) =>
    s.amount * UNIT_DAYS[s.unit] > largest.amount * UNIT_DAYS[largest.unit] ? s : largest
  );
}

function groupByType(sentences: Sentence[]): SentenceGroup[] {
  const groups = new Map<Sentence['type'], SentenceGroup>();
  for (const s of sentences) {
    const group = groups.get(s.type);
    if (group) group.push(s);
    else groups.set(s.type, [s]);
  }
  return [...groups.values()];
}

export function deriveSentencingExposure(charges: Charge[]): SentencingExposure {
  return {
    mandatoryMinimums: groupByType(charges.flatMap(c => c.mandatoryMinimums)).map(largestMinimum),
    maximumPenalties: groupByType(charges.flatMap(c => c.maximumPenalties)).map(sumMaxima),
  };
}
