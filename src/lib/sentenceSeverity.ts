import {
  sentenceDayEquivalent,
  type CasePayload,
  type ChargeVerdict,
  type PleaDecision,
  type Sentence,
} from '../schemas/gameSchemas';
import { deriveSentencingExposure, selectSentenceableCharges, type SentencingExposure } from './sentencingExposure';
import { assessProsecution, derivePleaOfferTerms } from './pleaAssessment';
import { buildSentences, floorAmountFor, UNIT_DAYS } from './sentenceBounds';

// ===========================================================================
// How hard the sentence landed.
//
// The judge's most discretionary act is choosing the number, and until this
// existed nothing downstream could tell three years of mercy from three years
// of the hammer — the aftermath was handed an amount with no range beside it.
// This is the deterministic half of that: a pure reading of where the imposed
// term sits inside the exposure the court was working within, and how it
// compares to the deal the defendant turned down.
//
// Three bands, not five. The tiers exist to be *written to* — by the demo
// docket's authored codas and by the aftermath prompt — and leniency,
// measure, and severity are the distinctions prose can actually carry.
// ===========================================================================

export type SeverityBand = 'LENIENT' | 'MEASURED' | 'SEVERE';

export interface SentenceSeverity {
  band: SeverityBand;
  // Where the term sits against the statutory maximum, 0 to 1.
  shareOfExposure: number;
  // Where the term sits inside the room the court actually had to choose
  // within — floor of the picker to statutory ceiling, 0 to 1. This is the
  // number the band is read from, and it is on the record separately because
  // quoting shareOfExposure beside the band let the prompt say "lenient,
  // roughly 55% of the statutory maximum".
  shareOfRoom: number;
  atFloor: boolean;
  atCeiling: boolean;
  // How the imposed term compares to plea terms the case did not resolve on —
  // null when no offer was ever made, and null on the plea path, where the
  // imposed term is the offer.
  versusOffer: 'BELOW' | 'MATCHES' | 'ABOVE' | null;
}

// Bands by share of the available range. A third and two thirds: wide enough
// that the middle band is a real judgment rather than a rounding artifact.
const LENIENT_CEILING = 1 / 3;
const SEVERE_FLOOR = 2 / 3;

// How large a single term is, for the purpose of placing it inside its own
// range. Custody and fines carry a day or dollar equivalent already;
// probation and community service carry none, and treating that absence as
// zero made an exposure built out of nothing else weigh zero at the floor,
// at the ceiling and at the imposed term alike — so every such sentence read
// as the lightest one available, the statutory maximum included. The scale
// only ever compares a range against itself, so the unit's own weight is
// enough to order the terms within it.
function magnitude(s: Sentence): number {
  return sentenceDayEquivalent(s) ?? s.amount * UNIT_DAYS[s.unit];
}

function custodyOf(sentences: Sentence[]): Sentence[] {
  return sentences.filter((s) => s.type === 'PRISON' || s.type === 'JAIL');
}

function total(sentences: Sentence[]): number {
  return sentences.reduce((sum, s) => sum + magnitude(s), 0);
}

// Custody governs when it is present. A maxed-out fine alongside a year of a
// ten-year exposure is not a severe sentence — time is what a person serves,
// and the aftermath has to speak about what they lost.
function weigh(sentences: Sentence[]): number {
  const custody = custodyOf(sentences);
  return total(custody.length > 0 ? custody : sentences);
}

export function deriveSentenceSeverity(
  imposed: Sentence[],
  exposure: SentencingExposure,
  offered: Sentence[] | null,
): SentenceSeverity | null {
  // A full acquittal imposes nothing. There is no severity to read, and the
  // aftermath speaks to the verdict instead.
  if (imposed.length === 0) return null;

  const imposedWeight = weigh(imposed);
  const ceiling = weigh(exposure.maximumPenalties);
  // The floor is what the picker would actually let the court choose, not
  // zero: with no mandatory minimum that is one unit of each penalty, and the
  // lightest term available has to read as leniency. Measuring against zero
  // made the lowest selectable term on a three-year exposure land a third of
  // the way up the range and read as "measured" — the mercy the player
  // actually extended, described back to them as the middle of the road.
  const floor = weigh(buildSentences(
    exposure.maximumPenalties,
    exposure.maximumPenalties.map((max) => floorAmountFor(max, exposure.mandatoryMinimums)),
  ));

  // A range with no room in it — a mandatory minimum equal to the statutory
  // maximum — leaves the court exactly one lawful term.
  const room = ceiling - floor;
  const noDiscretion = room <= 0;
  const shareOfExposure = ceiling <= 0 ? 0 : round2(imposedWeight / ceiling);
  const shareOfRoom = room <= 0 ? 0 : (imposedWeight - floor) / room;

  const atFloor = imposedWeight <= floor;
  const atCeiling = imposedWeight >= ceiling && ceiling > 0;

  // The endpoints are read as themselves: everything the statute allowed is
  // severe however narrow the range, and the statutory minimum is leniency
  // even when the minimum is harsh. But a range with no room in it has no
  // endpoints to read — the term is simultaneously the floor and the ceiling,
  // and taking the ceiling branch credited the judge with a severity they
  // were given no way to avoid.
  const band: SeverityBand = noDiscretion
    ? 'MEASURED'
    : atCeiling
    ? 'SEVERE'
    : atFloor
      ? 'LENIENT'
      : shareOfRoom < LENIENT_CEILING
        ? 'LENIENT'
        : shareOfRoom < SEVERE_FLOOR
          ? 'MEASURED'
          : 'SEVERE';

  return {
    band,
    shareOfExposure,
    shareOfRoom: round2(shareOfRoom),
    atFloor,
    atCeiling,
    versusOffer: offered === null ? null : compareToOffer(imposed, offered),
  };
}

// Both sides of this comparison have to sit on the same scale. weigh() falls
// back to the non-custodial terms when a sentence carries no custody, so
// weighing each side on its own terms could put dollars against days: on a
// partial acquittal where the only count that stuck carries a fine, a $5,000
// fine outweighed the multi-year prison offer the defendant had refused and
// the record called the fine the harsher outcome. Custody governs whenever
// *either* side carries any, and the side without it weighs no days — which
// is exactly what it is.
function compareToOffer(imposed: Sentence[], offered: Sentence[]): 'BELOW' | 'MATCHES' | 'ABOVE' {
  const custodyInPlay = custodyOf(imposed).length > 0 || custodyOf(offered).length > 0;
  const measure = custodyInPlay ? (s: Sentence[]) => total(custodyOf(s)) : total;
  const imposedWeight = measure(imposed);
  const offeredWeight = measure(offered);
  if (imposedWeight < offeredWeight) return 'BELOW';
  if (imposedWeight > offeredWeight) return 'ABOVE';
  return 'MATCHES';
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// The same reading, resolved from end-of-game state alone — the exposure the
// court was actually working within (counts of conviction only, never the
// whole charge list) and the plea terms the People would have offered.
// Both the demo docket's aftermath selection and the BYOK aftermath prompt go
// through here, so the offline and generated paths read a sentence the same
// way.
export function severityOfImposedSentence(
  caseData: CasePayload,
  pleaDecision: PleaDecision | null,
  verdict: ChargeVerdict[] | null,
  imposedSentence: Sentence[],
): SentenceSeverity | null {
  const isPleaPath = pleaDecision === 'ACCEPT';
  const exposure = deriveSentencingExposure(
    selectSentenceableCharges(caseData.charges, isPleaPath, verdict ?? []),
  );

  // A WEAK case never produced offer terms, so there is nothing to compare a
  // trial sentence against — and neither does an accepted plea, where the
  // imposed term *is* the bargain. Comparing the sentence to the deal it came
  // from told the aftermath the defendant had turned down the offer they took.
  const band = assessProsecution(caseData).band;
  const offered = isPleaPath || band === 'WEAK'
    ? null
    : derivePleaOfferTerms(caseData, band).proposedSentence;

  return deriveSentenceSeverity(imposedSentence, exposure, offered);
}
