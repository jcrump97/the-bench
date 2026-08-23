import {
  defendantFullName,
  sentenceDayEquivalent,
  type CasePayload,
  type FinalResult,
  type Sentence,
} from '../schemas/gameSchemas';
import { enumLabel } from './format';

// ===========================================================================
// What the order does to the people in it.
//
// The minute order records the disposition; this reads it back as
// consequence. Every line is derived from validated state the player already
// saw — the term they chose, the household in the dossier, the classification
// of the counts, the conditions they attached — and a line is omitted rather
// than padded when the case has nothing to say for it. Nothing here is
// generated: the aftermath is where the narrative voice lives, and this is
// the court's own arithmetic about who absorbs the sentence.
// ===========================================================================

export interface Consequence {
  label: string;
  text: string;
}

const CHILD_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

// Spelled out and sentence-cased: the line leads with it.
function childCount(children: number): string {
  const word = CHILD_WORDS[children] ?? String(children);
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function custodyDays(sentences: Sentence[]): number {
  return sentences
    .filter((s) => s.type === 'PRISON' || s.type === 'JAIL')
    .reduce((total, s) => total + (sentenceDayEquivalent(s) ?? 0), 0);
}

export function describeConsequences(caseData: CasePayload, result: FinalResult): Consequence[] {
  const { defendant } = caseData;
  const name = defendantFullName(defendant);
  const lines: Consequence[] = [];

  const days = custodyDays(result.imposedSentence);
  const years = days / 365;
  const filed = new Date(result.completedAt);
  const convicted = result.resolutionPath === 'PLEA'
    || result.verdict.some((v) => v.verdict === 'GUILTY');

  // Custody, counted forward from the day it was imposed. "At the earliest"
  // is doing real work: credits and half-time are not modelled, and the court
  // does not know the release date on the day it sentences.
  if (days > 0 && !Number.isNaN(filed.getTime())) {
    const releaseYear = filed.getFullYear() + Math.floor(years);
    const ageAtRelease = defendant.age + Math.floor(years);
    lines.push({
      label: 'Custody',
      text: `${name} is remanded today. Out in ${releaseYear} at the earliest, aged ${ageAtRelease}.`,
    });
  }

  // Only a custodial term separates a household. A fine does not take a
  // parent out of the house, and saying so would be sentiment, not
  // consequence.
  if (days > 0 && defendant.demographics.children > 0) {
    const count = defendant.demographics.children;
    lines.push({
      label: 'Household',
      text: `${childCount(count)} ${count === 1 ? 'child' : 'children'} will spend that time in somebody else's care.`,
    });
  }

  if (days > 0 && defendant.demographics.employmentStatus === 'EMPLOYED') {
    lines.push({
      label: 'Livelihood',
      text: 'The job held at sentencing does not survive a custodial term.',
    });
  }

  // The counts that actually resulted in conviction — never the whole charge
  // list, which on the trial path includes the ones the defendant beat.
  const convictedClassifications = result.resolutionPath === 'PLEA'
    ? caseData.charges.map((c) => c.classification)
    : result.verdict.filter((v) => v.verdict === 'GUILTY').map((v) => v.classification);

  if (convictedClassifications.includes('FELONY')) {
    lines.push({
      label: 'Record',
      text: 'A felony conviction is entered: the firearm prohibition attaches, and the disclosure follows every application from here on.',
    });
  } else if (convicted) {
    lines.push({
      label: 'Record',
      text: 'A misdemeanor conviction is entered, and stays on the record absent a later petition.',
    });
  } else {
    lines.push({
      label: 'Record',
      text: 'No conviction is entered. The arrest itself remains on the record — this judgment does not seal it.',
    });
  }

  const fine = result.imposedSentence.find((s) => s.type === 'FINE');
  if (fine !== undefined) {
    lines.push({
      label: 'Money',
      text: `$${fine.amount.toLocaleString('en-US')} is owed to the court whether or not there is work to pay it with.`,
    });
  }

  const probation = result.imposedSentence.find((s) => s.type === 'PROBATION');
  if (probation !== undefined && probation.type === 'PROBATION') {
    lines.push({
      label: 'Supervision',
      text: `Supervised for ${probation.amount} ${probation.unit.toLowerCase()}: ${probation.conditions.map(enumLabel).join(', ')}. A violation is decided by a judge, not a trial.`,
    });
  }

  return lines;
}
