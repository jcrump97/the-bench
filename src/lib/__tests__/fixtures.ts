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
      disclosureSummary: 'The People disclose a latent fingerprint lifted from the rear door handle, pending confirmation.',
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
      disclosureSummary: 'The People disclose a still frame from the store\'s security camera, taken the night of the entry.',
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
      disclosureSummary: 'The People disclose a crowbar recovered near the scene; forensic connection is pending.',
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
  statementOfFacts: 'Your Honor, the People will show that the defendant forced the rear door of the store after hours and entered intending to steal.',
  closingArguments: {
    prosecution: 'The print on the door is the defendant\'s. That is the case.',
    defense: 'A print proves presence at a public door, not entry and not intent.',
  },
};

// Parsed + validated at module load. Throws here if the fixture ever drifts
// out of schema, failing every dependent test loudly.
export const validCase: CasePayload = CasePayloadSchema.parse(rawValidCase);

// An INTERROGATION exhibit consistent with the fixture defendant: Jordan
// Vance (all-MID traits, no priors) derives to DENIAL / MIRANDA, and the
// detective matches the INVESTIGATOR witness w2 (Sam Okafor).
export const rawInterrogationEvidence = {
  id: 'e4',
  name: 'Recorded custodial interview',
  type: 'INTERROGATION',
  description: 'Recording of the defendant\'s stationhouse interview the morning after the arrest.',
  relevanceScore: 4,
  objectionRisk: 'HIGH',
  targetElementId: 'el2',
  disclosureSummary: 'The People disclose a recorded interview of the defendant, conducted the morning after the arrest.',
  prosecutionArgument: 'The People offer the recorded interview of the defendant.',
  defenseObjection: 'The defense moves to suppress — the waiver was neither knowing nor voluntary.',
  rulingReactions: {
    ADMITTED: [{ speaker: 'DEFENSE', text: 'The defense renews its objection to the waiver for the record.' }],
    EXCLUDED: [{ speaker: 'PROSECUTION', text: 'The People note their exception.' }],
  },
  rulingOptions: [
    { choice: 'ADMITTED', lineText: 'The waiver stands and the tape comes in. Admitted.' },
    { choice: 'EXCLUDED', lineText: 'The waiver does not survive scrutiny. The interview is suppressed.' },
  ],
  interrogation: {
    detectiveName: 'Sam Okafor',
    outcome: 'DENIAL',
    challengeGround: 'MIRANDA',
    lines: [
      { speaker: 'DETECTIVE', text: 'You understand the rights as I read them to you?' },
      { speaker: 'DEFENDANT', text: 'Sure. I have nothing to hide.' },
      { speaker: 'DETECTIVE', text: 'Your prints are on the rear door handle.' },
      { speaker: 'DEFENDANT', text: 'I have told you already. I was never inside that store.' },
    ],
  },
};

// The fixture case with the tape appended — used by the interrogation
// playback script tests.
export const validCaseWithInterrogation: CasePayload = CasePayloadSchema.parse({
  ...rawValidCase,
  evidence: [...rawValidCase.evidence, rawInterrogationEvidence],
});
