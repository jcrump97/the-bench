import {
  ProsecutionStrengthSchema,
  DefenseRiskSchema,
  PleaPostureSchema,
  type CasePayload,
  type ProsecutionStrength,
  type DefenseRisk,
  type PleaPosture,
  type MotionRuling,
  type SentenceSchema,
} from '../schemas/gameSchemas';
import { z } from 'zod';

type Sentence = z.infer<typeof SentenceSchema>;

// ─── Prosecution: "Can I prove this?" ─────────────────────────────────────────

const OBJECTION_RISK_DISCOUNT: Record<string, number> = { LOW: 1.0, MEDIUM: 0.7, HIGH: 0.4 };
const BIAS_WEIGHT: Record<string, number> = { PROSECUTION: 1.0, NEUTRAL: 0.5, DEFENSE: 0.2 };

export function assessProsecution(caseData: CasePayload): ProsecutionStrength {
  const { charges, evidence, witnesses } = caseData;

  // Element coverage: fraction of statute elements that have at least one piece of supporting evidence
  const allElementIds = new Set(charges.flatMap(c => c.elements.map(e => e.id)));
  const coveredElementIds = new Set(
    evidence
      .filter(e => e.targetElementId !== null)
      .map(e => e.targetElementId as string)
  );
  const elementCoverage = allElementIds.size > 0
    ? coveredElementIds.size / allElementIds.size
    : 0;

  // Evidence strength: relevanceScore discounted by objectionRisk, normalized to 0-100
  const evidenceStrength = evidence.length > 0
    ? evidence.reduce((sum, e) => {
        const discount = OBJECTION_RISK_DISCOUNT[e.objectionRisk] ?? 1.0;
        return sum + e.relevanceScore * discount;
      }, 0) / evidence.length * 10
    : 0;

  // Witness strength: credibilityScore weighted by prosecution-bias, normalized to 0-100
  const witnessStrength = witnesses.length > 0
    ? witnesses.reduce((sum, w) => {
        const weight = BIAS_WEIGHT[w.bias] ?? 0.5;
        return sum + w.credibilityScore * weight;
      }, 0) / witnesses.length * 10
    : 0;

  const score = Math.round(
    evidenceStrength * 0.45 +
    witnessStrength * 0.30 +
    elementCoverage * 100 * 0.25
  );

  const band: ProsecutionStrength['band'] =
    score >= 65 ? 'STRONG' : score >= 40 ? 'MODERATE' : 'WEAK';

  const result = ProsecutionStrengthSchema.safeParse({
    score,
    band,
    evidenceStrength: Math.round(evidenceStrength),
    witnessStrength: Math.round(witnessStrength),
    elementCoverage: Math.round(elementCoverage * 1000) / 1000,
  });

  if (!result.success) {
    throw new Error('ProsecutionStrength assembly failed internal validation');
  }
  return result.data;
}

// ─── Defense: "Should the defendant gamble at trial?" ─────────────────────────
// Inputs are the defendant's situation, not the case's provability.

function deriveRiskTolerance(caseData: CasePayload): number {
  const { openness, conscientiousness, neuroticism } = caseData.defendant.oceanTraits;
  // High neuroticism → risk-averse → lower tolerance (lean ACCEPT)
  // High openness + low conscientiousness → gambler → higher tolerance (lean REJECT)
  const raw = (openness * 1.5 + (10 - neuroticism) * 2.0 + (10 - conscientiousness) * 0.5) / 4.0;
  return Math.round(Math.min(Math.max(raw * 10, 0), 100));
}

function derivePriorExposure(caseData: CasePayload): number {
  const convictionCount = caseData.defendant.pastConvictions.length;
  const hasFelony = caseData.defendant.pastConvictions.some(pc =>
    pc.sentences.some(s => s.type === 'PRISON')
  );
  const raw = Math.min(convictionCount * 15 + (hasFelony ? 25 : 0), 100);
  return raw;
}

function deriveOfferGenerosity(proposedSentence: Sentence[], maximumPenalties: Sentence[]): number {
  // Simple heuristic: ratio of proposed prison/jail time to maximum prison/jail time
  const proposedYears = toYears(proposedSentence);
  const maxYears = toYears(maximumPenalties);
  if (maxYears === 0) return 50;
  const discount = Math.max(0, 1 - proposedYears / maxYears);
  return Math.round(discount * 100);
}

function toYears(sentences: Sentence[]): number {
  return sentences.reduce((sum, s) => {
    if (s.type !== 'PRISON' && s.type !== 'JAIL') return sum;
    if (s.unit === 'YEARS') return sum + s.amount;
    if (s.unit === 'MONTHS') return sum + s.amount / 12;
    return sum + s.amount / 365;
  }, 0);
}

export function assessDefense(
  caseData: CasePayload,
  proposedSentence: Sentence[]
): DefenseRisk {
  const riskTolerance = deriveRiskTolerance(caseData);
  const priorExposure = derivePriorExposure(caseData);
  const offerGenerosity = deriveOfferGenerosity(proposedSentence, caseData.maximumPenalties);

  // Higher generosity and higher prior exposure push toward ACCEPT
  // Higher risk tolerance pushes toward REJECT
  const acceptanceLikelihood = Math.round(
    offerGenerosity * 0.50 +
    priorExposure * 0.30 +
    (100 - riskTolerance) * 0.20
  );

  const posture: DefenseRisk['posture'] = acceptanceLikelihood >= 50 ? 'ACCEPT' : 'REJECT';

  const result = DefenseRiskSchema.safeParse({
    acceptanceLikelihood,
    posture,
    riskTolerance,
    priorExposure,
    offerGenerosity,
  });

  if (!result.success) {
    throw new Error('DefenseRisk assembly failed internal validation');
  }
  return result.data;
}

// ─── Posture builder: combines both assessments into the 3-state schema ───────

const SENTENCE_DISCOUNT: Partial<Record<ProsecutionStrength['band'], number>> = {
  MODERATE: 0.20,
  STRONG:   0.05,
};

export function buildPleaPosture(
  caseData: CasePayload,
  prosecutionStrength: ProsecutionStrength,
  prosecutionRationale: string,
  defenseRationale: string
): PleaPosture {
  const discount = SENTENCE_DISCOUNT[prosecutionStrength.band];
  // Prosecution declines to offer when no discount entry exists for this band
  if (discount === undefined) {
    const noOfferResult = PleaPostureSchema.safeParse({ status: 'NO_OFFER', prosecutionRationale });
    if (!noOfferResult.success) {
      throw new Error('PleaPosture NO_OFFER assembly failed internal validation');
    }
    return noOfferResult.data;
  }

  // Construct offer terms: defendant pleads to all charges; discount applied to max sentence
  const pleadsToChargeIds = caseData.charges.map(c => c.id);
  const proposedSentence = discountSentences(caseData.maximumPenalties, discount);

  const defenseRisk = assessDefense(caseData, proposedSentence);

  const status = defenseRisk.posture === 'ACCEPT'
    ? 'PENDING_JUDICIAL_REVIEW'
    : 'REJECTED_BY_DEFENSE';

  const offerResult = PleaPostureSchema.safeParse({
    status,
    pleadsToChargeIds,
    dismissedChargeIds: [],
    proposedSentence,
    prosecutionRationale,
    defenseRationale,
  });
  if (!offerResult.success) {
    throw new Error('PleaPosture offer assembly failed internal validation');
  }
  return offerResult.data;
}

function discountSentences(sentences: Sentence[], discount: number): Sentence[] {
  return sentences.map(s => {
    if (s.type === 'PRISON' || s.type === 'JAIL') {
      return { ...s, amount: Math.max(1, Math.round(s.amount * (1 - discount))) };
    }
    if (s.type === 'FINE') {
      return { ...s, amount: Math.max(1, Math.round(s.amount * (1 - discount))) };
    }
    return s;
  });
}

// ─── Act 3: sentencing range modifier from realized Act 2 rulings ─────────────

export function sentencingModifierFromRulings(
  caseData: CasePayload,
  motionRulings: MotionRuling[]
): number {
  const admittedIds = new Set(
    motionRulings.filter(r => r.ruling === 'ADMITTED').map(r => r.evidenceId)
  );
  const admittedEvidence = caseData.evidence.filter(e => admittedIds.has(e.id));

  if (admittedEvidence.length === 0) return 0;

  // Positive modifier: sum of relevance scores of admitted evidence, normalized to 0-1
  const raw = admittedEvidence.reduce((sum, e) => sum + e.relevanceScore, 0);
  const max = caseData.evidence.reduce((sum, e) => sum + e.relevanceScore, 0);
  return max > 0 ? raw / max : 0;
}
