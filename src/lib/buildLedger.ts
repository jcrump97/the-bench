import { z } from 'zod';
import {
  SentenceSchema,
  type CasePayload,
  type PleaNarrative,
  type PleaPosture,
  type PleaDecision,
  type MotionRuling,
  type Verdict,
  type GamePhase,
} from '../schemas/gameSchemas';
import { formatSentence, enumLabel } from './format';

type Sentence = z.infer<typeof SentenceSchema>;

export type LedgerEntryKind =
  | 'CASE_OPENED'
  | 'PLEA_OFFER'
  | 'PLEA_DEFENSE_RESPONSE'
  | 'PLEA_DECISION'
  | 'MOTION_RULING'
  | 'VERDICT'
  | 'SENTENCE_IMPOSED'
  | 'AFTERMATH';

export interface LedgerEntry {
  id: string;
  kind: LedgerEntryKind;
  phase: GamePhase;
  // Monotonic sequence index, NOT a wall-clock timestamp — buildLedger is a
  // pure, deterministic projection and must never call Date.now().
  order: number;
  heading: string;
  body: string;
}

export interface BuildLedgerInput {
  caseData: CasePayload;
  pleaNarrative: PleaNarrative | null;
  pleaPosture: PleaPosture | null;
  pleaDecision: PleaDecision | null;
  motionRulings: MotionRuling[];
  verdict: Verdict | null;
  imposedSentence: Sentence[];
  aftermathNarrative: string | null;
}

function findChargeName(caseData: CasePayload, chargeId: string): string {
  return caseData.charges.find((c) => c.id === chargeId)?.name ?? 'Unknown charge';
}

function describeOffer(caseData: CasePayload, posture: Extract<PleaPosture, { status: 'REJECTED_BY_DEFENSE' | 'PENDING_JUDICIAL_REVIEW' }>): string {
  const pleadsTo = posture.pleadsToChargeIds.map((id) => findChargeName(caseData, id)).join(', ');
  const dismissed = posture.dismissedChargeIds.length > 0
    ? ` Dismissed: ${posture.dismissedChargeIds.map((id) => findChargeName(caseData, id)).join(', ')}.`
    : '';
  const sentence = posture.proposedSentence.map(formatSentence).join('; ');
  return `Pleads to: ${pleadsTo}. Proposed sentence: ${sentence}.${dismissed} ${posture.prosecutionRationale}`;
}

// This is a display projection, not a validator: unlike sentencingModifierFromRulings
// (which throws on an unknown evidenceId because it gates a sentencing calculation),
// an unresolvable id here just falls back to a label — nothing downstream depends
// on this function rejecting bad input.
export function buildLedger(input: BuildLedgerInput): LedgerEntry[] {
  const {
    caseData,
    pleaPosture,
    pleaDecision,
    motionRulings,
    verdict,
    imposedSentence,
    aftermathNarrative,
  } = input;

  const entries: LedgerEntry[] = [];
  let order = 0;
  const push = (entry: Omit<LedgerEntry, 'order'>) => {
    entries.push({ ...entry, order: order++ });
  };

  push({
    id: 'case-opened',
    kind: 'CASE_OPENED',
    phase: 'ACT_1_INTAKE',
    heading: 'Case Opened',
    body: caseData.summary,
  });

  if (pleaPosture !== null) {
    if (pleaPosture.status === 'NO_OFFER') {
      push({
        id: 'plea-offer',
        kind: 'PLEA_OFFER',
        phase: 'ACT_1_INTAKE',
        heading: 'No Plea Offer',
        body: pleaPosture.prosecutionRationale,
      });
    } else {
      push({
        id: 'plea-offer',
        kind: 'PLEA_OFFER',
        phase: 'ACT_1_INTAKE',
        heading: 'Plea Offer',
        body: describeOffer(caseData, pleaPosture),
      });

      push({
        id: 'plea-defense-response',
        kind: 'PLEA_DEFENSE_RESPONSE',
        phase: 'ACT_1_INTAKE',
        heading: pleaPosture.status === 'PENDING_JUDICIAL_REVIEW' ? 'Defense Agrees to Offer' : 'Defense Rejects Offer',
        body: pleaPosture.defenseRationale,
      });
    }
  }

  if (pleaDecision !== null) {
    push({
      id: 'plea-decision',
      kind: 'PLEA_DECISION',
      phase: 'ACT_1_INTAKE',
      heading: pleaDecision === 'ACCEPT' ? 'Judge Accepts the Plea' : 'Judge Rejects the Plea — Trial Ordered',
      body: pleaDecision === 'ACCEPT'
        ? 'The court accepts the negotiated plea and proceeds directly to sentencing.'
        : 'The court rejects the negotiated plea and orders the case to trial.',
    });
  }

  for (const ruling of motionRulings) {
    const evidenceName = caseData.evidence.find((e) => e.id === ruling.evidenceId)?.name ?? 'Unknown evidence';
    push({
      id: `motion-${ruling.evidenceId}`,
      kind: 'MOTION_RULING',
      phase: 'ACT_2_MOTIONS',
      heading: 'Evidentiary Ruling',
      body: `${evidenceName}: ${enumLabel(ruling.ruling)}`,
    });
  }

  if (verdict !== null) {
    for (const chargeVerdict of verdict) {
      push({
        id: `verdict-${chargeVerdict.chargeId}`,
        kind: 'VERDICT',
        phase: 'ACT_3_VERDICT',
        heading: 'Verdict',
        body: `${chargeVerdict.chargeName} (${enumLabel(chargeVerdict.classification)}): ${enumLabel(chargeVerdict.verdict)}`,
      });
    }
  }

  if (imposedSentence.length > 0) {
    imposedSentence.forEach((sentence, index) => {
      push({
        id: `sentence-${index}`,
        kind: 'SENTENCE_IMPOSED',
        phase: 'ACT_3_VERDICT',
        heading: 'Sentence Imposed',
        body: formatSentence(sentence),
      });
    });
  }

  if (aftermathNarrative !== null) {
    push({
      id: 'aftermath',
      kind: 'AFTERMATH',
      phase: 'END_STATE',
      heading: 'Aftermath',
      body: aftermathNarrative,
    });
  }

  return entries;
}
