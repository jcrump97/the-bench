import {
  sentenceDayEquivalent,
  type CasePayload,
  type ChargeVerdict,
  type PleaDecision,
  type Sentence,
} from '../schemas/gameSchemas';
import { deriveSentencingExposure, selectSentenceableCharges, type SentencingExposure } from './sentencingExposure';
import { assessProsecution, derivePleaOfferTerms } from './pleaAssessment';
import { buildSentences, floorAmountFor } from './sentenceBounds';

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
  // Where the term sits in the range, 0 (floor of what could be imposed) to 1
  // (everything the statute allowed).
  shareOfExposure: number;
  atFloor: boolean;
  atCeiling: boolean;
  // How the imposed term compares to the plea terms the defendant refused —
  // null when no offer was ever on the table, which is most trial paths.
  versusOffer: 'BELOW' | 'MATCHES' | 'ABOVE' | null;
}

// Bands by share of the available range. A third and two thirds: wide enough
// that the middle band is a real judgment rather than a rounding artifact.
const LENIENT_CEILING = 1 / 3;
const SEVERE_FLOOR = 2 / 3;

// Custody governs when it is present. A maxed-out fine alongside a year of a
// ten-year exposure is not a severe sentence — time is what a person serves,
// and the aftermath has to speak about what they lost.
function weigh(sentences: Sentence[]): number {
  const custody = sentences.filter((s) => s.type === 'PRISON' || s.type === 'JAIL');
  const measured = custody.length > 0 ? custody : sentences;
  return measured.reduce((total, s) => total + (sentenceDayEquivalent(s) ?? 0), 0);
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

  // A range with no room in it (floor equals ceiling, or an exposure that
  // weighs nothing) leaves the court no discretion to read.
  const room = ceiling - floor;
  const shareOfExposure = ceiling <= 0 ? 0 : round2(imposedWeight / ceiling);
  const shareOfRoom = room <= 0 ? 0 : (imposedWeight - floor) / room;

  const atFloor = imposedWeight <= floor;
  const atCeiling = imposedWeight >= ceiling && ceiling > 0;

  // The endpoints are read as themselves: everything the statute allowed is
  // severe however narrow the range, and the statutory minimum is leniency
  // even when the minimum is harsh.
  const band: SeverityBand = atCeiling
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
    atFloor,
    atCeiling,
    versusOffer: offered === null ? null : compareToOffer(imposedWeight, weigh(offered)),
  };
}

function compareToOffer(imposedWeight: number, offeredWeight: number): 'BELOW' | 'MATCHES' | 'ABOVE' {
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
  // trial sentence against.
  const band = assessProsecution(caseData).band;
  const offered = band === 'WEAK' ? null : derivePleaOfferTerms(caseData, band).proposedSentence;

  return deriveSentenceSeverity(imposedSentence, exposure, offered);
}
