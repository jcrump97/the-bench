import { z } from 'zod';
import { SentenceSchema } from '../schemas/gameSchemas';

type Sentence = z.infer<typeof SentenceSchema>;

// Turns a SCREAMING_SNAKE_CASE schema enum value into a readable label:
// FELONY -> "Felony", NOT_GUILTY -> "Not Guilty", 'N/A' passes through as-is.
export function enumLabel(value: string): string {
  if (value === 'N/A') return 'N/A';
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const UNIT_SINGULAR: Record<'YEARS' | 'MONTHS' | 'DAYS' | 'HOURS', string> = {
  YEARS: 'year',
  MONTHS: 'month',
  DAYS: 'day',
  HOURS: 'hour',
};

function pluralizeUnit(unit: 'YEARS' | 'MONTHS' | 'DAYS' | 'HOURS', amount: number): string {
  const singular = UNIT_SINGULAR[unit];
  return amount === 1 ? singular : `${singular}s`;
}

export function formatSentence(sentence: Sentence): string {
  switch (sentence.type) {
    case 'PRISON':
      return `${sentence.amount} ${pluralizeUnit(sentence.unit, sentence.amount)} in prison`;
    case 'JAIL':
      return `${sentence.amount} ${pluralizeUnit(sentence.unit, sentence.amount)} in jail`;
    case 'FINE':
      return `$${sentence.amount.toLocaleString('en-US')} fine`;
    case 'COMMUNITY_SERVICE':
      return `${sentence.amount} ${pluralizeUnit(sentence.unit, sentence.amount)} of community service`;
    case 'PROBATION': {
      const duration = `${sentence.amount} ${pluralizeUnit(sentence.unit, sentence.amount)} probation`;
      const conditions = sentence.conditions.map(enumLabel).join(', ');
      return `${duration} (${conditions})`;
    }
  }
}

export function formatSentenceList(sentences: Sentence[]): string {
  if (sentences.length === 0) return 'No sentence recorded';
  return sentences.map(formatSentence).join('; ');
}

// The filing date on a persisted judgment. Rendered in the reader's own
// locale — the snapshot stores UTC, the courthouse clock is wherever the
// player is. A snapshot whose timestamp somehow survived schema validation
// unparseable still must not render "Invalid Date" on the record.
export function formatJudgmentDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'date unavailable';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// A span of custody in the units people actually say. Used for the running
// total across a docket, where a raw day count means nothing to anybody.
export function formatCustodyTotal(days: number): string {
  if (days <= 0) return 'none';
  const years = Math.floor(days / 365);
  const months = Math.floor((days - years * 365) / (365 / 12));
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${pluralizeUnit('YEARS', years)}`);
  if (months > 0) parts.push(`${months} ${pluralizeUnit('MONTHS', months)}`);
  // Under a month: report the days rather than rounding a real term to zero.
  if (parts.length === 0) {
    const wholeDays = Math.max(1, Math.round(days));
    return `${wholeDays} ${pluralizeUnit('DAYS', wholeDays)}`;
  }
  return parts.join(', ');
}
