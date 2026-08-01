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
      verdictReactions: {
        GUILTY: [
          { speaker: 'DEFENSE', text: 'Your honor, the defense asks the court to carry everything it heard today into sentencing — the repayments, the recovery, and the two boys waiting on a custody schedule.' },
          { speaker: 'PROSECUTION', text: 'The People will be heard at sentencing as well, Your Honor. The trust account held real people\'s money.' },
        ],
        NOT_GUILTY: [
          { speaker: 'PROSECUTION', text: 'The People accept the verdict, Your Honor. The money is still gone; someone still took it.' },
          { speaker: 'DEFENSE', text: 'Mr. Webb is free to go, Your Honor. The defense thanks the court.' },
        ],
      },
      verdictOptions: [
        { choice: 'GUILTY', lineText: 'On the evidence before it, the court finds the People have proven each element beyond a reasonable doubt. On count one, grand theft, the court finds the defendant guilty.' },
        { choice: 'GUILTY', lineText: 'Intent to repay is not a defense to taking. The money left, it left by his hand, and his own words prove he knew. Guilty on count one.' },
        { choice: 'NOT_GUILTY', lineText: 'The money moved — but the People must prove whose hand moved it, and on this record the court is left with reasonable doubt. Not guilty on count one.' },
        { choice: 'NOT_GUILTY', lineText: 'Where the door stood open, three people held keys, and the hours that matter are missing, the court cannot convict. Not guilty.' },
      ],
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
      directExamination: 'I traced all eleven transfers endpoint to endpoint. Every dollar leaves the client trust account and lands in a personal checking account only Mr. Webb controlled. The timing isn\'t the firm\'s business cycle — nine of eleven transfers post within seventy-two hours of one of his child-support deadlines. When I asked him about the partial repayments, he said nothing and asked for a lawyer. Twenty years working financial crimes, I\'ll tell you what I told my sergeant: people don\'t quietly repay money they don\'t know they took.',
      crossExamination: 'Yes, three repayments came back before anyone at the firm noticed anything — before there was any investigation to get ahead of. No, I can\'t tell you what he intended; I can tell you what the account did. And yes, it\'s true the keycard system had gaps. I didn\'t build my case on the keycard system.',
    },
    {
      id: 'wit-forensic-acct',
      name: 'Dana Whitfield',
      role: 'EXPERT',
      bias: 'NEUTRAL',
      statement: 'Independent forensic accountant. Will testify the math is not in dispute — $14,200 out, $3,100 quietly returned — and that the firm\'s controls were poor enough that the door was standing open. She is careful to say that cuts both ways: it made the taking easy, and it makes proving no one else could have done it harder.',
      credibilityScore: 8,
      directExamination: 'The reconciliation is not complicated and it is not in dispute: $14,200 left the trust account in eleven transfers, and $3,100 came back in three irregular repayments. Net diversion, $11,100. I verified every entry against the bank\'s own records. The arithmetic in my report is the arithmetic.',
      crossExamination: 'Counsel is correct that I flagged the firm\'s controls as materially deficient. One person held the keys, the alarm code, and transfer authority, with no second signature required on trust disbursements. I\'ll say what I wrote: that made the taking easy, and it means I cannot certify, from the books alone, that no one else could have initiated a transfer. That cuts in both directions, and I\'d rather the court hear it from me.',
    },
    {
      id: 'wit-character',
      name: 'Renee Ortiz',
      role: 'CHARACTER',
      bias: 'DEFENSE',
      statement: 'Webb\'s supervisor for four years. Will testify that he was the one who caught and reported two billing errors in the firm\'s own favor; that Ray Hollis knew Webb\'s record when he hired him and called it the best decision he\'d made; and that in the months before the transfers, Webb was sleeping in his car between custody exchanges and would not ask anyone for help.',
      credibilityScore: 6,
      directExamination: 'I supervised Marcus for four years. He\'s the one who caught two billing errors in our own favor and made us return the money — clients never would have known. Ray hired him knowing his record and used to call it the best decision he\'d made. Last winter I found out he was sleeping in his car some nights between custody exchanges. He never told anyone. He\'d have died before asking any of us for help. I wish to God he had.',
      crossExamination: 'No, I didn\'t know about the transfers while they were happening. Yes, I trusted him completely — that\'s rather the point of what happened, isn\'t it. You can call my judgment into question all you like; I watched the man return money nobody knew was missing, twice. I\'m telling you what I saw for four years. The court can weigh it however it needs to.',
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
      disclosureSummary: 'The People disclose certified bank statements for the firm\'s client trust account and the defendant\'s personal checking: eleven transfers over four months, and three partial repayments.',
      prosecutionArgument: 'The People offer the trust account records: eleven transfers, $14,200, every one landing in Mr. Webb\'s personal checking, nine of them within three days of a child-support deadline. These are the bank\'s own certified statements. The paper does not have a theory of the case, Your Honor. It just has the money.',
      defenseObjection: null,
      rulingReactions: {
        ADMITTED: [
          { speaker: 'PROSECUTION', text: 'Thank you, Your Honor. The People\'s case is the paper, and the paper is in.' },
          { speaker: 'DEFENSE', text: 'Noted, Your Honor. Then the court will also be hearing about every dollar that came back.' },
        ],
        EXCLUDED: [
          { speaker: 'PROSECUTION', text: 'Your Honor, the People\'s case just lost its spine. We would ask the court to note the People\'s objection for the record.' },
          { speaker: 'DEFENSE', text: 'The record will reflect it, counsel. The defense thanks the court.' },
        ],
      },
      rulingOptions: [
        { choice: 'ADMITTED', lineText: 'The records are certified and go to the heart of the charged conduct. The objection goes to weight, not admissibility. The motion is denied; the records are admitted.' },
        { choice: 'ADMITTED', lineText: 'The court will not blind the finder of fact to the ledger. Admitted — and counsel may argue the repayments to their heart\'s content.' },
        { choice: 'EXCLUDED', lineText: 'The People have swept years of a man\'s private banking into an exhibit meant to prove four months of conduct. As offered, it is overbroad. Excluded.' },
        { choice: 'EXCLUDED', lineText: 'The prejudice of the exhibit as assembled outweighs its probative value. The motion is granted; the records are excluded.' },
      ],
    },
    {
      id: 'ev-email-chain',
      name: 'Internal email chain',
      type: 'DIGITAL',
      description: 'Emails Webb sent to his own personal account: reminders, a running tally, "put back 800 of March," "audit is the 14th — needs to be whole by the 10th."',
      relevanceScore: 8,
      objectionRisk: 'MEDIUM',
      targetElementId: 'elem-intent',
      disclosureSummary: 'The People disclose emails the defendant sent to his own personal account during the charged period: a running tally, and references to the firm\'s audit calendar.',
      prosecutionArgument: 'The People offer Mr. Webb\'s emails to himself: a running tally of what he took, and the line that ends the intent argument — "audit is the 14th, needs to be whole by the 10th." That is consciousness of guilt in the defendant\'s own words, timed to the calendar of getting caught.',
      defenseObjection: 'Objection, Your Honor. The People want to read half the document. The same tally says "put back 800 of March" — these are the notes of a man keeping careful score of what he intended to return, and offering them as proof he intended to keep the money turns the writing on its head. If they come in, they come in whole.',
      rulingReactions: {
        ADMITTED: [
          { speaker: 'PROSECUTION', text: 'Thank you, Your Honor. The People intend to read them exactly as written.' },
          { speaker: 'DEFENSE', text: 'As will the defense, Your Honor — every word, including "put back."' },
        ],
        EXCLUDED: [
          { speaker: 'PROSECUTION', text: 'The People note their objection. The court has just excluded the defendant\'s state of mind in his own handwriting.' },
          { speaker: 'DEFENSE', text: 'The court has excluded a diary, Your Honor. The defense is grateful.' },
        ],
      },
      rulingOptions: [
        { choice: 'ADMITTED', lineText: 'The defendant\'s own words about the money, in the period the money moved, are plainly probative. What they mean is for the finder of fact. Admitted.' },
        { choice: 'ADMITTED', lineText: 'Ambiguity is an argument, counsel, not a bar. Both readings go to the weight of the evidence. The emails are admitted.' },
        { choice: 'EXCLUDED', lineText: 'These notes admit two readings, and the People offer them for exactly one. The risk the court hears only that one is too high. Excluded.' },
        { choice: 'EXCLUDED', lineText: 'A man\'s private ledger of his own intentions is not a confession. The motion is granted; the emails are excluded.' },
      ],
    },
    {
      id: 'ev-forensic-report',
      name: 'Forensic accounting report',
      type: 'FORENSIC',
      description: 'Independent reconciliation fixing the diversion at $14,200 net of repayments. The trust account held real money — a widow\'s home-sale escrow, a landscaping company\'s payroll reserve.',
      relevanceScore: 7,
      objectionRisk: 'MEDIUM',
      targetElementId: 'elem-value',
      disclosureSummary: 'The People disclose an independent forensic reconciliation of the client trust account, fixing the net diversion at $14,200.',
      prosecutionArgument: 'The People offer the independent forensic reconciliation. It fixes the diversion at $14,200, well past the felony threshold, and it puts faces on the number: a widow\'s escrow, a landscaper\'s payroll. Ms. Whitfield answers to neither party, and her math has not been challenged.',
      defenseObjection: 'No objection to the arithmetic, Your Honor — but the defense objects to the report coming in without its own footnote: the examiner found the firm\'s controls so thin that any of three employees could have initiated a transfer. The People cannot offer her conclusions and leave her caveats on the table.',
      rulingReactions: {
        ADMITTED: [
          { speaker: 'DEFENSE', text: 'Whole is all we asked, Your Honor. The defense welcomes the exhibit.' },
          { speaker: 'PROSECUTION', text: 'The number is $14,200, counsel. Footnotes don\'t subtract.' },
        ],
        EXCLUDED: [
          { speaker: 'PROSECUTION', text: 'Understood, Your Honor.' },
          { speaker: 'DEFENSE', text: 'The defense notes it has lost its best footnote along with the People\'s number, Your Honor. So be it.' },
        ],
      },
      rulingOptions: [
        { choice: 'ADMITTED', lineText: 'The report is admitted in its entirety — the number and the footnote. The expert\'s caution travels with the expert\'s finding.' },
        { choice: 'ADMITTED', lineText: 'An independent reconciliation by a neutral expert is exactly what a finder of fact should have. Admitted, unredacted.' },
        { choice: 'EXCLUDED', lineText: 'The People offer half a document and the defense the other half. A report neither side will take whole helps no one. Excluded.' },
        { choice: 'EXCLUDED', lineText: 'The court is not persuaded the report adds anything to the certified records beyond a footnote both sides intend to weaponize. Excluded.' },
      ],
    },
    {
      id: 'ev-surveillance',
      name: 'Keycard access log and office security footage',
      type: 'DIGITAL',
      description: 'Keycard logs and hallway footage placing Webb alone in the office during two of the eleven transfer windows. Pulled by the landlord three weeks after the fact; the system had already overwritten part of the period, and no one can account for every master keycard.',
      relevanceScore: 6,
      objectionRisk: 'HIGH',
      targetElementId: 'elem-taking',
      disclosureSummary: 'The People disclose keycard access logs and hallway security footage from the office building, covering part of the charged period.',
      prosecutionArgument: 'The People offer the keycard logs and hallway footage. For two of the eleven transfer windows they place Mr. Webb alone in that office — corroboration, in time and place, of what the bank records already show.',
      defenseObjection: 'Objection — foundation and completeness, Your Honor. This system was pulled by the landlord three weeks late, it had already overwritten part of the period, and nobody can account for every master keycard. Two windows out of eleven isn\'t corroboration; it\'s a gap wearing a timestamp, and the People want the court to hear the timestamp and forget the gap.',
      rulingReactions: {
        ADMITTED: [
          { speaker: 'DEFENSE', text: 'Then the court will hear exactly how much of that footage no longer exists, Your Honor — hour by missing hour.' },
          { speaker: 'PROSECUTION', text: 'And they will see who badged in for the hours that do, counsel.' },
        ],
        EXCLUDED: [
          { speaker: 'PROSECUTION', text: 'The People proceed on the paper, Your Honor. It has always been enough.' },
          { speaker: 'DEFENSE', text: 'The defense thanks the court. The People are welcome to their paper.' },
        ],
      },
      rulingOptions: [
        { choice: 'ADMITTED', lineText: 'The gaps are real and counsel will no doubt make them sing, but what survived is relevant and its custody is explained. Admitted, for what it is worth.' },
        { choice: 'ADMITTED', lineText: 'The court is entitled to see who was in the building. The defects go to weight. The motion is denied.' },
        { choice: 'EXCLUDED', lineText: 'An exhibit that cannot account for its own missing hours cannot corroborate anything. The motion is granted; the footage and logs are excluded.' },
        { choice: 'EXCLUDED', lineText: 'Three weeks late, partially overwritten, with master keycards unaccounted for — the court will not let a gap testify. Excluded.' },
      ],
    },
    {
      // [LLM-FILL: InterrogationGen] — the recorded interview. The structure
      // (outcome, challenge ground) is derived from Webb's traits by
      // deriveInterrogationProfile — neuroticism 9 talks despite four priors
      // that should know better — and the transcript dramatizes exactly that:
      // admissions under pressure, then silence and a lawyer when the
      // repayments come up (matching Detective Alvarez's testimony).
      id: 'ev-interrogation',
      name: 'Recorded custodial interview',
      type: 'INTERROGATION',
      description: 'Recording of Webb\'s stationhouse interview with Detective Alvarez, begun seven hours after his arrest, at 4:10 a.m. Webb talks for nearly forty minutes — the firm, the deadlines, "putting it back" — and then, asked about the repayments, goes silent and asks for a lawyer.',
      relevanceScore: 7,
      objectionRisk: 'HIGH',
      targetElementId: 'elem-intent',
      disclosureSummary: 'The People disclose a recorded interview of the defendant, conducted at the station in the early morning after his arrest, in which the defendant discusses the transfers.',
      prosecutionArgument: 'The People offer the recorded interview. Seven hours after his arrest, Mr. Webb called the transfers "loans," said he put back what he could, and recited the firm\'s audit calendar from memory — and then told Detective Alvarez, in his own voice, "I knew it was wrong every time." The tape is the intent element, speaking.',
      defenseObjection: 'The defense moves to suppress, Your Honor. Mr. Webb sat in a holding cell for seven hours — no sleep, eighteen months sober, no counsel — before a 4 a.m. interview in which the detective told him this was his chance to "get ahead of it" for his custody schedule. What the People call intent in his own voice is an exhausted father saying whatever kept his sons in reach. That is not a voluntary statement; it is pressure with a transcript.',
      rulingReactions: {
        ADMITTED: [
          { speaker: 'PROSECUTION', text: 'Thank you, Your Honor. "I knew better every time" — the People could not have put it better.' },
          { speaker: 'DEFENSE', text: 'The defense renews its objection for the record. The court will also hear what the detective promised him just before he said it.' },
        ],
        EXCLUDED: [
          { speaker: 'PROSECUTION', text: 'The People note their exception, Your Honor. The court has just excluded the defendant\'s intent in his own voice.' },
          { speaker: 'DEFENSE', text: 'The defense thanks the court. A statement squeezed out of a man at four in the morning has no business in this record.' },
        ],
      },
      rulingOptions: [
        { choice: 'ADMITTED', lineText: 'The defendant was advised, signed the waiver, and spoke. Exhaustion and a late hour do not, on this record, overbear the will. The motion is denied; the interview is admitted.' },
        { choice: 'ADMITTED', lineText: 'The court has listened to the tape. Pressure, yes — coercion, no. The court may weigh it, and weigh the hour it was made. Admitted.' },
        { choice: 'EXCLUDED', lineText: 'Seven hours in a cell, a promise about his custody schedule, and no counsel in the room — the totality of the circumstances overbears the will. The interview is suppressed.' },
        { choice: 'EXCLUDED', lineText: 'When a detective ties a man\'s children to his answers, what follows is not voluntary. The motion is granted; the tape is excluded.' },
      ],
      interrogation: {
        detectiveName: 'Detective Ray Alvarez',
        outcome: 'PARTIAL_ADMISSION',
        challengeGround: 'VOLUNTARINESS',
        lines: [
          { speaker: 'DETECTIVE', text: 'You\'ve been read your rights and you signed the card. It\'s 4:10 in the morning and this is being recorded. Tell me about the trust account, Marcus.' },
          { speaker: 'DEFENDANT', text: 'I kept that account clean for six years. Ask anyone at the firm. I reconciled it every single day.' },
          { speaker: 'DETECTIVE', text: 'Eleven transfers into your personal checking. Nine of them inside three days of a support deadline. Walk me through that.' },
          { speaker: 'DEFENDANT', text: 'They were loans. I know how that sounds. I logged every one in my own notes — you have the emails, you know I logged them. And I put back what I could, when I could.' },
          { speaker: 'DETECTIVE', text: 'Loans have paperwork and a second signature, Marcus. These had your password. Help me understand, and get ahead of this — for that custody schedule of yours.' },
          { speaker: 'DEFENDANT', text: 'I was going to be whole before the audit. The 14th. I had it planned to the day. A man planning to steal doesn\'t plan to be whole by the audit — he plans to be gone.' },
          { speaker: 'DETECTIVE', text: 'You just gave me the audit date from memory. You knew exactly what you were doing.' },
          { speaker: 'DEFENDANT', text: 'I knew it was wrong. Moving it — I knew it was wrong every time, and I told myself it was a loan every time, and I knew better every time. If I lose my boys over this... you said I could get ahead of it. I\'m trying.' },
          { speaker: 'DETECTIVE', text: 'Then get ahead of it. The repayments — the $3,100. Why those amounts? Why those dates?' },
          { speaker: 'DEFENDANT', text: 'I want a lawyer.' },
        ],
      },
    },
  ],
  // [LLM-FILL: CasePayload] — the dry docket synopsis (case-file modal) and
  // the People's spoken statement of the case, written by the final assembly
  // call with all four stage outputs in context. The synopsis is
  // allegations-only; the narrative color lives in statementOfFacts, spoken
  // by a party.
  summary: 'The People charge Marcus Webb, 38, with one count of grand theft (Cal. Penal Code § 487(a)). The complaint alleges that over a four-month period, while employed as bookkeeper at Hollis & Associates, Webb transferred $14,200 from the firm\'s client trust account to a personal checking account in eleven unauthorized transactions, and that approximately $3,100 was returned in three partial repayments before the transfers ceased. Webb has four prior convictions, including two for theft offenses. The matter comes before the court for arraignment and plea.',
  statementOfFacts: 'Your Honor, the People\'s statement of the case. For six years Marcus Webb kept the books at Hollis & Associates — the only employee with keys, the alarm code, and transfer authority over the client trust account. Over four months, eleven transfers moved $14,200 out of that trust account and into Mr. Webb\'s personal checking. Nine of the eleven landed within days of one of his child-support deadlines. About $3,100 came back in small, irregular repayments before the transfers stopped. The money belonged to the firm\'s clients — a widow\'s home-sale escrow, a landscaping company\'s payroll reserve. The defendant\'s own emails count down to the firm\'s audit. The People will prove the taking, the value, and the intent, and will ask the court to hold Mr. Webb to the same ledger he kept for everyone else.',
  // [LLM-FILL: CasePayload] — closing arguments, written by the final
  // assembly call once the evidence and witness stages are complete.
  closingArguments: {
    prosecution: 'Eleven transfers. One destination account, and only one man with the password. Nine of eleven timed to his own support deadlines, and an email in his own hand counting down to the audit. The defense will tell you about the repayments, and I\'ll say it plainly: returning a fifth of what you took is not innocence, it\'s arithmetic with a conscience — and Section 487 does not have an element for feeling bad. He took money that belonged to a widow and a payroll clerk because he decided his emergency outranked their trust. Hold him to the same ledger he kept for everyone else.',
    defense: 'Marcus Webb is the man who twice returned money this firm didn\'t know it was owed — remember who told you that, his supervisor, under oath. The People\'s own expert says the door stood open and she cannot prove no one else walked through it. Their footage is a gap with a timestamp. What\'s left is a tally that says "put back," repayments that started before anyone was looking, and a man sleeping in his car who never asked a soul for help. Taking with intent to permanently deprive — that is the element. A running note that says "needs to be whole by the 10th" is not a man planning to keep anything. Find the doubt, because it\'s sitting in the People\'s own exhibits.',
  },
};

// [LLM-FILL: PleaNarrative] — the LLM's only plea contribution: the voiced
// rationales. All plea structure (offer/no-offer, proposed sentence, charge
// partition) is computed deterministically by buildPleaPosture; a WEAK case
// must omit defenseRationale entirely (PleaPostureInput enforces this).
const rawWebbPleaNarrative = {
  prosecutionRationale: 'Your Honor, the People\'s position on the agreement. The paper is unanswerable: the transfers, the destination account, the timing against his own support deadlines, and the defendant\'s intent in his own words. The People will not pretend the case has a villain in it — he repaid a fifth of what he took, and the firm\'s own expert will say the door stood open. The offer reflects that. He pleads to the count, restitution is ordered in full, and the widow whose escrow sat in that account is spared a plane ticket and a cross-examination.',
  defenseRationale: 'Your Honor, Mr. Webb has authorized me to state the defense\'s position on the record: he accepts the People\'s offer. The defense does not concede every exhibit — the court has heard what we think of that footage, and the controls finding speaks for itself — but the bank records are the bank records, and my client does not run from them. With his record, a conviction at trial carries the full term, and with it the custody schedule he has spent two years rebuilding. The agreement puts a floor under his life and lets restitution begin now. He enters it with his eyes open.',
  allocution: 'I\'m not going to stand here and tell the court it wasn\'t stealing, because I kept the books and I know exactly what it was. I told myself it was a loan every single time I moved the money, and I put back what I could, and none of that makes it not stealing — it just means I knew better while I did it. Mr. Hollis gave me a chance nobody else would, and I spent it. The people whose money sat in that account never agreed to fund my emergency. I\'d ask the court to leave me able to work, because the restitution is mine to pay and I mean to pay all of it. That\'s all I have, Your Honor.',
  pleaReactions: {
    ACCEPT: [
      { speaker: 'CLERK', text: 'The plea of guilty to count one is entered and accepted. The matter proceeds to sentencing.' },
      { speaker: 'DEFENSE', text: 'Thank you, Your Honor. We would ask the court to remember, at sentencing, everything that made this offer possible — the repayments, the recovery, and the two boys who are waiting on him. Mr. Webb wants the court to know he intends to make every dollar of restitution whole.' },
    ],
    REJECT: [
      { speaker: 'PROSECUTION', text: 'Understood, Your Honor. Then the People will call the widow after all.' },
      { speaker: 'DEFENSE', text: 'My client understands the court\'s ruling. We are ready for trial — and we renew every objection to the People\'s evidence, starting with that footage.' },
      { speaker: 'CLERK', text: 'The plea is withdrawn. The matter is set for trial. The parties will be heard on the admissibility of the People\'s evidence.' },
    ],
  },
  pleaRulingOptions: [
    { choice: 'ACCEPT', lineText: 'The court has reviewed the agreement. It is a hard bargain, honestly arrived at, and the victims are made whole without another year of this. The plea is accepted.' },
    { choice: 'ACCEPT', lineText: 'Mr. Webb, the court will not pretend two years is nothing. But the deal is fair and it is final. The plea is accepted; we proceed to sentencing.' },
    { choice: 'REJECT', lineText: 'Eleven transfers from a client trust account, against this record — two years does not answer it. The plea is rejected. Set the matter for trial.' },
    { choice: 'REJECT', lineText: 'The court is not satisfied this disposition serves the public interest. The plea is rejected. The People will prove their case, or they will not.' },
  ],
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

export const webbCase = defineDemoCase({
  title: 'People v. Marcus Webb',
  teaser: 'A bookkeeper hired on faith, $14,200 gone from the client trust account — and $3,100 quietly put back.',
  payload: rawWebbPayload,
  pleaNarrative: rawWebbPleaNarrative,
  aftermath: webbAftermath,
});
