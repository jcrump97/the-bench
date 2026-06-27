import { CasePayloadSchema, type CasePayload } from '../../schemas/gameSchemas';

// A minimal, valid CasePayload (no pleaPosture — that field was removed in 1D).
// Numbers are chosen for clean assertions downstream:
//   - maximumPenalties: 10 YEARS PRISON  → MODERATE (0.20) discount = 8 years
//   - evidence relevanceScores 5/3/2 (sum 10) → admitted-ratio tests yield 0.5, 0.8, 1.0
export const rawValidCase = {
  caseId: '24-CR-00001',
  defendant: {
    firstName: 'Jordan',
    lastName: 'Vance',
    age: 34,
    demographics: {
      relationshipStatus: 'SINGLE',
      children: 0,
      employmentStatus: 'EMPLOYED',
      educationLevel: 'COLLEGE',
      substanceAbuseHistory: [],
    },
    pastConvictions: [],
    oceanTraits: {
      openness: 5,
      conscientiousness: 5,
      extraversion: 5,
      agreeableness: 5,
      neuroticism: 5,
    },
  },
  environment: {
    locationType: 'COMMERCIAL',
    timeOfDay: 'NIGHT',
    weather: 'CLEAR',
    description: 'A closed electronics store after hours.',
  },
  charges: [
    {
      id: 'c1',
      name: 'Second-degree burglary',
      classification: 'FELONY',
      elements: [
        { id: 'el1', description: 'Entry into a locked commercial structure.' },
        { id: 'el2', description: 'Intent to commit theft therein.' },
      ],
    },
  ],
  statuteContexts: ['Cal. Penal Code § 459 — burglary.'],
  witnesses: [
    {
      id: 'w1',
      name: 'Alex Reed',
      role: 'EYEWITNESS',
      bias: 'PROSECUTION',
      statement: 'Saw a figure force the rear door.',
      credibilityScore: 7,
    },
    {
      id: 'w2',
      name: 'Sam Okafor',
      role: 'INVESTIGATOR',
      bias: 'NEUTRAL',
      statement: 'Lifted prints from the rear door handle.',
      credibilityScore: 8,
    },
  ],
  evidence: [
    {
      id: 'e1',
      name: 'Rear door fingerprint',
      type: 'FORENSIC',
      description: 'A latent print matching the defendant.',
      relevanceScore: 5,
      objectionRisk: 'LOW',
      targetElementId: 'el1',
    },
    {
      id: 'e2',
      name: 'Security camera still',
      type: 'DIGITAL',
      description: 'A grainy still showing a figure near the door.',
      relevanceScore: 3,
      objectionRisk: 'MEDIUM',
      targetElementId: null,
    },
    {
      id: 'e3',
      name: 'Recovered crowbar',
      type: 'PHYSICAL',
      description: 'A crowbar found near the scene.',
      relevanceScore: 2,
      objectionRisk: 'HIGH',
      targetElementId: null,
    },
  ],
  mandatoryMinimums: [],
  maximumPenalties: [{ type: 'PRISON', unit: 'YEARS', amount: 10 }],
  summary: 'Defendant allegedly broke into a closed electronics store.',
};

// Parsed + validated at module load. Throws here if the fixture ever drifts
// out of schema, failing every dependent test loudly.
export const validCase: CasePayload = CasePayloadSchema.parse(rawValidCase);
