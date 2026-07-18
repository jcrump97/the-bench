import { defineDemoCase } from './types';

// People v. Curtis Boone — Second-Degree Commercial Burglary (PC § 459).
// Tuned WEAK (score ~33: element coverage 1/2, HIGH objection risk on the
// People's best exhibits, a 4-credibility eyewitness), so assessProsecution
// bands WEAK and buildPleaPosture yields NO_OFFER — the docket's trial-only
// case, exercising the offer-less plea-ruling path (no ACCEPT option
// exists). The moral texture is the mirror of Webb: not "did a good man do it" but "can the
// People prove the obvious suspect is the right one." Boone is the fired
// employee everyone recognized in the rain — which is exactly why the
// identification is worth less than it looks.
const rawBoonePayload = {
  // [LLM-FILL: CasePayload] — caseId is assigned by the pipeline's final
  // assembly call (with `summary`, below) once the four stages complete.
  caseId: '24-CR-01102',
  // [LLM-FILL: CharacterGen] — the whole defendant block. On a WEAK case the
  // defense assessment never runs (no offer exists to weigh), so the traits
  // and prior read as pure characterization here — but CharacterGen cannot
  // know the band in advance, so it must still author them honestly.
  defendant: {
    firstName: 'Curtis',
    lastName: 'Boone',
    age: 29,
    demographics: {
      relationshipStatus: 'SINGLE',
      children: 0,
      employmentStatus: 'UNEMPLOYED',
      educationLevel: 'HIGH_SCHOOL',
      substanceAbuseHistory: [],
    },
    pastConvictions: [
      {
        chargeName: 'Vandalism (Cal. Penal Code § 594)',
        year: 2015,
        sentences: [{ type: 'COMMUNITY_SERVICE', unit: 'HOURS', amount: 120 }],
      },
    ],
    oceanTraits: {
      openness: 6,
      conscientiousness: 5,
      extraversion: 3,
      agreeableness: 4,
      neuroticism: 6,
    },
  },
  // [LLM-FILL: EnvironmentGen] — scene enums plus the narrative description.
  environment: {
    locationType: 'COMMERCIAL',
    timeOfDay: 'NIGHT',
    weather: 'RAIN',
    description: 'QuickCoin Check Cashing, a storefront wedged between a laundromat and a vape shop on El Camino Real. The rear door opens onto a service alley with one working light. Inside, a single camera watches the counter — and misses the back hallway entirely, a blind spot the owner never disclosed to anyone but staff.',
  },
  // [LLM-FILL: StatuteSelection] — charges (with elements and per-charge
  // statutory ranges) and statuteContexts. No mandatory minimum here: the
  // exposure floor is the picker's own lower bound, a range shape the
  // pipeline must also be able to produce.
  charges: [
    {
      id: 'charge-burglary-2',
      name: 'Second-Degree Commercial Burglary (Cal. Penal Code § 459)',
      classification: 'FELONY',
      elements: [
        { id: 'elem-entry', description: 'Defendant entered a commercial building.' },
        { id: 'elem-burg-intent', description: 'When entering, defendant intended to commit theft inside.' },
      ],
      mandatoryMinimums: [],
      maximumPenalties: [{ type: 'JAIL', unit: 'YEARS', amount: 3 }],
      verdictReactions: {
        GUILTY: [
          { speaker: 'DEFENSE', text: 'The defense notes its exception for the record, Your Honor, and asks the court to consider Mr. Boone\'s single prior at sentencing.' },
          { speaker: 'PROSECUTION', text: 'The People thank the court. QuickCoin has been waiting a long time to hear that.' },
        ],
        NOT_GUILTY: [
          { speaker: 'PROSECUTION', text: 'The People accept the verdict, Your Honor. The register is still short $2,300.' },
          { speaker: 'DEFENSE', text: 'Mr. Boone is free to go. The defense thanks the court.' },
        ],
      },
      verdictOptions: [
        { choice: 'GUILTY', lineText: 'Taken together, the identification, the physical evidence, and the defendant\'s access to the blind spot prove the People\'s case beyond a reasonable doubt. Guilty.' },
        { choice: 'GUILTY', lineText: 'No single thread was strong alone, but together they only fit one man. On the charge of second-degree burglary, the court finds the defendant guilty.' },
        { choice: 'NOT_GUILTY', lineText: 'A common shoe, an unconnected tool, and a witness who is only pretty sure do not add up to proof beyond a reasonable doubt. Not guilty.' },
        { choice: 'NOT_GUILTY', lineText: 'Four people knew the blind spot and only one was ever asked about it. That is not how this court convicts. Not guilty.' },
      ],
    },
  ],
  statuteContexts: [
    'Cal. Penal Code § 459 — burglary: entry into a building with intent to commit theft or any felony; second degree when the building is not an inhabited dwelling (§ 460(b)).',
  ],
  // [LLM-FILL: EvidenceGen] — witnesses and evidence. The structured scores
  // are tuned so the People's case underperforms: their best exhibits carry
  // HIGH objection risk and nothing at all targets the intent element.
  witnesses: [
    {
      id: 'wit-eyewitness',
      name: 'Marta Voss',
      role: 'EYEWITNESS',
      bias: 'PROSECUTION',
      statement: 'Was waiting out the rain under the laundromat awning across the street when she saw a figure working the rear-alley door of QuickCoin. Picked Boone from a photo array nine days later — she knows his face, because he cashed her checks for two years. Will testify she is "pretty sure." The defense will ask how far "pretty sure" carries at night, in rain, across four lanes, and whether she recognized the burglar or simply recognized Boone.',
      credibilityScore: 4,
      directExamination: 'I was under the laundromat awning waiting out the rain, and I saw a man working at the back door of QuickCoin — crouched at the lock, then inside. When the detective showed me the photos I picked Curtis right away. I know that face. He cashed my checks every other Friday for two years. I\'m pretty sure it was him.',
      crossExamination: 'It was about one in the morning, yes. Raining, yes. Across four lanes of El Camino — I don\'t know the feet. The alley light was... there\'s one light. No, I couldn\'t see his face the whole time, mostly the side and the back. I said pretty sure because that\'s what I am. You can say it back to me as many times as you like, counselor. Pretty sure is pretty sure.',
    },
    {
      id: 'wit-owner',
      name: 'Sam Herrera',
      role: 'VICTIM',
      bias: 'PROSECUTION',
      statement: 'Owner of QuickCoin. Will testify that $2,300 and the spare cash box were gone by morning, that whoever entered walked straight through the camera\'s blind spot without a wasted step, and that he fired Boone two months earlier over a till-count dispute — a dispute Boone himself had flagged. Will concede on cross that at least four current and former employees knew that blind spot as well as Boone did.',
      credibilityScore: 5,
      directExamination: 'By morning the register cash and the spare box were gone — $2,300. And here\'s the thing that put my stomach on the floor: whoever came through that back door walked the one path my camera can\'t see. Not wandering, not searching. Straight through the blind spot like they\'d walked it a hundred times. I fired Curtis Boone two months before, over a till count. He knew that hallway with the lights off.',
      crossExamination: 'The till dispute — yes, Curtis is the one who flagged the count being off in the first place. I fired him anyway; I couldn\'t make the numbers say who. How many people know the blind spot? Me, my two current tellers, and... former staff. Four people, maybe five, counting Curtis. Yes, counselor, that means at least four people who aren\'t sitting at that table knew it too. I know how that sounds.',
    },
    {
      id: 'wit-sister',
      name: 'Tasha Boone',
      role: 'CHARACTER',
      bias: 'DEFENSE',
      statement: 'Defendant\'s older sister. Will testify Curtis was asleep on her couch across town when the alarm company logged the door at 1:52 a.m., that he had been there most nights since losing his job, and that he does not own the sneakers the print came from. She is his sister, and the jury will be told to weigh that.',
      credibilityScore: 6,
      directExamination: 'Curtis was on my couch. He\'d been on my couch most nights since Herrera let him go — he\'d watch TV with the sound off so he wouldn\'t wake my kids, and he was there when I went to bed and there when my alarm went off at six. The night they\'re talking about was no different. And those Meridian trainers everybody keeps holding up? My brother wears the same two pairs of work boots he\'s owned for three years. I do his laundry. I\'d know.',
      crossExamination: 'No, I didn\'t sit up and watch him sleep. I went to bed around midnight and my door was closed. Could he have left and come back without me hearing — I suppose a person could, but you\'re asking me to imagine it, and I\'m telling you what I know. Yes, he\'s my brother. That\'s not a reason to lie. It\'s the reason I know what shoes he owns.',
    },
  ],
  evidence: [
    {
      id: 'ev-lineup',
      name: 'Photo array identification',
      type: 'DOCUMENTARY',
      description: 'Six-pack photo identification made nine days after the burglary; the witness picked Boone in eleven seconds. Boone\'s photo was pulled from the store\'s own staff-page archive.',
      relevanceScore: 6,
      objectionRisk: 'HIGH',
      targetElementId: 'elem-entry',
      prosecutionArgument: 'The People offer the photo array identification. Nine days after the burglary, Ms. Voss picked the defendant out of a six-pack in eleven seconds — a face she\'d seen across a counter every other week for two years. The identification was administered by a detective with no connection to the case.',
      defenseObjection: 'The defense moves to suppress, Your Honor. Look at the array: Mr. Boone\'s photo was pulled from QuickCoin\'s own staff page, and his is the only picture in the six where the man is wearing a QuickCoin uniform shirt. That is not an identification, it is a multiple-choice question with one answer in bold. Eleven seconds proves the suggestion worked, not that the memory was real.',
      rulingReactions: {
        ADMITTED: [
          { speaker: 'PROSECUTION', text: 'Thank you, Your Honor. Ms. Voss knew that face across a counter for two years — the jury is entitled to hear it.' },
          { speaker: 'DEFENSE', text: 'The defense\'s objection stands for the record. We will be asking Ms. Voss about that uniform shirt at length.' },
        ],
        EXCLUDED: [
          { speaker: 'DEFENSE', text: 'The defense thanks the court. That array should never have left the detective\'s desk.' },
          { speaker: 'CLERK', text: 'The photo array is withdrawn from the exhibit list.' },
        ],
      },
      rulingOptions: [
        { choice: 'ADMITTED', lineText: 'A two-year customer relationship is a legitimate basis for recognition, and the composition of the array goes to weight. The identification is admitted.' },
        { choice: 'ADMITTED', lineText: 'The court has looked at the array and will let the jury look at it too, uniform shirt and all. Admitted.' },
        { choice: 'EXCLUDED', lineText: 'A six-pack where one photo alone shows the store\'s uniform is not an identification procedure; it is a suggestion dressed as one. Excluded.' },
        { choice: 'EXCLUDED', lineText: 'The suggestiveness here is not a matter for cross-examination to cure. The motion to suppress is granted.' },
      ],
    },
    {
      id: 'ev-shoeprint',
      name: 'Partial shoe print cast',
      type: 'FORENSIC',
      description: 'Tread cast from the mud inside the rear door: a size-10 Meridian trainer, one of the most common shoes sold in the county. Boone wears a size 10.',
      relevanceScore: 4,
      objectionRisk: 'HIGH',
      targetElementId: 'elem-entry',
      prosecutionArgument: 'The People offer the tread cast lifted from the mud inside the rear door: a size-10 Meridian trainer. The defendant wears a size 10. It places a matching shoe inside the point of entry on the night of the burglary.',
      defenseObjection: 'Objection — relevance dressed up as forensics. The Meridian is one of the most common shoes sold in this county, and size 10 fits roughly one man in eight. The People are offering the court a shoe that fits a hundred thousand people, none of whom have been shown to be my client, who does not own a pair.',
      rulingReactions: {
        ADMITTED: [
          { speaker: 'PROSECUTION', text: 'The People appreciate the ruling. It is a small piece, Your Honor, and we will not overstate it.' },
          { speaker: 'DEFENSE', text: 'Noted. The jury will hear how many size-10 feet walk this county every day.' },
        ],
        EXCLUDED: [
          { speaker: 'CLERK', text: 'The shoe print cast is withdrawn from the exhibit list.' },
          { speaker: 'PROSECUTION', text: 'The People will proceed without it, Your Honor.' },
        ],
      },
      rulingOptions: [
        { choice: 'ADMITTED', lineText: 'A common shoe is still relevant, however modestly. The weight of the evidence is for the jury to decide. Admitted.' },
        { choice: 'ADMITTED', lineText: 'The court will let it in for whatever it is worth, and counsel is free to argue it is worth very little.' },
        { choice: 'EXCLUDED', lineText: 'A shoe worn by one man in eight tells this court nothing about which one. Excluded.' },
        { choice: 'EXCLUDED', lineText: 'The probative value here does not clear the bar. The shoe print cast is excluded.' },
      ],
    },
    {
      id: 'ev-prybar',
      name: 'Recovered pry bar',
      type: 'PHYSICAL',
      description: 'A pry bar recovered from a dumpster two blocks north, consistent with the tool marks on the rear door. No fingerprints, no DNA, no purchase record — nothing connecting it to Boone beyond its distance from a bus stop he sometimes used.',
      relevanceScore: 5,
      objectionRisk: 'MEDIUM',
      targetElementId: null,
      prosecutionArgument: 'The People offer the pry bar recovered from a dumpster two blocks north of QuickCoin. The tool-mark examiner will say it is consistent with the marks on the rear door. It is the instrument of the entry, discarded on the natural walking route away from the scene.',
      defenseObjection: 'Objection — foundation, Your Honor. No prints, no DNA, no purchase record, no witness. The People\'s entire connection is that the dumpster is near a bus stop my client has used, which describes half the neighborhood. "Consistent with the tool marks" means consistent with every pry bar in every garage in this county.',
      rulingReactions: {
        ADMITTED: [
          { speaker: 'DEFENSE', text: 'The defense renews its objection for the record. A pry bar with no fingerprints on it is not evidence of who held it.' },
          { speaker: 'PROSECUTION', text: 'The exhibit speaks for itself, counsel — the marks and the distance from the door.' },
        ],
        EXCLUDED: [
          { speaker: 'CLERK', text: 'The pry bar is withdrawn from the exhibit list.' },
          { speaker: 'DEFENSE', text: 'The defense is grateful, Your Honor. That tool was never tied to anyone.' },
        ],
      },
      rulingOptions: [
        { choice: 'ADMITTED', lineText: 'The tool-mark consistency and the location of recovery are enough to clear foundation, thin as they are. Admitted.' },
        { choice: 'ADMITTED', lineText: 'The court will admit it, and the absence of prints or DNA is a matter for cross-examination, not exclusion.' },
        { choice: 'EXCLUDED', lineText: 'An object with no fingerprints, no DNA, and no purchase history connects to no one in particular. Excluded.' },
        { choice: 'EXCLUDED', lineText: 'This exhibit lacks the foundation to tie it to the defendant. The pry bar is excluded.' },
      ],
    },
    {
      id: 'ev-cellsite',
      name: 'Cell-site location records',
      type: 'DIGITAL',
      description: 'Carrier records placing Boone\'s phone inside a three-quarter-mile sector that includes QuickCoin between 1:40 and 2:15 a.m. The same sector includes his sister\'s apartment, where he says he was sleeping.',
      relevanceScore: 5,
      objectionRisk: 'HIGH',
      targetElementId: null,
      prosecutionArgument: 'The People offer the carrier\'s cell-site records: the defendant\'s phone, inside the sector containing QuickCoin, from 1:40 to 2:15 in the morning — squarely bracketing the 1:52 alarm. His phone was where the burglary was, when the burglary was.',
      defenseObjection: 'Objection, and I\'d ask the court to look at the map before ruling. The sector is three-quarters of a mile wide and it contains his sister\'s apartment — the couch he sleeps on every night. This exhibit proves Curtis Boone was at home. The People are offering evidence of the defense\'s own alibi and asking the court to read it backwards.',
      rulingReactions: {
        ADMITTED: [
          { speaker: 'PROSECUTION', text: 'Thank you, Your Honor. The People will let the jury look at the same map counsel just described.' },
          { speaker: 'DEFENSE', text: 'So will the defense — the same sector that puts him on the couch.' },
        ],
        EXCLUDED: [
          { speaker: 'CLERK', text: 'The cell-site records are withdrawn from the exhibit list.' },
          { speaker: 'PROSECUTION', text: 'The People note their exception, Your Honor.' },
        ],
      },
      rulingOptions: [
        { choice: 'ADMITTED', lineText: 'A three-quarter-mile sector is imprecise, but imprecision goes to weight. The cell-site records are admitted.' },
        { choice: 'ADMITTED', lineText: 'The jury may draw its own conclusions from a sector that includes both the scene and the alibi. Admitted.' },
        { choice: 'EXCLUDED', lineText: 'A sector wide enough to include the defendant\'s own alibi location proves nothing about where he actually was. Excluded.' },
        { choice: 'EXCLUDED', lineText: 'This exhibit is equally consistent with the defense\'s account as with the prosecution\'s. Excluded.' },
      ],
    },
  ],
  // [LLM-FILL: CasePayload] — the case-opening summary, written by the final
  // assembly call with all four stage outputs in context.
  summary: 'Someone came through the rear door of QuickCoin Check Cashing at 1:52 a.m. in the rain, walked the one path the camera cannot see, and left with $2,300 and the spare cash box. Nine days later a woman who waited out the storm across the street picked Curtis Boone out of a photo array — Boone, who cashed her checks for two years, and whom the owner fired two months ago over a till dispute Boone himself had reported. The People have a common shoe print, a pry bar no one can connect to anyone, a phone that was somewhere in the neighborhood where Boone also happens to live, and a witness who is pretty sure. Boone has a sister who says he was on her couch, no job since the firing, and one act of vandalism from when he was twenty. Four other people knew the blind spot. One of them got charged.',
  // [LLM-FILL: CasePayload] — closing arguments, written by the final
  // assembly call once the evidence and witness stages are complete.
  closingArguments: {
    prosecution: 'Strip away the noise and ask one question: who walks the blind spot without a wasted step? Not a stranger. Someone who counted that till, closed that store, knew where the camera stops seeing. Curtis Boone was fired from that knowledge two months before someone used it. A woman who knew his face for two years picked him in eleven seconds. His phone sat in the sector while the door came open. His size came out of the mud inside it. Any one thread, alone, you could cut. Together they only fit one man, and he\'s the one who had a reason to come back angry.',
    defense: 'The People built this case backwards: they started with the obvious suspect and went looking for things that don\'t rule him out. A shoe one man in eight wears. A phone sleeping in the same sector as its owner\'s couch. A pry bar connected to nothing and no one. An identification made across four lanes, at night, in the rain, by a witness who didn\'t recognize the burglar — she recognized Curtis, the man from the counter, in the only photo wearing the store\'s own shirt. And the four other people who knew that blind spot? Never asked a single question. Pretty sure isn\'t proof beyond a reasonable doubt. It isn\'t even close.',
  },
};

// [LLM-FILL: PleaNarrative] — WEAK band: the prosecution declines to bargain,
// so there is no defenseRationale at all (PleaPostureInput and defineDemoCase
// both enforce its absence on a NO_OFFER case).
const rawBoonePleaNarrative = {
  prosecutionRationale: 'This office does not discount commercial burglary, and I am not going to start with a man who cleaned out a register he used to count. Boone knew the blind spot, the witness knows Boone, and his phone was in the sector. I know what the defense will do to the array, and I know what "pretty sure" sounds like on cross. It does not matter. You don\'t offer paper to the obvious suspect because the proof got wet. If the case is as thin as they say, let twelve people say so.',
};

// [LLM-FILL: Aftermath] — CONVICTED and ACQUITTED only: with NO_OFFER the
// plea branch is unreachable, and defineDemoCase rejects a PLEA_ACCEPTED
// variant that could never be shown.
const booneAftermath = {
  CONVICTED:
    'The Sentinel\'s courthouse reporter counted the evidence in one paragraph and the conviction in the next, and let the arithmetic sit there. Sam Herrera got his insurance payout and put the camera where the blind spot used to be. Marta Voss told the paper she had never wavered — "I know that face" — and declined to say anything about the sixty-three feet a defense paralegal had measured from the awning to the door, a number the jury heard twice and apparently forgave. Tasha Boone stopped talking to reporters after the verdict; her last comment was that her couch cushions apparently count for less than a rainy window. An appellate clinic took the file inside a month, flagging the uniform shirt in the photo array. The other three people who knew the blind spot were never asked where they were that night. In the county\'s eyes the case is closed; the cash box has still never turned up.',
  ACQUITTED:
    'It took the jury five hours, most of it — a juror later told the Sentinel — spent passing the array photos around the table. Not guilty, and Curtis Boone exhaled like a man surfacing. What the verdict did not give back: the job he had already lost, the two months of hearings, or any account of who did come through that door. Sam Herrera\'s insurer denied the claim pending an "unresolved loss event," and QuickCoin now closes at dark. Marta Voss stands by what she saw; she also stopped cashing her checks there. The detective\'s file stays open with no other names in it, which Boone\'s lawyer calls the quiet scandal of the whole affair: four people knew the blind spot, one got charged, and when the charge fell apart nobody went looking at the other three. Boone moved in with his sister for good. He sleeps on the couch.',
};

export const booneCase = defineDemoCase({
  title: 'People v. Curtis Boone',
  teaser: 'A rainy-night break-in, a forty-foot identification, and no offer on the table.',
  payload: rawBoonePayload,
  pleaNarrative: rawBoonePleaNarrative,
  aftermath: booneAftermath,
});
