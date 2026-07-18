import { defineDemoCase } from './types';

// People v. Dominic Reyes — Assault by Means Likely to Produce Great Bodily
// Injury (PC § 245(a)(4)). Tuned STRONG (score ~67: clean video, LOW-risk
// medical records, full element coverage) with a defendant built to gamble:
// zero priors, high openness, low neuroticism. The STRONG band's 5% discount
// rounds the offer back up to the statutory maximum, offerGenerosity computes
// to 0, and assessDefense REJECTs — the docket's REJECTED_BY_DEFENSE case,
// exercising PleaOfferForm's rejected-offer state (offer terms shown, trial
// forced). The texture: the tape shows everything except what started it.
const rawReyesPayload = {
  // [LLM-FILL: CasePayload] — caseId is assigned by the pipeline's final
  // assembly call (with `summary`, below) once the four stages complete.
  caseId: '24-CR-01388',
  // [LLM-FILL: CharacterGen] — the whole defendant block. This is the stage
  // that decides the Act 1 branch here: a clean record and a gambler's
  // temperament make the defense reject an offer anyone cautious would take.
  defendant: {
    firstName: 'Dominic',
    lastName: 'Reyes',
    age: 26,
    demographics: {
      relationshipStatus: 'SINGLE',
      children: 0,
      employmentStatus: 'EMPLOYED',
      educationLevel: 'HIGH_SCHOOL',
      substanceAbuseHistory: [],
    },
    pastConvictions: [],
    oceanTraits: {
      openness: 9,
      conscientiousness: 4,
      extraversion: 8,
      agreeableness: 3,
      neuroticism: 2,
    },
  },
  // [LLM-FILL: EnvironmentGen] — scene enums plus the narrative description.
  environment: {
    locationType: 'COMMERCIAL',
    timeOfDay: 'NIGHT',
    weather: 'CLEAR',
    description: 'The parking lot of the Golden Spur, a country-and-cover-band bar off Route 9. One floodlit exit, one exterior camera aimed straight down the walkway, and a curb painted red where the walkway meets the asphalt. Whatever happened inside happened past the interior camera\'s shoulder; whatever happened outside is in high definition.',
  },
  // [LLM-FILL: StatuteSelection] — charges (with elements and per-charge
  // statutory ranges) and statuteContexts. The 2-year mandatory floor and
  // 4-year ceiling leave the STRONG-band offer with nowhere to discount to.
  charges: [
    {
      id: 'charge-assault-gbi',
      name: 'Assault by Means Likely to Produce Great Bodily Injury (Cal. Penal Code § 245(a)(4))',
      classification: 'FELONY',
      elements: [
        { id: 'elem-act', description: 'Defendant willfully performed an act that by its nature would directly and probably result in the application of force to a person.' },
        { id: 'elem-gbi', description: 'The force used was likely to produce great bodily injury.' },
        { id: 'elem-aware', description: 'Defendant was aware of facts that would lead a reasonable person to realize the act would directly and probably result in force being applied.' },
      ],
      mandatoryMinimums: [{ type: 'PRISON', unit: 'YEARS', amount: 2 }],
      maximumPenalties: [
        { type: 'PRISON', unit: 'YEARS', amount: 4 },
        { type: 'FINE', unit: 'DOLLARS', amount: 10000 },
      ],
      verdictReactions: {
        GUILTY: [
          { speaker: 'DEFENSE', text: 'The defense notes its exception for the record, Your Honor, and asks the court to weigh Mr. Reyes\'s clean record at sentencing.' },
          { speaker: 'PROSECUTION', text: 'The People thank the court. Mr. Merritt\'s family has waited a long time to hear that.' },
        ],
        NOT_GUILTY: [
          { speaker: 'PROSECUTION', text: 'The People accept the verdict, Your Honor, though Mr. Merritt is still in speech therapy tonight.' },
          { speaker: 'DEFENSE', text: 'Mr. Reyes is free to go. The defense thanks the court.' },
        ],
      },
      verdictOptions: [
        { choice: 'GUILTY', lineText: 'A trained fighter is charged with knowing what his hands are, and the tape shows him choosing to stand and throw. On the charge of assault by means likely to produce great bodily injury, guilty.' },
        { choice: 'GUILTY', lineText: 'Whatever happened in that hallway, it did not follow Mr. Merritt into the parking lot with its fists up. Guilty.' },
        { choice: 'NOT_GUILTY', lineText: 'The People\'s own tape begins four seconds too late to rule out self-defense, and that gap is reasonable doubt. Not guilty.' },
        { choice: 'NOT_GUILTY', lineText: 'A man advancing on a defendant and his sister, met with a single blow, does not prove unlawful force beyond a reasonable doubt. Not guilty.' },
      ],
    },
  ],
  statuteContexts: [
    'Cal. Penal Code § 245(a)(4) — assault upon another person by any means of force likely to produce great bodily injury.',
  ],
  // [LLM-FILL: EvidenceGen] — witnesses and evidence. Tuned the opposite way
  // from a weak case: LOW objection risk on the pillars, every element
  // covered, and the neutral witnesses cutting in different directions.
  witnesses: [
    {
      id: 'wit-friend',
      name: 'Kyle Merritt Jr.',
      role: 'EYEWITNESS',
      bias: 'PROSECUTION',
      statement: 'The victim\'s cousin, ten feet behind him at the exit. Will testify Reyes was waiting under the floodlight, said something none of them caught, and threw one punch — and that Kyle Sr. never raised a hand. Will concede he was inside during whatever happened by the restrooms, and that his uncle "runs his mouth when he drinks" — a phrase the defense intends to repeat until the jury can say it with him.',
      credibilityScore: 7,
      directExamination: 'I was maybe ten feet behind my uncle coming out. Reyes was already there, under the floodlight, like he was waiting on us. He said something — I didn\'t catch it — and then it was one punch and Kyle was on the ground not moving. My uncle never raised a hand. I want that to be clear. He never got the chance to raise a hand.',
      crossExamination: 'I was inside when whatever happened by the restrooms happened, yeah. I didn\'t see any of that. And yes — I\'ve said it before, my uncle runs his mouth when he drinks. He\'d had a few. But running your mouth isn\'t a shove, and I was looking right at them, and I didn\'t see my uncle touch him.',
    },
    {
      id: 'wit-physician',
      name: 'Dr. Amara Okafor',
      role: 'EXPERT',
      bias: 'NEUTRAL',
      statement: 'Trauma physician who treated the victim. Will testify to a depressed skull fracture and a subdural bleed consistent with the back of the head striking concrete after a single high-force blow; three days in the ICU, cognitive testing still pending. On the mechanics she is unshakable. On who started it she has, by design, nothing to say.',
      credibilityScore: 9,
      directExamination: 'Mr. Merritt presented with a depressed skull fracture and a subdural hematoma. The injury pattern is consistent with the back of the head striking concrete after a single high-force blow to the face — the punch starts the mechanism, the pavement finishes it. He spent three days in intensive care. His cognitive testing is still pending, which is a sentence I\'d ask the court not to hear as routine. Force of this kind is, in my clinical experience, absolutely capable of killing.',
      crossExamination: 'Correct — I can speak to the mechanism, not the sequence of events. My findings are identical whether the first move in that parking lot was the defendant\'s or the victim\'s. Could a single unlucky fall produce this? A fall doesn\'t throw the punch, counselor, but yes: the catastrophic component here is the concrete, and no one chooses where a man lands. That is precisely why I don\'t editorialize about intent.',
    },
    {
      id: 'wit-bouncer',
      name: 'Ollie Brandt',
      role: 'EYEWITNESS',
      bias: 'NEUTRAL',
      statement: 'Door security that night. Will testify he separated Merritt from Reyes\'s sister near the restrooms twenty minutes earlier — Merritt leaning in, her backing up — and that he told Merritt to close out his tab. Did not see a shove and did not see the punch; he was walking Merritt\'s group out when it happened. The People call his account context. The defense calls it the first chapter the video doesn\'t show.',
      credibilityScore: 8,
      directExamination: 'About twenty minutes before it happened outside, I separated Mr. Merritt from a young woman near the restrooms — him leaning in, arm up on the wall, her backing away. Standard stuff, unfortunately. I told him he was done and to close out his tab. I was walking his group out when the thing in the lot happened, so no — I didn\'t see the punch, and I didn\'t see any shove before it. I saw the before, not the during.',
      crossExamination: 'How did she look when I stepped in? Cornered. That\'s the honest word. Was Merritt aggressive with me? Mouthy, not swinging. I\'ve seen worse nights end with handshakes. If you\'re asking whether the man I moved off that girl and the man on the pavement are hard to hold in my head at the same time — no, counselor. In this job you learn they\'re usually the same man.',
    },
    {
      id: 'wit-sister',
      name: 'Elena Reyes',
      role: 'CHARACTER',
      bias: 'DEFENSE',
      statement: 'Defendant\'s younger sister. Will testify Merritt followed her from the bar to the restroom hallway twice, that she texted Dominic "come get me" at 11:42, and that outside Merritt shoved Dominic first — a shove she describes to the inch and the video, which begins mid-swing, does not capture. She has told the story the same way every time. She is also the reason her brother was there.',
      credibilityScore: 5,
      directExamination: 'He followed me from the bar to the restroom hallway twice. The second time the bouncer pulled him off and I texted my brother: "come get me," 11:42, it\'s in the phone. Outside, Dominic put himself between us and told me to get in the car. Merritt came at him and shoved him — two hands, chest, hard enough that Dominic\'s heel hit the curb stop. Then Merritt stepped in again and Dominic swung once. I was six feet away. I have told this exactly the same way since that night, because it happened exactly one way.',
      crossExamination: 'Yes, he\'s my brother, and yes, he was there because I asked him to come. You can keep saying that. It doesn\'t change where I was standing. The video starts four seconds too late for the shove — I can\'t help where their camera points. I know what two hands on my brother\'s chest looks like. I was closer to it than anyone who\'s testified in this room.',
    },
  ],
  evidence: [
    {
      id: 'ev-lot-video',
      name: 'Exterior camera footage',
      type: 'DIGITAL',
      description: 'Fourteen seconds in high definition: Reyes stationary by the exit, Merritt walking toward him, one left hand rising — then Merritt on the pavement, not moving. The frame is tight on the walkway; both men enter it already mid-stride, four seconds before the blow. The recording is authenticated, time-stamped, and starts too late.',
      relevanceScore: 9,
      objectionRisk: 'LOW',
      targetElementId: 'elem-act',
      prosecutionArgument: 'The People offer the exterior camera footage: fourteen seconds, high definition, authenticated and time-stamped. The court will see the defendant stationary at the exit, the victim walking toward him, one blow, and a man on the pavement who does not move again. It is the act itself, on film.',
      defenseObjection: null,
      rulingReactions: {
        ADMITTED: [
          { speaker: 'PROSECUTION', text: 'Thank you, Your Honor. The People will let the tape speak for the fourteen seconds it has.' },
          { speaker: 'DEFENSE', text: 'And the defense will spend its time on the four seconds the tape doesn\'t have.' },
        ],
        EXCLUDED: [
          { speaker: 'CLERK', text: 'The exterior camera footage is withdrawn from the exhibit list.' },
          { speaker: 'PROSECUTION', text: 'The People note their exception for the record, Your Honor.' },
        ],
      },
      rulingOptions: [
        { choice: 'ADMITTED', lineText: 'The footage is authenticated and time-stamped, and no objection has been raised to it. Admitted.' },
        { choice: 'ADMITTED', lineText: 'Fourteen seconds of the incident itself is precisely what a finder of fact should see. Admitted.' },
        { choice: 'EXCLUDED', lineText: 'The court notes no objection was raised, but will exclude this exhibit on its own initiative — a recording that begins four seconds late cannot stand in for the whole encounter. Excluded.' },
        { choice: 'EXCLUDED', lineText: 'The court will not admit a partial frame as if it were the complete event. Excluded.' },
      ],
    },
    {
      id: 'ev-medical',
      name: 'Emergency department records and CT imaging',
      type: 'DOCUMENTARY',
      description: 'Certified records documenting a depressed skull fracture, subdural hematoma, and a three-day ICU admission. The imaging exhibits are the People\'s answer to "it was one punch": this is what one punch from a trained fighter onto a painted curb does.',
      relevanceScore: 8,
      objectionRisk: 'LOW',
      targetElementId: 'elem-gbi',
      prosecutionArgument: 'The People offer Mr. Merritt\'s certified emergency records and CT imaging: a depressed skull fracture, a subdural bleed, three days in intensive care. The defense will say "one punch," and these exhibits are the answer — this is what one punch from a trained fighter does when the pavement finishes it.',
      defenseObjection: null,
      rulingReactions: {
        ADMITTED: [
          { speaker: 'PROSECUTION', text: 'Thank you, Your Honor. The jury should know exactly what that curb did.' },
          { speaker: 'DEFENSE', text: 'The defense does not dispute the injury, Your Honor — only whose fault it was.' },
        ],
        EXCLUDED: [
          { speaker: 'CLERK', text: 'The medical records are withdrawn from the exhibit list.' },
          { speaker: 'PROSECUTION', text: 'The People note their exception, Your Honor.' },
        ],
      },
      rulingOptions: [
        { choice: 'ADMITTED', lineText: 'These are certified medical records going directly to the extent of the injury. Admitted.' },
        { choice: 'ADMITTED', lineText: 'No objection has been raised and none is warranted. The records and imaging are admitted.' },
        { choice: 'EXCLUDED', lineText: 'The court excludes this exhibit on its own initiative, finding its clinical detail more prejudicial than probative on the question before it. Excluded.' },
        { choice: 'EXCLUDED', lineText: 'The imaging will not be shown to the jury. Excluded.' },
      ],
    },
    {
      id: 'ev-texts',
      name: 'Defendant\'s text messages',
      type: 'DIGITAL',
      description: 'Messages from Reyes\'s phone that night: his sister\'s "come get me" at 11:42, his "on my way" reply, and — forty minutes after the punch — "caught him flush. he dropped."',
      relevanceScore: 7,
      objectionRisk: 'MEDIUM',
      targetElementId: 'elem-aware',
      prosecutionArgument: 'The People offer the defendant\'s own messages. Forty minutes after Mr. Merritt stopped moving, while he was in a scanner, the defendant typed: "caught him flush. he dropped." That is a fighter scoring a knockout — proof he knew exactly what his hands are and exactly what he had done with them.',
      defenseObjection: 'Objection — the People are offering three words shorn of every message around them. The same thread starts with "come get me" from his little sister and ends with him asking his coach what to do. Read whole, it is a scared twenty-six-year-old describing the worst second of his life to the closest thing he has to a father. Prejudice over probative value, Your Honor — unless it all comes in.',
      rulingReactions: {
        ADMITTED: [
          { speaker: 'DEFENSE', text: 'If the thread comes in, Your Honor, it comes in whole — the jury will read "come get me" as well as the rest.' },
          { speaker: 'PROSECUTION', text: 'The People are content to let the jury read every word, counsel.' },
        ],
        EXCLUDED: [
          { speaker: 'CLERK', text: 'The text messages are withdrawn from the exhibit list.' },
          { speaker: 'PROSECUTION', text: 'The People note their exception for the record.' },
        ],
      },
      rulingOptions: [
        { choice: 'ADMITTED', lineText: 'The thread comes in whole, not the three words the People isolated. Admitted.' },
        { choice: 'ADMITTED', lineText: 'The defendant\'s own contemporaneous words are probative regardless of how either side wishes to characterize them. Admitted, in full.' },
        { choice: 'EXCLUDED', lineText: 'Offered for one meaning out of several plausible ones, the risk of unfair prejudice outweighs the value here. Excluded.' },
        { choice: 'EXCLUDED', lineText: 'The motion is granted; the text messages are excluded.' },
      ],
    },
    {
      id: 'ev-hall-video',
      name: 'Interior hallway clip',
      type: 'DIGITAL',
      description: 'Eight seconds from the bar\'s interior camera, shoulder-height and half-blocked by a beam: Merritt and Elena Reyes in the restroom hallway, the bouncer arriving, Merritt\'s arm braced on the wall above her. No audio. It proves the twenty-minutes-earlier confrontation happened; it cannot say what was said, or who touched whom.',
      relevanceScore: 6,
      objectionRisk: 'MEDIUM',
      targetElementId: 'elem-act',
      prosecutionArgument: 'The People offer the interior hallway clip — and we offer it against the defendant. It shows him receiving his sister\'s account of this confrontation twenty minutes before the parking lot: it is why a trained fighter was waiting under that floodlight instead of driving away. It proves motive and it proves he chose the encounter.',
      defenseObjection: 'The defense objects to the People\'s framing, not the footage — this clip is the first chapter of their own story and they\'re offering it as a footnote. A man braced over a cornered young woman, a bouncer stepping in: that is the context for everything the parking-lot camera missed. If it comes in, it comes in as what it is, not as "motive."',
      rulingReactions: {
        ADMITTED: [
          { speaker: 'DEFENSE', text: 'Thank you, Your Honor. The jury will see exactly what happened in that hallway before it sees the parking lot.' },
          { speaker: 'PROSECUTION', text: 'The People stand by the label, counsel — the jury can decide what to call it.' },
        ],
        EXCLUDED: [
          { speaker: 'CLERK', text: 'The interior hallway clip is withdrawn from the exhibit list.' },
          { speaker: 'PROSECUTION', text: 'The People note their exception, Your Honor.' },
        ],
      },
      rulingOptions: [
        { choice: 'ADMITTED', lineText: 'The clip is admitted for what it shows, not for the label either side puts on it. Admitted.' },
        { choice: 'ADMITTED', lineText: 'The jury is entitled to see the twenty minutes before the parking lot. Admitted.' },
        { choice: 'EXCLUDED', lineText: 'Offered as proof of motive on a foundation this thin, the clip is more prejudicial than probative. Excluded.' },
        { choice: 'EXCLUDED', lineText: 'The motion is granted; the interior hallway clip is excluded.' },
      ],
    },
  ],
  // [LLM-FILL: CasePayload] — the case-opening summary, written by the final
  // assembly call with all four stage outputs in context.
  summary: 'Fourteen seconds of video show Dominic Reyes, 26, an amateur middleweight with no record of any kind, drop Kyle Merritt with one punch outside the Golden Spur. Merritt\'s head hit a painted curb; he spent three days in intensive care and his cognitive testing is still pending. The video does not show the twenty minutes before: Merritt following Reyes\'s sister to the restroom hallway, the bouncer stepping in, her text — "come get me" — and, per the sister, a shove from Merritt that the camera missed by four seconds. The People say a trained fighter waited under a floodlight and threw a blow he of all people knew could kill. Reyes says he came for his sister and defended himself against a bigger, drunker man. The tape, both sides agree, is devastating. They disagree about what it is devastating to.',
  // [LLM-FILL: CasePayload] — closing arguments, written by the final
  // assembly call once the evidence and witness stages are complete.
  closingArguments: {
    prosecution: 'A trained fighter is charged with knowing what his hands are. That is the whole theory, and the tape proves it twice: once when the blow lands, and once in his own words forty minutes later — "caught him flush." He wasn\'t dragged into that parking lot; he chose the floodlight and he waited. Whatever Kyle Merritt was in that hallway — and the People are not here to defend it — he walked out of that bar into the one thing deadlier than his own bad manners: a middleweight with a grievance. The hallway explains the anger. It does not license the punch. Nothing does.',
    defense: 'Dominic Reyes has never been arrested in his life. His sister texted "come get me," and he came — that is the whole of his premeditation. The bouncer, nobody\'s witness, tells you what kind of night Merritt was having and who he was having it at. The People\'s tape starts four seconds too late, and those four seconds are the case: Elena saw the shove, the camera didn\'t, and the People ask you to convict a man because their camera blinked. One punch, thrown at a bigger, drunker man advancing on him and his sister. The law does not require Dominic to lose that fight to be innocent. Self-defense is not an apology. It is an answer.',
  },
};

// [LLM-FILL: PleaNarrative] — both rationales required on an offering band;
// here the defense's is a rejection, voiced before the case ever reaches
// the bench.
const rawReyesPleaNarrative = {
  prosecutionRationale: 'I have the punch in high definition, the fracture on film, and his own thumbs typing "caught him flush" while the victim was in a scanner. A trained fighter is charged with knowing what his hands are; that is the whole theory and the tape proves it twice. The offer reflects a case I do not expect to lose: he pleads to the count and takes the term — I strike the fine and spare his family the exhibits. I am not paying for the first twenty minutes. Whatever happened in that hallway, it did not follow Merritt into the parking lot with its fists up.',
  defenseRationale: 'They\'ve offered him four years for pleading against four years for losing — that is not an offer, it is an invoice for skipping the trial. Dominic has never been arrested in his life. The bouncer — their kind of witness, neutral as they come — puts Merritt on top of Elena twenty minutes before the tape begins, and the tape itself starts four seconds too late, which I intend to make the most expensive four seconds in the county. He wants a jury. On these terms, so do I.',
};

// [LLM-FILL: Aftermath] — CONVICTED and ACQUITTED only: the defense rejected
// the offer, so the plea branch never reaches the bench and defineDemoCase
// rejects a PLEA_ACCEPTED variant that could never be shown.
const reyesAftermath = {
  CONVICTED:
    'The gym took Reyes\'s photo off the wall the week of the verdict — sponsors, the owner said, and did not finish the sentence. The Sentinel\'s coverage led with the medical exhibits, and the comment section relitigated the four missing seconds for a full weekend: one camp asking what kind of man waits under a floodlight, the other asking what kind of case starts its own tape mid-swing. Kyle Merritt walked into the sentencing on his own, which his family called a miracle and his neurologist called eleven months of work; the cognitive results, read into the record, were not all good news. Elena Reyes sat through every hearing and left the courthouse the last day without her brother, which was the photograph every paper ran. The Golden Spur repainted the curb, added a second camera — this one covering the whole lot — and quietly stopped booking fight nights on its TVs.',
  ACQUITTED:
    'Self-defense, the jury said in effect, and the courtroom split into two families\' worth of noise. The Sentinel ran the fourteen seconds of tape one last time under the headline "The Four Seconds That Weren\'t There." Kyle Merritt, still in speech therapy, told the reporter through his son that a not-guilty verdict doesn\'t un-crack a skull; his family has retained civil counsel, where the burden of proof is lighter and the tape will play again. Elena Reyes said the only thing anyone remembers from the courthouse steps: "He came when I called. That\'s the whole story." The bouncer gave no interviews. Reyes withdrew from his June bout anyway — his manager called it "optics" — and the Golden Spur\'s insurer, unmoved by acquittals, required a second camera and a two-guard exit policy before renewing. The People\'s office issued a two-line statement noting that juries decide facts. It did not congratulate anyone.',
};

export const reyesCase = defineDemoCase({
  title: 'People v. Dominic Reyes',
  teaser: 'One punch on tape, a skull fracture, and the twenty minutes the camera never saw.',
  payload: rawReyesPayload,
  pleaNarrative: rawReyesPleaNarrative,
  aftermath: reyesAftermath,
});
