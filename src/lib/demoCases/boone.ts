import { defineDemoCase } from './types';

// People v. Curtis Boone — Second-Degree Commercial Burglary (PC § 459).
// Tuned WEAK (score ~33: element coverage 1/2, HIGH objection risk on the
// People's best exhibits, a 4-credibility eyewitness), so assessProsecution
// bands WEAK and buildPleaPosture yields NO_OFFER — the docket's trial-only
// case, exercising PleaOfferForm's "No Plea Offer Made" state. The moral
// texture is the mirror of Webb: not "did a good man do it" but "can the
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
    },
    {
      id: 'wit-owner',
      name: 'Sam Herrera',
      role: 'VICTIM',
      bias: 'PROSECUTION',
      statement: 'Owner of QuickCoin. Will testify that $2,300 and the spare cash box were gone by morning, that whoever entered walked straight through the camera\'s blind spot without a wasted step, and that he fired Boone two months earlier over a till-count dispute — a dispute Boone himself had flagged. Will concede on cross that at least four current and former employees knew that blind spot as well as Boone did.',
      credibilityScore: 5,
    },
    {
      id: 'wit-sister',
      name: 'Tasha Boone',
      role: 'CHARACTER',
      bias: 'DEFENSE',
      statement: 'Defendant\'s older sister. Will testify Curtis was asleep on her couch across town when the alarm company logged the door at 1:52 a.m., that he had been there most nights since losing his job, and that he does not own the sneakers the print came from. She is his sister, and the jury will be told to weigh that.',
      credibilityScore: 6,
    },
  ],
  evidence: [
    {
      id: 'ev-lineup',
      name: 'Photo array identification',
      type: 'DOCUMENTARY',
      description: 'Six-pack photo identification made nine days after the burglary; the witness picked Boone in eleven seconds. The defense has a suppression motion drafted: Boone\'s photo — pulled from the store\'s own staff-page archive — is the only one in the array where the subject wears a QuickCoin uniform shirt.',
      relevanceScore: 6,
      objectionRisk: 'HIGH',
      targetElementId: 'elem-entry',
    },
    {
      id: 'ev-shoeprint',
      name: 'Partial shoe print cast',
      type: 'FORENSIC',
      description: 'Tread cast from the mud inside the rear door: a size-10 Meridian trainer, one of the most common shoes sold in the county. Boone wears a size 10. So, the defense will note, does roughly one man in eight.',
      relevanceScore: 4,
      objectionRisk: 'HIGH',
      targetElementId: 'elem-entry',
    },
    {
      id: 'ev-prybar',
      name: 'Recovered pry bar',
      type: 'PHYSICAL',
      description: 'A pry bar recovered from a dumpster two blocks north, consistent with the tool marks on the rear door. No fingerprints, no DNA, no purchase record — nothing connecting it to Boone beyond its distance from a bus stop he sometimes used.',
      relevanceScore: 5,
      objectionRisk: 'MEDIUM',
      targetElementId: null,
    },
    {
      id: 'ev-cellsite',
      name: 'Cell-site location records',
      type: 'DIGITAL',
      description: 'Carrier records placing Boone\'s phone inside a three-quarter-mile sector that includes QuickCoin between 1:40 and 2:15 a.m. The same sector includes his sister\'s apartment, where he says he was sleeping.',
      relevanceScore: 5,
      objectionRisk: 'HIGH',
      targetElementId: null,
    },
  ],
  // [LLM-FILL: CasePayload] — the case-opening summary, written by the final
  // assembly call with all four stage outputs in context.
  summary: 'Someone came through the rear door of QuickCoin Check Cashing at 1:52 a.m. in the rain, walked the one path the camera cannot see, and left with $2,300 and the spare cash box. Nine days later a woman who waited out the storm across the street picked Curtis Boone out of a photo array — Boone, who cashed her checks for two years, and whom the owner fired two months ago over a till dispute Boone himself had reported. The People have a common shoe print, a pry bar no one can connect to anyone, a phone that was somewhere in the neighborhood where Boone also happens to live, and a witness who is pretty sure. Boone has a sister who says he was on her couch, no job since the firing, and one act of vandalism from when he was twenty. Four other people knew the blind spot. One of them got charged.',
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
