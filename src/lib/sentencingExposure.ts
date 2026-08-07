import { sentenceDayEquivalent, type Charge, type ChargeVerdict, type Sentence } from '../schemas/gameSchemas';
import { UNIT_DAYS } from './sentenceBounds';

// The counts a sentence may actually reach. Exposure must be derived from
// these and never from the raw charge list: a sentence cannot touch a count
// the defendant was acquitted of, and feeding an acquitted count's statutory
// range into the aggregation below silently reshapes the sentence for the
// counts that *were* proven.
//
// On the plea path the defendant pleads to every count (derivePleaOfferTerms
// partitions nothing away), so the whole list governs. On the trial path only
// GUILTY counts do. On a full acquittal this is empty, and the caller renders
// an adjournment rather than a sentencing form.
//
// The failure this exists to prevent was visible on the shipped Vaughn docket:
// acquit the felony (PRISON 3 years) and convict the misdemeanor (JAIL 6
// months), and the picker offered prison up to three years with no jail option
// at all, because the PRISON/JAIL collapse below ran over the acquitted count.
export function selectSentenceableCharges(
  charges: Charge[],
  isPleaPath: boolean,
  chargeVerdicts: readonly ChargeVerdict[],
): Charge[] {
  if (isPleaPath) return charges;
  return charges.filter((charge) =>
    chargeVerdicts.some((v) => v.chargeId === charge.id && v.verdict === 'GUILTY'),
  );
}

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
  const mandatoryMinimums = groupByType(charges.flatMap(c => c.mandatoryMinimums)).map(largestMinimum);
  const maximumPenalties = groupByType(charges.flatMap(c => c.maximumPenalties)).map(sumMaxima);

  // A case commonly and correctly combines a state-prison-eligible charge
  // (a felony) with a county-jail-only charge (a misdemeanor, or a realigned
  // felony under Cal. Penal Code § 1170(h)) — that is not the problem. What
  // doesn't happen is a defendant serving two separate, additive custody
  // terms in two different facilities: when counts of different
  // classification are sentenced together, the whole commitment aggregates
  // into one (Cal. Penal Code § 669) — if any count requires state prison,
  // that governs, and jail time on the other counts runs concurrent and is
  // absorbed into it. So the case-level exposure collapses to PRISON alone
  // whenever both types are present, rather than narrating "N years in
  // prison, and also M months in jail" as if both were separately imposed.
  const hasPrison = mandatoryMinimums.some(s => s.type === 'PRISON') || maximumPenalties.some(s => s.type === 'PRISON');
  const hasJail = mandatoryMinimums.some(s => s.type === 'JAIL') || maximumPenalties.some(s => s.type === 'JAIL');
  // §669 aggregation is about *different counts* carrying different custody
  // types. A single count that itself lists both a PRISON and a JAIL maximum is
  // not aggregation at all — it is alternative sentencing on one count (a
  // wobbler under §17(b), or a realigned felony under §1170(h)), where both
  // are genuinely available to the court and collapsing deletes a lawful
  // option. So the collapse requires some count to contribute JAIL *without*
  // offering PRISON itself; a lone wobbler keeps both.
  //
  // Residual case left deliberately uncollapsed: a wobbler charged alongside a
  // prison-only count, where every jail-offering count also offers prison. That
  // needs per-count election modelling (which count's custody type the court
  // selects) rather than a case-level heuristic, and the schema has no field
  // for an election.
  const someCountIsJailOnly = charges.some(
    (c) =>
      c.maximumPenalties.some(s => s.type === 'JAIL') &&
      !c.maximumPenalties.some(s => s.type === 'PRISON'),
  );
  if (hasPrison && hasJail && someCountIsJailOnly) {
    // The JAIL maximum is absorbed into the governing PRISON figure, not
    // summed in as a separate one — but a JAIL mandatory minimum isn't
    // simply dropped along with it: the statutory floor it represents still
    // binds the aggregate sentence, just measured in the governing custody
    // type. Convert it to PRISON and keep whichever of the (at most one)
    // PRISON minimum and the converted JAIL minimum is stricter, so a real
    // floor never silently disappears just because the charge that carried
    // it wasn't the one that decided the case's custody type.
    const prisonMinimum = mandatoryMinimums.find(s => s.type === 'PRISON') ?? null;
    const jailMinimum = mandatoryMinimums.find(s => s.type === 'JAIL') ?? null;
    const convertedJailMinimum: Sentence | null = jailMinimum ? { ...jailMinimum, type: 'PRISON' } : null;
    const strictestMinimum = [prisonMinimum, convertedJailMinimum].reduce<Sentence | null>((strictest, candidate) => {
      if (candidate === null) return strictest;
      if (strictest === null) return candidate;
      return sentenceDayEquivalent(candidate)! > sentenceDayEquivalent(strictest)! ? candidate : strictest;
    }, null);

    const survivingMaxima = maximumPenalties.filter(s => s.type !== 'JAIL');

    // A converted JAIL floor can legitimately exceed the PRISON ceiling that
    // survives the collapse — a felony carrying a PRISON maximum of 6 MONTHS
    // charged with a misdemeanor carrying a JAIL minimum of 1 YEAR produces
    // exactly that. Emitting min > max would break the invariant stated at the
    // top of this file and relied on by every consumer: discountSentences would
    // quote a plea offer above the case's own maximum while floorAmountFor
    // clamps the sentencing picker below it, so the offer and the form would
    // disagree about what is even available. The ceiling wins — a floor cannot
    // exceed the longest term the case actually authorizes.
    const prisonCeiling = survivingMaxima.find(s => s.type === 'PRISON') ?? null;
    const clampedMinimum =
      strictestMinimum !== null &&
      prisonCeiling !== null &&
      sentenceDayEquivalent(strictestMinimum)! > sentenceDayEquivalent(prisonCeiling)!
        ? prisonCeiling
        : strictestMinimum;

    return {
      mandatoryMinimums: [
        ...mandatoryMinimums.filter(s => s.type !== 'PRISON' && s.type !== 'JAIL'),
        ...(clampedMinimum ? [clampedMinimum] : []),
      ],
      maximumPenalties: survivingMaxima,
    };
  }

  return { mandatoryMinimums, maximumPenalties };
}
