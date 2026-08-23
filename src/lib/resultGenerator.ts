import type { z } from 'zod';
import {
  FinalResultSchema,
  defendantFullName,
  type CasePayload,
  type ChargeVerdict,
  type MotionRuling,
  type PleaDecision,
  type PleaNarrative,
  type PleaPosture,
  type Sentence,
} from '../schemas/gameSchemas';
import { assessProsecution, computePleaPostureForCase } from './pleaAssessment';

// ===========================================================================
// ResultGenerator
//
// The last deterministic step of a case: it reads the end-of-game state the
// player's own rulings produced and assembles the immutable FinalResult
// snapshot. Nothing here is generated, negotiated, or asked of the LLM — the
// only narrative it carries is the aftermath, which crossed its own
// validation boundary before it ever reached the store.
//
// Deliberately not the validator and deliberately not the writer: it returns
// an unvalidated candidate for the ValidationLayer (the game store's
// FinalResultSchema setter) to gate, and never touches localStorage itself.
// That split is what lets resultArchive.ts state, as a type-level fact, that
// it only ever persists a snapshot that already passed the schema.
//
// `completedAt` is injected rather than read from the clock here so the
// assembly is a pure function of its inputs and testable without faking time.
// ===========================================================================

export interface FinalResultInput {
  caseData: CasePayload;
  pleaNarrative: PleaNarrative;
  pleaDecision: PleaDecision | null;
  motionRulings: MotionRuling[];
  chargeVerdicts: ChargeVerdict[];
  imposedSentence: Sentence[];
  aftermathNarrative: string;
  // ISO-8601, supplied by the caller (new Date().toISOString() at the
  // END_STATE transition).
  completedAt: string;
}

// The shape before validation. FinalResult (the parsed type) is what the
// store hands on to everything downstream.
export type FinalResultCandidate = z.input<typeof FinalResultSchema>;

// Why the case went to trial, read off the computed posture rather than
// stored anywhere: the three reasons are exactly the three ways a case can
// reach Act 2. The offer-less postures write no pleaDecision at all (the
// phase transition is the ruling), so the posture — not the decision — is the
// only field that can tell them apart.
const PLEA_OUTCOME_BY_STATUS: Record<PleaPosture['status'], 'NO_OFFER_MADE' | 'REJECTED_BY_DEFENSE' | 'JUDGE_FORCED_TRIAL'> = {
  NO_OFFER:                 'NO_OFFER_MADE',
  REJECTED_BY_DEFENSE:      'REJECTED_BY_DEFENSE',
  PENDING_JUDICIAL_REVIEW:  'JUDGE_FORCED_TRIAL',
};

export function buildFinalResult(input: FinalResultInput): FinalResultCandidate {
  const { caseData, pleaNarrative, pleaDecision } = input;

  // Both assessments come from the same deterministic derivations the game
  // itself played under, so the snapshot records the case as it was tried —
  // never a re-scored version of it.
  const prosecutionStrength = assessProsecution(caseData);
  const { posture, defenseRisk } = computePleaPostureForCase(caseData, pleaNarrative);

  const base = {
    schemaVersion: 1 as const,
    caseId:        caseData.caseId,
    defendantName: defendantFullName(caseData.defendant),
    completedAt:   input.completedAt,
    prosecutionStrength,
    defenseRisk,
    imposedSentence:    input.imposedSentence,
    aftermathNarrative: input.aftermathNarrative,
  };

  if (pleaDecision === 'ACCEPT') {
    return { resolutionPath: 'PLEA', pleaDecision: 'ACCEPT', ...base };
  }

  // Precondition: the state machine requires a verdict on every count before
  // sentencing on the trial path, so an empty verdict here is an off-path
  // call (programming error), not a real outcome.
  if (input.chargeVerdicts.length === 0) {
    throw new Error('buildFinalResult requires a non-empty verdict on the trial path');
  }

  return {
    resolutionPath: 'TRIAL',
    pleaOutcome:    PLEA_OUTCOME_BY_STATUS[posture.status],
    motionRulings:  input.motionRulings,
    verdict:        input.chargeVerdicts,
    ...base,
  };
}
