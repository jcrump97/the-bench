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
    },
    {
      id: 'wit-physician',
      name: 'Dr. Amara Okafor',
      role: 'EXPERT',
      bias: 'NEUTRAL',
      statement: 'Trauma physician who treated the victim. Will testify to a depressed skull fracture and a subdural bleed consistent with the back of the head striking concrete after a single high-force blow; three days in the ICU, cognitive testing still pending. On the mechanics she is unshakable. On who started it she has, by design, nothing to say.',
      credibilityScore: 9,
    },
    {
      id: 'wit-bouncer',
      name: 'Ollie Brandt',
      role: 'EYEWITNESS',
      bias: 'NEUTRAL',
      statement: 'Door security that night. Will testify he separated Merritt from Reyes\'s sister near the restrooms twenty minutes earlier — Merritt leaning in, her backing up — and that he told Merritt to close out his tab. Did not see a shove and did not see the punch; he was walking Merritt\'s group out when it happened. The People call his account context. The defense calls it the first chapter the video doesn\'t show.',
      credibilityScore: 8,
    },
    {
      id: 'wit-sister',
      name: 'Elena Reyes',
      role: 'CHARACTER',
      bias: 'DEFENSE',
      statement: 'Defendant\'s younger sister. Will testify Merritt followed her from the bar to the restroom hallway twice, that she texted Dominic "come get me" at 11:42, and that outside Merritt shoved Dominic first — a shove she describes to the inch and the video, which begins mid-swing, does not capture. She has told the story the same way every time. She is also the reason her brother was there.',
      credibilityScore: 5,
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
    },
    {
      id: 'ev-medical',
      name: 'Emergency department records and CT imaging',
      type: 'DOCUMENTARY',
      description: 'Certified records documenting a depressed skull fracture, subdural hematoma, and a three-day ICU admission. The imaging exhibits are the People\'s answer to "it was one punch": this is what one punch from a trained fighter onto a painted curb does.',
      relevanceScore: 8,
      objectionRisk: 'LOW',
      targetElementId: 'elem-gbi',
    },
    {
      id: 'ev-texts',
      name: 'Defendant\'s text messages',
      type: 'DIGITAL',
      description: 'Messages from Reyes\'s phone that night: his sister\'s "come get me" at 11:42, his "on my way" reply, and — forty minutes after the punch — "caught him flush. he dropped." The People read a fighter\'s scorekeeping. The defense reads a scared kid describing the worst second of his life to his corner coach.',
      relevanceScore: 7,
      objectionRisk: 'MEDIUM',
      targetElementId: 'elem-aware',
    },
    {
      id: 'ev-hall-video',
      name: 'Interior hallway clip',
      type: 'DIGITAL',
      description: 'Eight seconds from the bar\'s interior camera, shoulder-height and half-blocked by a beam: Merritt and Elena Reyes in the restroom hallway, the bouncer arriving, Merritt\'s arm braced on the wall above her. No audio. It proves the twenty-minutes-earlier confrontation happened; it cannot say what was said, or who touched whom.',
      relevanceScore: 6,
      objectionRisk: 'MEDIUM',
      targetElementId: 'elem-act',
    },
  ],
  // [LLM-FILL: CasePayload] — the case-opening summary, written by the final
  // assembly call with all four stage outputs in context.
  summary: 'Fourteen seconds of video show Dominic Reyes, 26, an amateur middleweight with no record of any kind, drop Kyle Merritt with one punch outside the Golden Spur. Merritt\'s head hit a painted curb; he spent three days in intensive care and his cognitive testing is still pending. The video does not show the twenty minutes before: Merritt following Reyes\'s sister to the restroom hallway, the bouncer stepping in, her text — "come get me" — and, per the sister, a shove from Merritt that the camera missed by four seconds. The People say a trained fighter waited under a floodlight and threw a blow he of all people knew could kill. Reyes says he came for his sister and defended himself against a bigger, drunker man. The tape, both sides agree, is devastating. They disagree about what it is devastating to.',
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
