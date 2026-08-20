import type { ChargeClassification, EvidenceRuling, ObjectionRisk } from '../../schemas/gameSchemas';

// Badge tones for the closed vocabularies that appear in more than one place.
// Each of these was previously declared twice — once in a panel row and again
// in the detail modal for the same entity — which is one edit away from the
// same charge reading FELONY in red on the list and amber in the modal.
//
// Keyed by the schema types, so adding a member to a vocabulary is a type
// error here rather than a silently missing colour at runtime.
type Tone = 'neutral' | 'good' | 'bad' | 'warn';

export const CLASSIFICATION_TONE: Record<ChargeClassification, Tone> = {
  FELONY: 'bad',
  MISDEMEANOR: 'warn',
  INFRACTION: 'neutral',
};

export const RULING_TONE: Record<EvidenceRuling, Tone> = {
  ADMITTED: 'good',
  EXCLUDED: 'bad',
};

export const OBJECTION_RISK_TONE: Record<ObjectionRisk, Tone> = {
  LOW: 'good',
  MEDIUM: 'warn',
  HIGH: 'bad',
};
