import { defineDemoCase } from './types';

// People v. Eli Navarro — Misdemeanor Vandalism (PC § 594(a)). The guided
// tutorial case: a small, morally legible matter (a repeat tagger, a city
// wall, $380 in damage) authored as the player-judge's first morning on the
// bench. The mentor voice lives entirely inside the ordinary spoken fields —
// a patient clerk, counsel who explain what they are doing, a veteran
// officer — and the out-of-fiction control explainers live in the bundle's
// `tutorial` block (presentation tier, never in the payload).
//
// Tuned MODERATE (score ~56) with a defendant built to accept: four priors
// including a felony prison term (priorExposure 85) and an anxious,
// low-openness profile (risk tolerance ~16), so the offer computes to
// PENDING_JUDICIAL_REVIEW and every decision type in the game is reachable
// from this one small case.
const rawNavarroPayload = {
  // [LLM-FILL: CasePayload] — caseId assigned by the pipeline's final
  // assembly call.
  caseId: '24-CR-00101',
  // [LLM-FILL: CharacterGen] — the priors and the anxious profile are what
  // make the defense take the deal; the tutorial depends on that reachability.
  defendant: {
    firstName: 'Eli',
    lastName: 'Navarro',
    age: 34,
    demographics: {
      relationshipStatus: 'SINGLE',
      children: 0,
      employmentStatus: 'EMPLOYED',
      educationLevel: 'HIGH_SCHOOL',
      substanceAbuseHistory: [],
    },
    pastConvictions: [
      {
        chargeName: 'Vandalism (Cal. Penal Code § 594)',
        year: 2012,
        sentences: [{ type: 'COMMUNITY_SERVICE', unit: 'HOURS', amount: 80 }],
      },
      {
        chargeName: 'Vandalism (Cal. Penal Code § 594)',
        year: 2014,
        sentences: [{ type: 'FINE', unit: 'DOLLARS', amount: 400 }],
      },
      {
        chargeName: 'Felony Vandalism, damage over $400 (Cal. Penal Code § 594(b)(1))',
        year: 2016,
        sentences: [{ type: 'PRISON', unit: 'MONTHS', amount: 16 }],
      },
      {
        chargeName: 'Vandalism (Cal. Penal Code § 594)',
        year: 2021,
        sentences: [
          {
            type: 'PROBATION',
            unit: 'YEARS',
            amount: 1,
            conditions: ['COMMUNITY_SERVICE'],
          },
        ],
      },
    ],
    oceanTraits: {
      openness: 2,
      conscientiousness: 7,
      extraversion: 4,
      agreeableness: 6,
      neuroticism: 9,
    },
  },
  // [LLM-FILL: EnvironmentGen]
  environment: {
    locationType: 'PUBLIC_SPACE',
    timeOfDay: 'NIGHT',
    weather: 'CLEAR',
    description: 'The Fourth Street underpass, two blocks from the courthouse. The city repainted its retaining wall in March under the downtown beautification program; by June the fresh anti-graffiti coating carried a two-tone piece reading "HALO" in letters four feet tall. Damage assessed at $380 — twenty dollars under the felony line, as everyone in the courthouse has already remarked.',
  },
  // [LLM-FILL: StatuteSelection] — one misdemeanor count, a small statutory
  // range: the tutorial's sentencing decision is real but low-stakes.
  charges: [
    {
      id: 'charge-vandalism',
      name: 'Vandalism, damage under $400 (Cal. Penal Code § 594(a))',
      classification: 'MISDEMEANOR',
      elements: [
        { id: 'elem-defaced', description: 'Defendant defaced real or personal property belonging to another with graffiti or other inscribed material.' },
        { id: 'elem-malice', description: 'Defendant acted maliciously — intentionally, and with knowledge the property was not his own.' },
      ],
      mandatoryMinimums: [],
      maximumPenalties: [
        { type: 'JAIL', unit: 'MONTHS', amount: 12 },
        { type: 'FINE', unit: 'DOLLARS', amount: 1000 },
      ],
      verdictReactions: {
        GUILTY: [
          { speaker: 'DEFENSE', text: 'The defense notes its exception for the record, Your Honor — that is the formal way of preserving our disagreement — and asks the court to remember the restitution offer at sentencing.' },
          { speaker: 'CLERK', text: 'The verdict is entered on the record. The matter proceeds to sentencing.' },
        ],
        NOT_GUILTY: [
          { speaker: 'PROSECUTION', text: 'The People accept the verdict, Your Honor. The wall, for what it is worth, has already been repainted.' },
          { speaker: 'CLERK', text: 'The verdict is entered. Mr. Navarro, you are free to go.' },
        ],
      },
      verdictOptions: [
        { choice: 'GUILTY', lineText: 'The footage, the kit in the van, and the letterforms point one way, and together they carry the burden. On the single count of vandalism, the court finds the defendant guilty.' },
        { choice: 'GUILTY', lineText: 'The court has weighed what was admitted and only what was admitted. It is enough. Guilty.' },
        { choice: 'NOT_GUILTY', lineText: 'A hooded figure, a common paint color, and letters anyone can copy — the People\'s case asks the court to fill its gaps with the defendant\'s record, and the court declines. Not guilty.' },
        { choice: 'NOT_GUILTY', lineText: 'On the record before it, the court is left with reasonable doubt. Not guilty.' },
      ],
    },
  ],
  statuteContexts: [
    'Cal. Penal Code § 594(a) — vandalism: maliciously defacing with graffiti, damaging, or destroying the property of another; a misdemeanor where the damage is under $400 (§ 594(b)(2)(A)).',
  ],
  // [LLM-FILL: EvidenceGen] — three exhibits at the schema minimum, one per
  // objection posture: a clean no-objection exhibit (teaches the waiver), a
  // MEDIUM fight, and a HIGH fight — so the tutorial's Act 2 shows the
  // player every shape a motion can take.
  witnesses: [
    {
      id: 'wit-officer',
      name: 'Officer Dana Pruitt',
      role: 'INVESTIGATOR',
      bias: 'PROSECUTION',
      statement: 'Twenty-two years on the downtown beat; has cited Mr. Navarro before and will say so plainly. Will testify to pulling the city camera footage, finding the paint kit and sketchbook in Navarro\'s work van, and the letterform comparison with prior HALO pieces. Will concede the footage never shows a face.',
      credibilityScore: 7,
      directExamination: 'I\'ve worked the downtown beat twenty-two years, and I\'ll tell the court up front: I know Eli. I\'ve cited him twice. The morning the city called about the underpass, I pulled the camera footage — a figure at the wall from 1:10 to 1:40 a.m., hood up, working left to right without stopping, the way a man paints when he already knows the piece. The next day I found two cans of the same two-tone in the back of his work van, and a sketchbook with the same four letters drawn thirty different ways. I\'ve seen HALO on walls in this district for ten years. This is the same hand.',
      crossExamination: 'No, the footage never shows a face — I said that on direct and I\'ll say it again on cross, because the court should weigh it. And counsel is right that the paint is a stock color sold in every hardware store in the county. What I\'d say to that is: it isn\'t the paint alone, or the book alone, or the footage alone. It\'s that they all sit in the same van. But no — no one saw his face. That\'s true.',
    },
    {
      id: 'wit-employer',
      name: 'Ruth Okada',
      role: 'CHARACTER',
      bias: 'DEFENSE',
      statement: 'Owner of Okada Signworks, Navarro\'s employer of six years. Will testify he is her best letter-painter, that the sketchbook is a working artist\'s book she has seen him fill on lunch breaks for years, and that keeping paint in the van is his job. She was not with him that night and will say so.',
      credibilityScore: 6,
      directExamination: 'Eli has painted signs for me for six years — the best letter-painter I\'ve ever employed. That sketchbook the officer keeps holding up? I\'ve watched him fill books like it on his lunch break for years. It\'s what letter men do. And the paint in the van is my paint, for my jobs — keeping it there is his job. I know his history. I hired him knowing it, and he has never given me a reason to regret it.',
      crossExamination: 'No, I wasn\'t with him that night — I don\'t follow my employees home, counselor. Yes, the letters in his book look like the letters on that wall. Letters look like letters; that\'s the trade. What I can tell the court is what six years looks like up close. Whether that helps you or him is for the judge to say.',
    },
  ],
  evidence: [
    {
      id: 'ev-city-footage',
      name: 'City camera footage',
      type: 'DIGITAL',
      description: 'Thirty minutes from the city\'s underpass camera: a hooded figure painting the wall from 1:10 to 1:40 a.m., steady and unhurried. The camera is positioned above and behind; no face is ever visible. Time-stamped and authenticated by the city\'s records custodian.',
      relevanceScore: 7,
      objectionRisk: 'LOW',
      targetElementId: 'elem-defaced',
      disclosureSummary: 'The People disclose thirty minutes of city camera footage from the Fourth Street underpass, recorded the night of the incident.',
      prosecutionArgument: 'The People offer the city\'s own camera footage: thirty minutes, time-stamped, authenticated by the records custodian. The court will see the wall defaced in real time by a painter who never hesitates — someone executing a piece he had already designed. The footage is the act itself; who performed it is what the rest of the People\'s case supplies.',
      defenseObjection: null,
      rulingReactions: {
        ADMITTED: [
          { speaker: 'CLERK', text: 'City camera footage is marked and admitted as People\'s Exhibit 1.' },
          { speaker: 'DEFENSE', text: 'No objection was our position, Your Honor — the defense is content for the court to watch a hooded figure prove nothing about a face.' },
        ],
        EXCLUDED: [
          { speaker: 'PROSECUTION', text: 'The People note their exception, Your Honor. That was the act itself, on film.' },
          { speaker: 'CLERK', text: 'The footage is withdrawn from the exhibit list.' },
        ],
      },
      rulingOptions: [
        { choice: 'ADMITTED', lineText: 'The footage is authenticated, relevant, and unopposed. Admitted.' },
        { choice: 'ADMITTED', lineText: 'With no objection before the court, the footage comes in as a matter of course. Admitted.' },
        { choice: 'EXCLUDED', lineText: 'The court excludes this exhibit on its own initiative, unpersuaded of its foundation. Excluded.' },
        { choice: 'EXCLUDED', lineText: 'The footage is excluded.' },
      ],
    },
    {
      id: 'ev-paint-kit',
      name: 'Paint cans and sketchbook from the work van',
      type: 'PHYSICAL',
      description: 'Two cans of two-tone enamel matching the wall, and a sketchbook of HALO letterforms in dozens of variations, recovered from Navarro\'s employer-owned work van the day after the incident.',
      relevanceScore: 5,
      objectionRisk: 'MEDIUM',
      targetElementId: 'elem-malice',
      disclosureSummary: 'The People disclose two paint cans and a sketchbook recovered from the defendant\'s work van the day after the incident.',
      prosecutionArgument: 'The People offer the contents of the defendant\'s van: two cans of the same two-tone enamel that went up on that wall, and a sketchbook working the same four letters over and over — design studies for the piece the camera watched being executed. Together they show planning, which is what malice looks like in paint.',
      defenseObjection: 'Objection, Your Honor — this exhibit is Mr. Navarro\'s trade dressed up as his guilt. He paints signs for a living; the van is his employer\'s, the paint is stock enamel sold in every hardware store in the county, and the sketchbook is what every letter-painter carries. The People are offering a man\'s toolbox as evidence of malice, and the prejudice runs well ahead of the proof.',
      rulingReactions: {
        ADMITTED: [
          { speaker: 'DEFENSE', text: 'The defense renews its objection for the record, Your Honor, and Ms. Okada will tell the court exactly whose paint that is.' },
          { speaker: 'PROSECUTION', text: 'The People welcome that testimony, counsel. The jury can decide what the sketchbook was for.' },
        ],
        EXCLUDED: [
          { speaker: 'PROSECUTION', text: 'The People note their exception, Your Honor. The design studies were the malice element.' },
          { speaker: 'CLERK', text: 'The paint cans and sketchbook are withdrawn from the exhibit list.' },
        ],
      },
      rulingOptions: [
        { choice: 'ADMITTED', lineText: 'A working painter\'s tools are not off-limits merely because he works with them; what they prove is for the finder of fact. Admitted.' },
        { choice: 'ADMITTED', lineText: 'The objection goes to weight, not admissibility, and counsel may argue the toolbox theory to the court\'s heart\'s content. Admitted.' },
        { choice: 'EXCLUDED', lineText: 'The People offer a man\'s trade as his intent, and the court is not persuaded the connection rises above his occupation. Excluded.' },
        { choice: 'EXCLUDED', lineText: 'The prejudice here outweighs what the exhibit actually proves. The motion is granted; the kit is excluded.' },
      ],
    },
    {
      id: 'ev-style-memo',
      name: 'Letterform comparison memo',
      type: 'DOCUMENTARY',
      description: 'A two-page memo by a patrol officer with the graffiti detail, comparing the underpass letterforms to photographs of five prior HALO pieces, three of them from cases where Navarro was convicted. The officer has no formal training in handwriting or forensic document analysis.',
      relevanceScore: 5,
      objectionRisk: 'HIGH',
      targetElementId: 'elem-defaced',
      disclosureSummary: 'The People disclose a two-page memo comparing the underpass letterforms to photographs of five earlier pieces attributed to the same tag.',
      prosecutionArgument: 'The People offer the graffiti detail\'s letterform comparison: five prior HALO pieces set beside the underpass wall, matched stroke for stroke by the officer who has photographed this tag for a decade. Style is signature, Your Honor — that is the entire culture of this offense — and the memo reads the signature.',
      defenseObjection: 'The defense moves to exclude, Your Honor. This is opinion testimony from a witness with no training in any comparative discipline — a patrol officer eyeballing photographs — and it smuggles in Mr. Navarro\'s record besides, since three of the five "comparison" pieces come from his prior cases. It is propensity evidence wearing an expert\'s coat, and neither half of that is admissible.',
      rulingReactions: {
        ADMITTED: [
          { speaker: 'DEFENSE', text: 'The defense renews its objection in the strongest terms, Your Honor. The record will reflect that three of those five photographs are Mr. Navarro\'s past, offered as his present.' },
          { speaker: 'PROSECUTION', text: 'The People will confine the memo to the letterforms, Your Honor, as the court directs.' },
        ],
        EXCLUDED: [
          { speaker: 'PROSECUTION', text: 'The People note their exception and will proceed on the footage and the kit, Your Honor.' },
          { speaker: 'CLERK', text: 'The letterform comparison memo is withdrawn from the exhibit list.' },
        ],
      },
      rulingOptions: [
        { choice: 'ADMITTED', lineText: 'The officer may describe what ten years of photographs show, and the defense may cross on every stroke of it. Admitted, with its limits.' },
        { choice: 'ADMITTED', lineText: 'The court will hear the comparison for what it is — observation, not science. Admitted.' },
        { choice: 'EXCLUDED', lineText: 'An untrained eye offering a match, built on the defendant\'s own priors — this is propensity evidence in an expert\'s coat, and the court will not hear it. Excluded.' },
        { choice: 'EXCLUDED', lineText: 'The motion is granted. The memo is excluded, and the People will prove identity some other way.' },
      ],
    },
  ],
  // [LLM-FILL: CasePayload] — dry synopsis + the People's spoken statement.
  summary: 'The People charge Eli Navarro, 34, with one count of misdemeanor vandalism (Cal. Penal Code § 594(a)). The complaint alleges that he defaced the City of San Rafano\'s retaining wall at the Fourth Street underpass with spray-painted graffiti, causing $380 in damage to a surface repainted by the city in March. Navarro is employed as a sign painter. He has four prior convictions for vandalism offenses, including one felony. The matter comes before the court for arraignment and plea.',
  statementOfFacts: 'Your Honor, the People\'s statement of the case — and the People will keep it brief, because the case is brief. In March the city repainted the Fourth Street retaining wall. In June, between 1:10 and 1:40 in the morning, someone put a two-tone piece reading "HALO" across it — four-foot letters, $380 in damage, twenty dollars under the felony line. A city camera watched the whole thing happen; it never saw a face. The next day, paint matching the wall and a sketchbook full of the same four letters were recovered from the defendant\'s work van. The People will prove the wall was defaced, that it was done maliciously, and that the hand that did it belongs to the man who has signed this district\'s walls "HALO" for ten years.',
  closingArguments: {
    prosecution: 'The court has seen the piece painted, seen the paint in the van, and seen the same four letters rehearsed thirty ways in the defendant\'s own book. The defense will say no one saw a face, and that is true — it is the only true gap in the People\'s case, and the People ask the court to measure how small it is. A man paints that wall the way Mr. Navarro paints everything: planned, practiced, left to right without a wasted stroke. The wall was the city\'s. The hand was his. The People ask for a conviction on the single count.',
    defense: 'Everything the People offered proves that Eli Navarro is a letter-painter — which the defense told the court on the first day. The footage shows a hood, not a face. The paint is stock enamel; the book is a working artist\'s book; his employer told the court both belong to the trade, not the crime. What remains is his record, and the court has already shown this morning that it knows the difference between a record and proof. The People had to close a gap and they closed it with who he used to be. Reasonable doubt lives in exactly that move. The defense asks for acquittal.',
  },
};

// [LLM-FILL: PleaNarrative] — an offer reaches the bench, so the full plea
// machinery is authored: both on-record rationales, the allocution, the
// reactions, and the judge's voiced options.
const rawNavarroPleaNarrative = {
  prosecutionRationale: 'Your Honor, the People\'s position on the agreement, stated plainly for the court\'s first calendar of the morning: the footage is strong, the identity evidence is circumstantial but layered, and the damage sits twenty dollars under the felony line. The offer reflects all three. Mr. Navarro pleads to the count, pays for the wall through restitution, and serves a term at the bottom of the range. The city gets its wall; the court gets its morning back. The People commend the agreement to the bench.',
  defenseRationale: 'Your Honor, Mr. Navarro has authorized me to advise the court that he accepts the People\'s offer. The defense could try the identity gap — no witness ever saw a face — but my client\'s record would follow him into that courtroom, and with a prison prior a loss means the top of the range instead of the bottom. The agreement is proportionate to a repainted wall, it comes with restitution he can actually pay, and he asks the court, respectfully, to accept it.',
  allocution: 'I painted the wall, Your Honor. I\'m not going to stand in a courtroom and pretend my own letters aren\'t mine. I paint signs all day for other people and at night sometimes I want four letters that belong to me — that\'s the truest way I can say it, and I know it isn\'t a defense. Ms. Okada gave me steady work and I put her van twenty dollars from a felony. I\'ll pay for the wall. I\'d ask the court to leave me able to keep working for her, because the restitution comes out of that paycheck. That\'s all, Your Honor.',
  pleaReactions: {
    ACCEPT: [
      { speaker: 'CLERK', text: 'The plea of guilty to the single count is entered and accepted. For the record, Your Honor: the matter now proceeds directly to sentencing — no trial is held on an accepted plea.' },
      { speaker: 'DEFENSE', text: 'Thank you, Your Honor. The defense asks the court to carry the restitution arrangement and Mr. Navarro\'s steady employment into sentencing.' },
    ],
    REJECT: [
      { speaker: 'PROSECUTION', text: 'Understood, Your Honor. The People are ready — the exhibits are marked and Officer Pruitt is in the hallway.' },
      { speaker: 'CLERK', text: 'The plea is withdrawn and the matter is set for trial. For the record: the parties will now be heard on the admissibility of each of the People\'s exhibits, one at a time.' },
    ],
  },
  pleaRulingOptions: [
    { choice: 'ACCEPT', lineText: 'The court has reviewed the agreement. A bottom-of-range term, full restitution to the city, and a defendant keeping the job that pays for it — the disposition is proportionate. The plea is accepted.' },
    { choice: 'ACCEPT', lineText: 'Mr. Navarro, the agreement is fair and the court sees no reason to make this wall more expensive than it already is. The plea is accepted; we proceed to sentencing.' },
    { choice: 'REJECT', lineText: 'Four prior convictions for the same conduct, and the People price it at the bottom of the range — the court is not satisfied this disposition answers the pattern. The plea is rejected. Set the matter for trial.' },
    { choice: 'REJECT', lineText: 'The court would rather hear this case than discount it. The plea is rejected; the People will prove their case, or they will not.' },
  ],
};

// [LLM-FILL: Aftermath] — PLEA_ACCEPTED, CONVICTED, ACQUITTED; single
// charge, so no SPLIT.
const navarroAftermath = {
  PLEA_ACCEPTED:
    'The hearing took nine minutes, which the courthouse veterans called a respectable pace for a first morning. The Sentinel gave the underpass a paragraph; the comment section gave it three days, most of it arguing about whether HALO counted as blight or as the only interesting thing on that wall. The city\'s restitution invoice — $380, itemized down to the primer — was paid in four installments out of a sign-painter\'s paycheck. Ruth Okada kept Navarro on, moved the paint stock to a locked cage in the shop, and told the reporter that the best letter-painter she ever hired "finally signed something with his own name on it": the plea form. The beautification program repainted the wall in a fresh anti-graffiti coating, same as March. In the courthouse, the clerks noted that the new judge read every page before signing. It was meant, and taken, as a compliment.',
  CONVICTED:
    'The verdict landed quietly — a misdemeanor conviction two blocks from the wall it concerned. The Sentinel noted that the new judge\'s first trial verdict turned on the exhibits the court chose to admit, which is, the courthouse veterans observed, what verdicts are supposed to turn on. Officer Pruitt, twenty-two years on the beat, declined to celebrate: "I like Eli. I just like the wall too." The city collected its $380 through the judgment; Ruth Okada kept Navarro on and drove him to his community-service hours herself the first weekend. The wall was repainted within the month. Somebody tagged the fresh coat within two — different letters, different hand — and the underpass camera watched it happen, unblinking, the way it watches everything.',
  ACQUITTED:
    'Not guilty, on a record the court had thinned exhibit by exhibit, and the People\'s office accepted it in a two-line statement that noted, without quite saying so, that no one ever saw a face. The Sentinel\'s courthouse reporter called it a tidy first trial for the new judge: rulings on the record, reasons with each one, and a verdict that followed the evidence that survived. Officer Pruitt shrugged on the courthouse steps — "the wall\'s still painted, and I still know what I know" — and went back to the beat. The city repainted, again. Ruth Okada put Navarro on the beautification program\'s subcontract the following spring, painting over other people\'s tags at municipal rates, which everyone involved agreed was either irony or rehabilitation, depending on the comment section.',
};

export const navarroCase = defineDemoCase({
  title: 'People v. Eli Navarro',
  teaser: 'Your first morning on the bench: a tagged city wall, $380 in damage, and every ruling explained as you go.',
  payload: rawNavarroPayload,
  pleaNarrative: rawNavarroPleaNarrative,
  aftermath: navarroAftermath,
  tutorial: {
    decisionExplainers: {
      CONTINUE:
        'The court record unfolds one statement at a time — every line is spoken by someone in the room. Continue when you are ready, and click any transcript line that presents an item to inspect it.',
      PLEA_RULING:
        'Your first ruling. Accept the negotiated plea and the case moves straight to sentencing; reject it and the matter goes to trial. Each button is a line you will actually speak from the bench.',
      MOTION_RULING:
        'Exhibits are ruled on one at a time. What you admit strengthens the People\'s case at sentencing; what you exclude is gone for good.',
      CHARGE_VERDICT:
        'Verdicts are entered one charge at a time, on the record you shaped — weigh only what was admitted and said in this room.',
      SENTENCING:
        'Set the sentence anywhere inside the statutory range. The probation notes and the weight of the admitted evidence are context, never constraints.',
    },
  },
});
