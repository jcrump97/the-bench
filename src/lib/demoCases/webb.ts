import { defineDemoCase } from './types';

// People v. Marcus Webb — Grand Theft (PC § 487(a)). Chosen because the
// statute's three elements are individually provable by distinct evidence
// (full element coverage), objection risk varies across items (so Act 2
// motion rulings are meaningful), and the defendant's prior record drives the
// defense toward accepting the plea (PENDING_JUDICIAL_REVIEW — the docket's
// player-chooses-the-branch case). The narrative layer is deliberately
// morally textured — partial repayments, thin firm controls, a second-chance
// employer, custody pressure — so the judge is weighing a person, not
// processing a form. This is the quality bar for the future LLM generation
// pipeline's prompts.
const rawWebbPayload = {
  // [LLM-FILL: CasePayload] — caseId is assigned by the pipeline's final
  // assembly call (with `summary`, below) once the four stages complete.
  caseId: '24-CR-00847',
  // [LLM-FILL: CharacterGen] — the whole defendant block: identity,
  // demographics, priors, and OCEAN traits. The traits and priors are not
  // color: assessDefense derives risk tolerance and prior exposure from
  // them, so CharacterGen decides whether this defendant takes a deal.
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
  // [LLM-FILL: EnvironmentGen] — scene enums plus the narrative description.
  environment: {
    locationType: 'COMMERCIAL',
    timeOfDay: 'AFTERNOON',
    weather: 'N/A',
    description: 'The back office of Hollis & Associates, a three-person accounting firm in a strip mall off El Camino Real. Webb\'s desk sits between the filing cabinets and the coffee maker. For six years he was the first one in every morning — and the only employee with keys, the alarm code, and transfer authority over the client trust account.',
  },
  // [LLM-FILL: StatuteSelection] — charges (with elements and per-charge
  // statutory ranges) and statuteContexts. The ranges are the source of
  // truth for sentencing exposure (deriveSentencingExposure) and plea
  // discount floors, so this stage bounds everything the judge can impose.
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
      mandatoryMinimums: [{ type: 'PRISON', unit: 'YEARS', amount: 1 }],
      maximumPenalties: [{ type: 'PRISON', unit: 'YEARS', amount: 3 }],
    },
  ],
  statuteContexts: [
    'Cal. Penal Code § 487(a) — grand theft where the value of the property taken exceeds $950.',
  ],
  // [LLM-FILL: EvidenceGen] — witnesses and evidence. The structured scores
  // (credibility/bias, relevance/objectionRisk, targetElementId) drive
  // assessProsecution's band, which decides whether a plea offer exists at
  // all — so EvidenceGen, not prose, sets the case's Act 1 branch.
  witnesses: [
    {
      id: 'wit-detective',
      name: 'Detective Ray Alvarez',
      role: 'INVESTIGATOR',
      bias: 'PROSECUTION',
      statement: 'Traced all eleven transfers endpoint to endpoint: every dollar lands in an account only Webb controlled, and the timing tracks his child-support deadlines, not the firm\'s business cycle. Will testify that when asked about the partial repayments, Webb said nothing and asked for a lawyer — and that in his experience, "people don\'t quietly repay money they don\'t know they took."',
      credibilityScore: 9,
    },
    {
      id: 'wit-forensic-acct',
      name: 'Dana Whitfield',
      role: 'EXPERT',
      bias: 'NEUTRAL',
      statement: 'Independent forensic accountant. Will testify the math is not in dispute — $14,200 out, $3,100 quietly returned — and that the firm\'s controls were poor enough that the door was standing open. She is careful to say that cuts both ways: it made the taking easy, and it makes proving no one else could have done it harder.',
      credibilityScore: 8,
    },
    {
      id: 'wit-character',
      name: 'Renee Ortiz',
      role: 'CHARACTER',
      bias: 'DEFENSE',
      statement: 'Webb\'s supervisor for four years. Will testify that he was the one who caught and reported two billing errors in the firm\'s own favor; that Ray Hollis knew Webb\'s record when he hired him and called it the best decision he\'d made; and that in the months before the transfers, Webb was sleeping in his car between custody exchanges and would not ask anyone for help.',
      credibilityScore: 6,
    },
  ],
  evidence: [
    {
      id: 'ev-bank-records',
      name: 'Trust account bank records',
      type: 'DOCUMENTARY',
      description: 'Statements showing eleven transfers totaling $14,200 from the client trust account to Webb\'s personal checking. Nine of the eleven land within seventy-two hours of a child-support due date. Three partial repayments totaling $3,100 flow back the other way before the transfers stop entirely.',
      relevanceScore: 9,
      objectionRisk: 'LOW',
      targetElementId: 'elem-value',
    },
    {
      id: 'ev-email-chain',
      name: 'Internal email chain',
      type: 'DIGITAL',
      description: 'Emails Webb sent to his own personal account: reminders, a running tally, "put back 800 of March," "audit is the 14th — needs to be whole by the 10th." The People read consciousness of guilt. The defense reads a man keeping careful score of what he intended to return.',
      relevanceScore: 8,
      objectionRisk: 'MEDIUM',
      targetElementId: 'elem-intent',
    },
    {
      id: 'ev-forensic-report',
      name: 'Forensic accounting report',
      type: 'FORENSIC',
      description: 'Independent reconciliation fixing the diversion at $14,200 net of repayments. A footnote the defense intends to enlarge: the firm\'s controls were thin enough that, in principle, any of the three employees could have initiated a transfer. The trust account held real money — a widow\'s home-sale escrow, a landscaping company\'s payroll reserve.',
      relevanceScore: 7,
      objectionRisk: 'MEDIUM',
      targetElementId: 'elem-value',
    },
    {
      id: 'ev-surveillance',
      name: 'Keycard access log and office security footage',
      type: 'DIGITAL',
      description: 'Keycard logs and hallway footage placing Webb alone in the office during two of the eleven transfer windows. Pulled by the landlord three weeks after the fact; the system had already overwritten part of the period, and no one can account for every master keycard. The People call it corroboration. The defense calls it a gap wearing a timestamp.',
      relevanceScore: 6,
      objectionRisk: 'HIGH',
      targetElementId: 'elem-taking',
    },
  ],
  // [LLM-FILL: CasePayload] — the case-opening summary, written by the final
  // assembly call with all four stage outputs in context.
  summary: 'Marcus Webb kept the books at Hollis & Associates for six years. Ray Hollis hired him knowing his record — two theft convictions and a possession charge — because Webb owned it in the interview, and for six years that faith looked justified. Then, over four months, $14,200 left the client trust account for Webb\'s personal checking in eleven transfers, most landing days before a child-support deadline. About $3,100 came back in small, irregular repayments before the transfers stopped. The trust account held real people\'s money: a widow\'s home-sale escrow, a landscaper\'s payroll reserve. Webb — divorced, two kids, eighteen months sober, sleeping in his car some weeks — has said nothing publicly. His emails say he meant to make it whole before the audit. The People say that is what every embezzler says.',
};

// [LLM-FILL: PleaNarrative] — the LLM's only plea contribution: the voiced
// rationales. All plea structure (offer/no-offer, proposed sentence, charge
// partition) is computed deterministically by buildPleaPosture; a WEAK case
// must omit defenseRationale entirely (PleaPostureInput enforces this).
const rawWebbPleaNarrative = {
  prosecutionRationale: 'The paper is unanswerable: the transfers, the destination account, the timing against his support deadlines, and his intent in his own words. I don\'t need the keycard footage — which is convenient, because it has problems. What I don\'t have is a villain. He paid a fifth of it back, and the firm\'s own expert will say the door was left standing open. That is why the offer exists: he pleads, restitution gets ordered, and nobody has to put the widow on a plane to testify about her escrow.',
  defenseRationale: 'I can beat the footage and I can make the controls finding sing, but I cannot beat the bank records, and Marcus\'s own emails read like a confession with a conscience. With his priors, a trial loss means the full term — and the custody schedule he bled for goes with it. The offer puts a floor under his life. He hates it. I have told him to take it.',
};

// [LLM-FILL: Aftermath] — generated after sentencing from the full end-of-
// game state (resolution path, verdict, imposed sentence), so the real call
// is outcome-conditioned. Authored here to be outcome-agnostic until the
// registry carries per-outcome variants.
const webbAftermathNarrative =
  'The Peninsula Sentinel ran it under "Second Chances, Second Thoughts." Ray Hollis, 71, told the reporter he had hired Webb knowing his record — "a man who owns his past keeps a clean ledger," he had believed — and declined to say whether he would do it again. The widow whose escrow sat in the trust account was repaid in full before the case resolved; she told the paper she felt worse for Webb\'s children than for herself. The landscaping company moved its payroll to a firm in San Mateo anyway. On the Sentinel\'s comment page the argument ran for two days — half the county calling it what happens when you hand a felon the checkbook, the other half asking what exactly a man with a record, no job, and a support order is supposed to do. Webb\'s older son came to the final hearing in his school blazer and left without speaking to anyone. The State Board of Accountancy opened a routine inquiry into the firm\'s trust controls. By spring, Hollis & Associates had a new bookkeeper, a two-signature rule, and — still taped above the coffee maker — the laminated card Webb had put there himself: "Reconcile daily."';

export const webbCase = defineDemoCase({
  title: 'People v. Marcus Webb',
  teaser: 'A bookkeeper hired on faith, $14,200 gone from the client trust account — and $3,100 quietly put back.',
  payload: rawWebbPayload,
  pleaNarrative: rawWebbPleaNarrative,
  aftermathNarrative: webbAftermathNarrative,
});
