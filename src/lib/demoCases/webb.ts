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
// is outcome-conditioned. The demo authors one variant per reachable outcome;
// defineDemoCase verifies the set matches what the engine can produce.
const webbAftermath = {
  PLEA_ACCEPTED:
    'The plea was entered on a Tuesday morning and the courtroom was nearly empty. The Peninsula Sentinel ran it under "Second Chances, Second Thoughts." Ray Hollis, 71, told the reporter he had hired Webb knowing his record — "a man who owns his past keeps a clean ledger," he had believed — and declined to say whether he would do it again. The widow whose escrow sat in the trust account was repaid in full under the restitution order; she never had to board a plane, and told the paper she felt worse for Webb\'s children than for herself. The landscaping company moved its payroll to a firm in San Mateo anyway. On the Sentinel\'s comment page the argument ran for two days — half the county calling it what happens when you hand a felon the checkbook, the other half asking what exactly a man with a record, no job, and a support order is supposed to do. Webb\'s older son came to the sentencing in his school blazer and left without speaking to anyone. The State Board of Accountancy opened a routine inquiry into the firm\'s trust controls. By spring, Hollis & Associates had a new bookkeeper, a two-signature rule, and — still taped above the coffee maker — the laminated card Webb had put there himself: "Reconcile daily."',
  CONVICTED:
    'The verdict came back in under a day. The Peninsula Sentinel ran it under "Second Chances, Second Thoughts." Ray Hollis, 71, sat through every day of trial and told the reporter he had hired Webb knowing his record — "a man who owns his past keeps a clean ledger," he had believed — and declined to say whether he would do it again. The widow whose escrow sat in the trust account flew up to testify after all; she was repaid in full before sentencing, and told the paper she felt worse for Webb\'s children than for herself. The landscaping company moved its payroll to a firm in San Mateo. On the Sentinel\'s comment page the argument ran for two days — half the county calling it what happens when you hand a felon the checkbook, the other half asking what exactly a man with a record, no job, and a support order is supposed to do. Webb\'s older son came to the final hearing in his school blazer and left without speaking to anyone. The State Board of Accountancy opened a routine inquiry into the firm\'s trust controls. By spring, Hollis & Associates had a new bookkeeper, a two-signature rule, and — still taped above the coffee maker — the laminated card Webb had put there himself: "Reconcile daily."',
  ACQUITTED:
    'Not guilty, the foreman said, and Marcus Webb put his head in his hands. The Peninsula Sentinel ran it under "Reasonable Doubt at Hollis & Associates." The defense\'s two notes — the overwritten footage and the expert\'s concession that any of three employees could have moved the money — had been enough. Ray Hollis, 71, did not call it vindication; he told the reporter that the money was still gone, that somebody he trusted still took it, and that he had stopped trying to work out which sentence hurt more. The widow\'s escrow was made whole by the firm\'s insurer, which then raised the premium and required a two-signature rule anyway. Webb walked out with no conviction, no job, and a name that returns this story on the first page of any search. His older son came to hear the verdict in his school blazer; outside, for the first time since the arraignment, the two of them talked. The State Board of Accountancy\'s inquiry into the firm\'s trust controls stayed open. The laminated card above the coffee maker stayed too: "Reconcile daily."',
};

// [LLM-FILL: DialogueScript] — the courtroom transcript sidecar (TODO.md,
// "Courtroom transcript redesign"). The future pipeline will generate scripts
// under the same schema; Webb's is hand-authored as the pilot and quality bar.
//
// Craft rules this script establishes for the docket:
// - No scripted COURT lines. Every COURT line in the transcript is either a
//   player-chosen option or the deterministic sentencing pronouncement — the
//   judge never says words the player didn't pick.
// - Option lineText never states offer numbers the deterministic engine
//   doesn't produce. Webb's computed offer is 2 years prison (MODERATE band,
//   20% off the 3-year max), so spoken references to "two years" are safe.
// - Structural facts in dialogue (amounts, evidence, witnesses) must match
//   the payload above; cross-validated at module load once the ids resolve.
const rawWebbDialogueScript = {
  openingBeat: {
    id: 'open',
    lines: [
      {
        speaker: 'CLERK',
        characterId: null,
        text: 'Calling case number 24-CR-00847, People versus Marcus Webb. One count of grand theft, Penal Code section 487(a), a felony. The defendant is present with counsel; the People are represented.',
      },
      {
        speaker: 'PROSECUTION',
        characterId: null,
        text: 'Your honor, for six years Marcus Webb was the most trusted man at Hollis & Associates — the only employee with keys, the alarm code, and transfer authority over the client trust account. Over four months, eleven transfers moved $14,200 from that account into his personal checking. Nine of the eleven landed within seventy-two hours of a child-support deadline. That account held a widow\'s home-sale escrow and a landscaping company\'s payroll. This is not a complicated case.',
      },
      {
        speaker: 'DEFENSE',
        characterId: null,
        text: 'It is more complicated than the People would like, your honor. The firm\'s own expert will testify the controls were thin enough that the door was standing open — any of three employees could have moved that money. $3,100 came back before anyone noticed anything was gone. No witness will put Mr. Webb\'s hand on the keyboard. And the man the People describe was eighteen months sober, sleeping in his car between custody exchanges, and still showed up first every morning.',
      },
      {
        speaker: 'PROSECUTION',
        characterId: null,
        text: 'He repaid a fifth of it, counsel. That is not innocence. That is bookkeeping.',
      },
    ],
  },
  plea: {
    kind: 'PLEA',
    promptBeat: {
      id: 'plea-offer',
      lines: [
        {
          speaker: 'CLERK',
          characterId: null,
          text: 'The parties have submitted a negotiated plea for the court\'s review.',
        },
        {
          speaker: 'PROSECUTION',
          characterId: null,
          text: 'The People\'s offer: Mr. Webb pleads to the count as charged and serves two years, with restitution ordered in full. The paper is unanswerable — the transfers, the destination account, the timing, his intent in his own words. I don\'t need the keycard footage, which is convenient, because it has problems. What I don\'t have is a villain. He pleads, restitution gets ordered, and nobody has to put the widow on a plane to testify about her escrow.',
        },
        {
          speaker: 'DEFENSE',
          characterId: null,
          text: 'The defense joins, your honor — on the record and with my client\'s informed consent. I can beat the footage and I can make the controls finding sing, but I cannot beat the bank records, and Marcus\'s own emails read like a confession with a conscience. With his priors, a trial loss means the full term — and the custody schedule he bled for goes with it. He hates this deal. I have told him to take it.',
        },
        {
          speaker: 'DEFENDANT',
          characterId: null,
          text: 'Whatever keeps me close to my boys, your honor. That\'s all I have to say.',
        },
        {
          speaker: 'CLERK',
          characterId: null,
          text: 'The negotiated plea is before the court.',
        },
      ],
    },
    options: [
      {
        choice: 'ACCEPT',
        lineText: 'The court has reviewed the agreement. It is a hard bargain, honestly arrived at, and the victims are made whole without another year of this. The plea is accepted.',
      },
      {
        choice: 'ACCEPT',
        lineText: 'Mr. Webb, the court will not pretend two years is nothing. But the deal is fair and it is final. The plea is accepted; we proceed to sentencing.',
      },
      {
        choice: 'REJECT',
        lineText: 'Eleven transfers from a client trust account, against this record — two years does not answer it. The plea is rejected. Set the matter for trial.',
      },
      {
        choice: 'REJECT',
        lineText: 'The court is not satisfied this disposition serves the public interest. The plea is rejected. The People will prove their case, or they will not.',
      },
    ],
    reactionBeats: {
      ACCEPT: {
        id: 'plea-accepted',
        lines: [
          {
            speaker: 'CLERK',
            characterId: null,
            text: 'The plea of guilty to count one is entered and accepted. The matter proceeds to sentencing.',
          },
          {
            speaker: 'DEFENSE',
            characterId: null,
            text: 'Thank you, your honor. We would ask the court to remember, at sentencing, everything that made this offer possible — the repayments, the recovery, the two boys.',
          },
          {
            speaker: 'DEFENDANT',
            characterId: null,
            text: 'I\'ll make it whole. I was always going to.',
          },
        ],
      },
      REJECT: {
        id: 'plea-rejected',
        lines: [
          {
            speaker: 'PROSECUTION',
            characterId: null,
            text: 'Understood, your honor. Then the People will call the widow after all.',
          },
          {
            speaker: 'DEFENSE',
            characterId: null,
            text: 'My client understands the court\'s ruling. We are ready for trial — and we renew every objection to the People\'s evidence, starting with that footage.',
          },
          {
            speaker: 'CLERK',
            characterId: null,
            text: 'The plea is withdrawn. The matter is set for trial. The parties will be heard on the admissibility of the People\'s evidence.',
          },
        ],
      },
    },
  },
  motions: [
    {
      kind: 'MOTION',
      evidenceId: 'ev-bank-records',
      promptBeat: {
        id: 'mot-bank-prompt',
        lines: [
          {
            speaker: 'CLERK',
            characterId: null,
            text: 'First motion: the defense moves to exclude the trust account bank records.',
          },
          {
            speaker: 'DEFENSE',
            characterId: null,
            text: 'As offered, your honor, the exhibit sweeps in years of Mr. Webb\'s private banking to prove four months of transfers. It is overbroad, and its breadth is the prejudice — the People want the jury reading a poor man\'s checkbook.',
          },
          {
            speaker: 'PROSECUTION',
            characterId: null,
            text: 'These are certified business records, your honor, and they are the heart of the case. Detective Alvarez can speak to exactly what they show.',
          },
          {
            speaker: 'WITNESS',
            characterId: 'wit-detective',
            text: 'I traced all eleven transfers endpoint to endpoint. Every dollar lands in an account only Mr. Webb controlled. Nine of the eleven post within seventy-two hours of a child-support due date. The timing tracks his deadlines, not the firm\'s business cycle.',
          },
          {
            speaker: 'DEFENSE',
            characterId: null,
            text: 'And the three repayments, Detective — did your timeline flag those too?',
          },
          {
            speaker: 'WITNESS',
            characterId: 'wit-detective',
            text: 'They\'re in the exhibit, counsel. So is my note about them: in my experience, people don\'t quietly repay money they don\'t know they took.',
          },
        ],
      },
      options: [
        {
          choice: 'ADMITTED',
          lineText: 'The records are certified and go to the heart of the charged conduct. The objection goes to weight, not admissibility. The motion is denied; the records are admitted.',
        },
        {
          choice: 'ADMITTED',
          lineText: 'The court will not blind the finder of fact to the ledger. Admitted — and counsel may argue the repayments to their heart\'s content.',
        },
        {
          choice: 'EXCLUDED',
          lineText: 'The People have swept years of a man\'s private banking into an exhibit meant to prove four months of conduct. As offered, it is overbroad. Excluded.',
        },
        {
          choice: 'EXCLUDED',
          lineText: 'The prejudice of the exhibit as assembled outweighs its probative value. The motion is granted; the records are excluded.',
        },
      ],
      reactionBeats: {
        ADMITTED: {
          id: 'mot-bank-in',
          lines: [
            {
              speaker: 'PROSECUTION',
              characterId: null,
              text: 'Thank you, your honor. The People\'s case is the paper, and the paper is in.',
            },
            {
              speaker: 'DEFENSE',
              characterId: null,
              text: 'Noted, your honor. Then the jury will also be hearing about every dollar that came back.',
            },
          ],
        },
        EXCLUDED: {
          id: 'mot-bank-out',
          lines: [
            {
              speaker: 'PROSECUTION',
              characterId: null,
              text: 'Your honor, the People\'s case just lost its spine. We would ask the court to note the People\'s objection for the record.',
            },
            {
              speaker: 'DEFENSE',
              characterId: null,
              text: 'The record will reflect it, counsel. The defense thanks the court.',
            },
          ],
        },
      },
    },
    {
      kind: 'MOTION',
      evidenceId: 'ev-email-chain',
      promptBeat: {
        id: 'mot-email-prompt',
        lines: [
          {
            speaker: 'CLERK',
            characterId: null,
            text: 'Next motion: the defense moves to exclude the internal email chain.',
          },
          {
            speaker: 'DEFENSE',
            characterId: null,
            text: 'These are private notes a man wrote to himself, your honor. "Put back 800 of March." A running tally is what a person keeps when he intends to return the money. The People want to read a conscience as a confession.',
          },
          {
            speaker: 'PROSECUTION',
            characterId: null,
            text: '"Audit is the 14th — needs to be whole by the 10th." That is not conscience, your honor, that is a schedule for concealment. Consciousness of guilt, in the defendant\'s own words, timed to the day.',
          },
          {
            speaker: 'DEFENSE',
            characterId: null,
            text: 'Or the deadline a drowning man set himself to make it right. The jury should not be handed ambiguity dressed as admission.',
          },
        ],
      },
      options: [
        {
          choice: 'ADMITTED',
          lineText: 'The defendant\'s own words about the money, in the period the money moved, are plainly probative. What they mean is for the finder of fact. Admitted.',
        },
        {
          choice: 'ADMITTED',
          lineText: 'Ambiguity is an argument, counsel, not a bar. Both readings go to the jury. The emails are admitted.',
        },
        {
          choice: 'EXCLUDED',
          lineText: 'These notes admit two readings, and the People offer them for exactly one. The risk the jury hears only that one is too high. Excluded.',
        },
        {
          choice: 'EXCLUDED',
          lineText: 'A man\'s private ledger of his own intentions is not a confession. The motion is granted; the emails are excluded.',
        },
      ],
      reactionBeats: {
        ADMITTED: {
          id: 'mot-email-in',
          lines: [
            {
              speaker: 'PROSECUTION',
              characterId: null,
              text: 'Thank you, your honor. The People intend to read them exactly as written.',
            },
            {
              speaker: 'DEFENSE',
              characterId: null,
              text: 'As will the defense, your honor — every word, including "put back."',
            },
          ],
        },
        EXCLUDED: {
          id: 'mot-email-out',
          lines: [
            {
              speaker: 'PROSECUTION',
              characterId: null,
              text: 'The People note their objection. The court has just excluded the defendant\'s state of mind in his own handwriting.',
            },
            {
              speaker: 'DEFENSE',
              characterId: null,
              text: 'The court has excluded a diary, your honor. The defense is grateful.',
            },
          ],
        },
      },
    },
    {
      kind: 'MOTION',
      evidenceId: 'ev-forensic-report',
      promptBeat: {
        id: 'mot-forensic-prompt',
        lines: [
          {
            speaker: 'CLERK',
            characterId: null,
            text: 'Next motion: admissibility of the independent forensic accounting report. The People call the report\'s author.',
          },
          {
            speaker: 'WITNESS',
            characterId: 'wit-forensic-acct',
            text: 'The math is not in dispute. $14,200 left the trust account; $3,100 came back in three irregular repayments before the transfers stopped. I\'ll also stand on my footnote: the firm\'s controls were poor enough that the door was standing open — and I mean that cuts both ways. It made the taking easy, and it makes proving no one else could have done it harder.',
          },
          {
            speaker: 'PROSECUTION',
            characterId: null,
            text: 'The People offer the report for the number, your honor. The footnote is Ms. Whitfield\'s caution, not her finding.',
          },
          {
            speaker: 'DEFENSE',
            characterId: null,
            text: 'The defense has no quarrel with this witness, your honor — we want the jury to hear every word of that footnote. Our concern is a redacted exhibit. If the report comes in, it comes in whole.',
          },
          {
            speaker: 'WITNESS',
            characterId: 'wit-forensic-acct',
            text: 'For what it is worth, I wrote the footnote because the number is incomplete without it. I would not want my work quoted in halves.',
          },
        ],
      },
      options: [
        {
          choice: 'ADMITTED',
          lineText: 'The report is admitted in its entirety — the number and the footnote. The expert\'s caution travels with the expert\'s finding.',
        },
        {
          choice: 'ADMITTED',
          lineText: 'An independent reconciliation by a neutral expert is exactly what a finder of fact should have. Admitted, unredacted.',
        },
        {
          choice: 'EXCLUDED',
          lineText: 'The People offer half a document and the defense the other half. A report neither side will take whole helps no one. Excluded.',
        },
        {
          choice: 'EXCLUDED',
          lineText: 'The court is not persuaded the report adds anything to the certified records beyond a footnote both sides intend to weaponize. Excluded.',
        },
      ],
      reactionBeats: {
        ADMITTED: {
          id: 'mot-forensic-in',
          lines: [
            {
              speaker: 'DEFENSE',
              characterId: null,
              text: 'Whole is all we asked, your honor. The defense welcomes the exhibit.',
            },
            {
              speaker: 'PROSECUTION',
              characterId: null,
              text: 'The number is $14,200, counsel. Footnotes don\'t subtract.',
            },
          ],
        },
        EXCLUDED: {
          id: 'mot-forensic-out',
          lines: [
            {
              speaker: 'WITNESS',
              characterId: 'wit-forensic-acct',
              text: 'Understood, your honor.',
            },
            {
              speaker: 'DEFENSE',
              characterId: null,
              text: 'The defense notes it has lost its best footnote along with the People\'s number, your honor. So be it.',
            },
          ],
        },
      },
    },
    {
      kind: 'MOTION',
      evidenceId: 'ev-surveillance',
      promptBeat: {
        id: 'mot-keycard-prompt',
        lines: [
          {
            speaker: 'CLERK',
            characterId: null,
            text: 'Final motion: the defense moves to exclude the keycard access log and office security footage.',
          },
          {
            speaker: 'DEFENSE',
            characterId: null,
            text: 'This is the People\'s weakest exhibit and they know it, your honor. The footage was pulled three weeks late, the system had already overwritten part of the period, and no one can account for every master keycard. It is a gap wearing a timestamp.',
          },
          {
            speaker: 'PROSECUTION',
            characterId: null,
            text: 'It places the defendant alone in the office during two of the eleven transfer windows, your honor. Incompleteness goes to weight. The detective can speak to the chain.',
          },
          {
            speaker: 'WITNESS',
            characterId: 'wit-detective',
            text: 'The system overwrote part of the window before we imaged it — that\'s in my report. I can\'t tell you where every master card was. I can tell you where Mr. Webb\'s was.',
          },
          {
            speaker: 'DEFENSE',
            characterId: null,
            text: 'Thank you, Detective. Neither can anyone else — and that is precisely the problem.',
          },
        ],
      },
      options: [
        {
          choice: 'ADMITTED',
          lineText: 'The gaps are real and counsel will no doubt make them sing, but what survived is relevant and its custody is explained. Admitted, for what it is worth.',
        },
        {
          choice: 'ADMITTED',
          lineText: 'The jury is entitled to see who was in the building. The defects go to weight. The motion is denied.',
        },
        {
          choice: 'EXCLUDED',
          lineText: 'An exhibit that cannot account for its own missing hours cannot corroborate anything. The motion is granted; the footage and logs are excluded.',
        },
        {
          choice: 'EXCLUDED',
          lineText: 'Three weeks late, partially overwritten, with master keycards unaccounted for — the court will not let a gap testify. Excluded.',
        },
      ],
      reactionBeats: {
        ADMITTED: {
          id: 'mot-keycard-in',
          lines: [
            {
              speaker: 'DEFENSE',
              characterId: null,
              text: 'Then the jury will hear exactly how much of that footage no longer exists, your honor — hour by missing hour.',
            },
            {
              speaker: 'PROSECUTION',
              characterId: null,
              text: 'And they will see who badged in for the hours that do, counsel.',
            },
          ],
        },
        EXCLUDED: {
          id: 'mot-keycard-out',
          lines: [
            {
              speaker: 'PROSECUTION',
              characterId: null,
              text: 'The People proceed on the paper, your honor. It has always been enough.',
            },
            {
              speaker: 'DEFENSE',
              characterId: null,
              text: 'The defense thanks the court. The People are welcome to their paper.',
            },
          ],
        },
      },
    },
  ],
  verdicts: [
    {
      kind: 'VERDICT',
      chargeId: 'charge-grand-theft',
      promptBeat: {
        id: 'closing',
        lines: [
          {
            speaker: 'CLERK',
            characterId: null,
            text: 'Both sides have rested. The court will hear closing argument on count one, grand theft.',
          },
          {
            speaker: 'PROSECUTION',
            characterId: null,
            text: 'Eleven transfers. One destination account, and only one man with authority over the source. Nine of eleven timed to his support deadlines, and his own reminder — "needs to be whole by the 10th." The defense will talk about doors standing open. Doors do not move $14,200. People do, and the evidence tells you which one.',
          },
          {
            speaker: 'DEFENSE',
            characterId: null,
            text: 'The People must prove whose hand moved that money, and they cannot. Three employees, thin controls, footage that no longer exists for the hours that matter. And a man who put $3,100 back before anyone knew anything was missing — because he was trying, badly and alone, to make it right. That is not proof beyond a reasonable doubt. That is a story with the doubt sanded off.',
          },
          {
            speaker: 'WITNESS',
            characterId: 'wit-character',
            text: 'You asked me to be brief, so I will be. Marcus caught two billing errors in the firm\'s own favor and reported them himself. Ray Hollis called hiring him the best decision he ever made. Whatever the court decides, it should decide it about that man.',
          },
          {
            speaker: 'DEFENDANT',
            characterId: null,
            text: 'I was going to put it back. I know how that sounds. Everyone in recovery knows how that sounds.',
          },
          {
            speaker: 'CLERK',
            characterId: null,
            text: 'The matter is submitted. The court will render its verdict on count one.',
          },
        ],
      },
      options: [
        {
          choice: 'GUILTY',
          lineText: 'On the evidence before it, the court finds the People have proven each element beyond a reasonable doubt. On count one, grand theft, the court finds the defendant guilty.',
        },
        {
          choice: 'GUILTY',
          lineText: 'Intent to repay is not a defense to taking. The money left, it left by his hand, and his own words prove he knew. Guilty on count one.',
        },
        {
          choice: 'NOT_GUILTY',
          lineText: 'The money moved — but the People must prove whose hand moved it, and on this record the court is left with reasonable doubt. Not guilty on count one.',
        },
        {
          choice: 'NOT_GUILTY',
          lineText: 'Where the door stood open, three people held keys, and the hours that matter are missing, the court cannot convict. Not guilty.',
        },
      ],
      reactionBeats: {
        GUILTY: {
          id: 'verdict-guilty',
          lines: [
            {
              speaker: 'DEFENDANT',
              characterId: null,
              text: 'Okay. Okay.',
            },
            {
              speaker: 'DEFENSE',
              characterId: null,
              text: 'Your honor, the defense asks the court to carry everything it heard today into sentencing — the repayments, the recovery, and the two boys waiting on a custody schedule.',
            },
            {
              speaker: 'PROSECUTION',
              characterId: null,
              text: 'The People will be heard at sentencing as well, your honor. The trust account held real people\'s money.',
            },
          ],
        },
        NOT_GUILTY: {
          id: 'verdict-not-guilty',
          lines: [
            {
              speaker: 'DEFENDANT',
              characterId: null,
              text: 'Thank you. Thank you, your honor.',
            },
            {
              speaker: 'PROSECUTION',
              characterId: null,
              text: 'The People accept the verdict, your honor. The money is still gone; someone still took it.',
            },
            {
              speaker: 'DEFENSE',
              characterId: null,
              text: 'Mr. Webb is free to go, your honor. The defense thanks the court.',
            },
          ],
        },
      },
    },
  ],
};

export const webbCase = defineDemoCase({
  title: 'People v. Marcus Webb',
  teaser: 'A bookkeeper hired on faith, $14,200 gone from the client trust account — and $3,100 quietly put back.',
  payload: rawWebbPayload,
  pleaNarrative: rawWebbPleaNarrative,
  aftermath: webbAftermath,
  dialogueScript: rawWebbDialogueScript,
});
