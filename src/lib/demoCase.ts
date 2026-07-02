import {
  CasePayloadSchema,
  PleaNarrativeSchema,
  type CasePayload,
  type PleaNarrative,
} from '../schemas/gameSchemas';

// Hardcoded case for offline/keyless play (isDemo === true in useSecurityStore).
// Bypasses GameService and the LLM pipeline entirely; feeds directly into the
// ValidationLayer. Chosen as People v. Marcus Webb — Grand Theft (PC § 487(a))
// because the statute's three elements are individually provable by distinct
// evidence (full element coverage), objection risk varies across items (so Act 2
// motion rulings are meaningful), and the defendant's prior record drives the
// defense toward accepting the plea (PENDING_JUDICIAL_REVIEW, not a trial-only demo).
const rawDemoCase = {
  caseId: '24-CR-00847',
  defendant: {
    firstName: 'Marcus',
    lastName: 'Webb',
    age: 38,
    demographics: {
      relationshipStatus: 'DIVORCED',
      children: 2,
      employmentStatus: 'UNEMPLOYED',
      educationLevel: 'COLLEGE',
      substanceAbuseHistory: [
        { substance: 'Alcohol', status: 'IN_RECOVERY' },
      ],
    },
    pastConvictions: [
      {
        chargeName: 'Petty Theft (Cal. Penal Code § 484)',
        year: 2012,
        sentences: [{ type: 'JAIL', unit: 'DAYS', amount: 90 }],
      },
      {
        chargeName: 'Grand Theft (Cal. Penal Code § 487(a))',
        year: 2018,
        sentences: [{ type: 'PRISON', unit: 'YEARS', amount: 2 }],
      },
      {
        chargeName: 'Grand Theft (Cal. Penal Code § 487(a))',
        year: 2019,
        sentences: [{ type: 'JAIL', unit: 'MONTHS', amount: 4 }],
      },
      {
        chargeName: 'Possession of a Controlled Substance (Health & Safety Code § 11350)',
        year: 2021,
        sentences: [
          {
            type: 'PROBATION',
            unit: 'YEARS',
            amount: 2,
            conditions: ['RANDOM_DRUG_TESTING', 'SUBSTANCE_ABUSE_TREATMENT'],
          },
        ],
      },
    ],
    oceanTraits: {
      openness: 3,
      conscientiousness: 6,
      extraversion: 5,
      agreeableness: 5,
      neuroticism: 9,
    },
  },
  environment: {
    locationType: 'COMMERCIAL',
    timeOfDay: 'AFTERNOON',
    weather: 'N/A',
    description: 'The back office of a small accounting firm where the defendant worked as a bookkeeper with access to client trust accounts.',
  },
  charges: [
    {
      id: 'charge-grand-theft',
      name: 'Grand Theft (Cal. Penal Code § 487(a))',
      classification: 'FELONY',
      elements: [
        { id: 'elem-taking', description: 'Defendant took, or exercised unauthorized control over, property belonging to another.' },
        { id: 'elem-value', description: 'The value of the property taken exceeded $950.' },
        { id: 'elem-intent', description: 'Defendant intended to permanently deprive the owner of the property.' },
      ],
    },
  ],
  statuteContexts: [
    'Cal. Penal Code § 487(a) — grand theft where the value of the property taken exceeds $950.',
  ],
  witnesses: [
    {
      id: 'wit-detective',
      name: 'Detective Ray Alvarez',
      role: 'INVESTIGATOR',
      bias: 'PROSECUTION',
      statement: 'Led the financial fraud investigation and traced the diverted transfers to a personal account controlled by the defendant.',
      credibilityScore: 9,
    },
    {
      id: 'wit-forensic-acct',
      name: 'Dana Whitfield',
      role: 'EXPERT',
      bias: 'NEUTRAL',
      statement: 'Independent forensic accountant who reconciled the firm\'s trust account ledgers against bank records.',
      credibilityScore: 8,
    },
    {
      id: 'wit-character',
      name: 'Renee Ortiz',
      role: 'CHARACTER',
      bias: 'DEFENSE',
      statement: 'Former supervisor who describes the defendant as reliable and under significant financial strain at the time of the transfers.',
      credibilityScore: 6,
    },
  ],
  evidence: [
    {
      id: 'ev-bank-records',
      name: 'Trust account bank records',
      type: 'DOCUMENTARY',
      description: 'Bank statements showing eleven transfers totaling $14,200 from the firm trust account to a personal account in the defendant\'s name.',
      relevanceScore: 9,
      objectionRisk: 'LOW',
      targetElementId: 'elem-value',
    },
    {
      id: 'ev-email-chain',
      name: 'Internal email chain',
      type: 'DIGITAL',
      description: 'Emails in which the defendant discusses covering the transfers before the firm\'s quarterly audit.',
      relevanceScore: 8,
      objectionRisk: 'MEDIUM',
      targetElementId: 'elem-intent',
    },
    {
      id: 'ev-forensic-report',
      name: 'Forensic accounting report',
      type: 'FORENSIC',
      description: 'A reconciliation report quantifying the total diverted funds against the trust account ledger.',
      relevanceScore: 7,
      objectionRisk: 'MEDIUM',
      targetElementId: 'elem-value',
    },
    {
      id: 'ev-surveillance',
      name: 'Keycard access log and office security footage',
      type: 'DIGITAL',
      description: 'Access logs and video placing the defendant alone at the file server during two of the transfer windows.',
      relevanceScore: 6,
      objectionRisk: 'HIGH',
      targetElementId: 'elem-taking',
    },
  ],
  mandatoryMinimums: [{ type: 'PRISON', unit: 'YEARS', amount: 1 }],
  maximumPenalties: [{ type: 'PRISON', unit: 'YEARS', amount: 3 }],
  summary: 'Marcus Webb, a former bookkeeper, is charged with grand theft after allegedly diverting $14,200 from his employer\'s client trust account into a personal account over four months.',
};

export const demoCasePayload: CasePayload = CasePayloadSchema.parse(rawDemoCase);

const rawDemoPleaNarrative = {
  prosecutionRationale: 'The bank records and forensic accounting report establish the diverted amount independent of witness testimony, and the email chain speaks directly to intent. The People are prepared to offer a reduced sentence in exchange for a plea, reserving the office access evidence — the weakest link — for trial only if the defendant rejects the deal.',
  defenseRationale: 'The paper trail on the transfers themselves is clean and hard to contest. Our best angle at trial is suppressing the keycard and surveillance evidence as circumstantial and prejudicial, but that is not a strategy to bet a trial on given the client\'s prior record. Taking the offer caps the exposure.',
};

export const demoPleaNarrative: PleaNarrative = PleaNarrativeSchema.parse(rawDemoPleaNarrative);

export const demoAftermathNarrative: string =
  'Coverage of the Webb case was brief but pointed: the local business journal ran a short piece on trust-account controls at small accounting firms, quoting a rival bookkeeper who called the sentence "fair, given he already had a record." Webb\'s former employer declined to comment beyond confirming new internal audit procedures. No victim impact statement was filed. The clerk\'s office reported no unusual courtroom attendance, and the case drew no further press once sentencing was entered.';
