import { CasePayloadSchema, type CasePayload } from '../../schemas/gameSchemas';

// A minimal, valid CasePayload (no pleaPosture — that field was removed in 1D).
// Numbers are chosen for clean assertions downstream:
//   - charge maximumPenalties: 10 YEARS PRISON  → MODERATE (0.20) discount = 8 years
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
      mandatoryMinimums: [],
      maximumPenalties: [{ type: 'PRISON', unit: 'YEARS', amount: 10 }],
      verdictReactions: {
        GUILTY: [{ speaker: 'DEFENSE', text: 'The defense gives notice of appeal.' }],
        NOT_GUILTY: [{ speaker: 'PROSECUTION', text: 'The People accept the verdict of the court.' }],
      },
      verdictOptions: [
        { choice: 'GUILTY', lineText: 'On the count of second-degree burglary, the court finds the defendant guilty.' },
        { choice: 'NOT_GUILTY', lineText: 'On the count of second-degree burglary, the court finds the defendant not guilty.' },
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
      directExamination: 'I saw a figure force the rear door open.',
      crossExamination: 'It was dark, and I was across the street.',
    },
    {
      id: 'w2',
      name: 'Sam Okafor',
      role: 'INVESTIGATOR',
      bias: 'NEUTRAL',
      statement: 'Lifted prints from the rear door handle.',
      credibilityScore: 8,
      directExamination: 'I lifted a clean set of prints from the rear door handle.',
      crossExamination: null,
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
      prosecutionArgument: 'The People offer the latent print lifted from the rear door.',
      defenseObjection: null,
      rulingReactions: {
        ADMITTED: [{ speaker: 'PROSECUTION', text: 'The People mark the print as Exhibit 1.' }],
        EXCLUDED: [{ speaker: 'DEFENSE', text: 'The defense thanks the court.' }],
      },
      rulingOptions: [
        { choice: 'ADMITTED', lineText: 'The print comes in. Admitted.' },
        { choice: 'EXCLUDED', lineText: 'The print stays out. Excluded.' },
      ],
    },
    {
      id: 'e2',
      name: 'Security camera still',
      type: 'DIGITAL',
      description: 'A grainy still showing a figure near the door.',
      relevanceScore: 3,
      objectionRisk: 'MEDIUM',
      targetElementId: null,
      prosecutionArgument: 'The People offer the security camera still showing a figure at the door.',
      defenseObjection: 'Objection — the image is too degraded to identify anyone.',
      rulingReactions: {
        ADMITTED: [{ speaker: 'DEFENSE', text: 'The defense renews its objection for the record.' }],
        EXCLUDED: [{ speaker: 'PROSECUTION', text: 'The People note their exception.' }],
      },
      rulingOptions: [
        { choice: 'ADMITTED', lineText: 'The jury can weigh a grainy image. Admitted.' },
        { choice: 'EXCLUDED', lineText: 'Too degraded to identify anyone. Excluded.' },
      ],
    },
    {
      id: 'e3',
      name: 'Recovered crowbar',
      type: 'PHYSICAL',
      description: 'A crowbar found near the scene.',
      relevanceScore: 2,
      objectionRisk: 'HIGH',
      targetElementId: null,
      prosecutionArgument: 'The People offer the crowbar recovered a block from the scene.',
      defenseObjection: 'Objection — nothing connects this tool to the defendant.',
      rulingReactions: {
        ADMITTED: [{ speaker: 'DEFENSE', text: 'The defense renews its objection for the record.' }],
        EXCLUDED: [{ speaker: 'CLERK', text: 'The crowbar is withdrawn from the exhibit list.' }],
      },
      rulingOptions: [
        { choice: 'ADMITTED', lineText: 'Weight, not admissibility. Admitted.' },
        { choice: 'EXCLUDED', lineText: 'Nothing ties this tool to the defendant. Excluded.' },
      ],
    },
  ],
  summary: 'Defendant allegedly broke into a closed electronics store.',
  closingArguments: {
    prosecution: 'The print on the door is the defendant\'s. That is the case.',
    defense: 'A print proves presence at a public door, not entry and not intent.',
  },
};

// Parsed + validated at module load. Throws here if the fixture ever drifts
// out of schema, failing every dependent test loudly.
export const validCase: CasePayload = CasePayloadSchema.parse(rawValidCase);
