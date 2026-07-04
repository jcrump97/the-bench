import { sentenceDayEquivalent, type Sentence } from '../schemas/gameSchemas';

// Bounds for the Act 3 sentence picker: each maximumPenalties entry fixes the
// type/unit (and probation conditions); the player only chooses the amount,
// clamped between the mandatory-minimum floor and the statutory ceiling.
export const UNIT_DAYS: Record<Sentence['unit'], number> = {
  YEARS: 365,
  MONTHS: 365 / 12,
  DAYS: 1,
  DOLLARS: 1,
  HOURS: 1,
};

export function floorAmountFor(max: Sentence, minimums: Sentence[]): number {
  const min = minimums.find((m) => m.type === max.type);
  if (!min) return 1;
  const minDays = sentenceDayEquivalent(min);
  if (minDays === null) return min.unit === max.unit ? min.amount : 1;
  return Math.min(max.amount, Math.ceil(minDays / UNIT_DAYS[max.unit]));
}

export function buildSentences(maximums: Sentence[], amounts: number[]): Sentence[] {
  return maximums.map((max, index) => ({ ...max, amount: amounts[index] ?? max.amount }));
}
