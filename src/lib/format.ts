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
