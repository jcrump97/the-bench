import { defineDemoCase } from './types';

// People v. Teresa Vaughn — Felony Hit-and-Run Causing Injury (VC § 20001(a))
// + Driving on a Suspended License (VC § 14601.1(a)). The docket's
// multi-charge case: it exercises deriveSentencingExposure's cross-charge
// aggregation (prison + jail + fine), per-charge verdicts in
// TrialVerdictForm, and the SPLIT aftermath. Tuned MODERATE (score ~63) with
// a defendant built to accept: heavy priors (including a felony prison
// term), high neuroticism, low openness — the anxious mirror of Reyes. The
// texture: one count is a paper certainty, the other turns entirely on eight
// seconds of engine idle.
const rawVaughnPayload = {
  // [LLM-FILL: CasePayload] — caseId is assigned by the pipeline's final
  // assembly call (with `summary`, below) once the four stages complete.
  caseId: '24-CR-01579',
  // [LLM-FILL: CharacterGen] — the whole defendant block. The priors and
  // traits are the accept-side counterweight: three convictions with a
  // felony prison term push priorExposure to 70, and the anxious profile
  // keeps risk tolerance near the floor.
  defendant: {
    firstName: 'Teresa',
    lastName: 'Vaughn',
    age: 41,
    demographics: {
      relationshipStatus: 'DIVORCED',
      children: 1,
      employmentStatus: 'EMPLOYED',
      educationLevel: 'HIGH_SCHOOL',
      substanceAbuseHistory: [
        { substance: 'Alcohol', status: 'IN_RECOVERY' },
      ],
    },
    pastConvictions: [
      {
        chargeName: 'Driving Under the Influence (Cal. Vehicle Code § 23152)',
        year: 2018,
        sentences: [
          { type: 'JAIL', unit: 'DAYS', amount: 4 },
          { type: 'PROBATION', unit: 'YEARS', amount: 3, conditions: ['SUBSTANCE_ABUSE_TREATMENT'] },
        ],
      },
      {
        chargeName: 'DUI Causing Injury (Cal. Vehicle Code § 23153)',
        year: 2021,
        sentences: [{ type: 'PRISON', unit: 'MONTHS', amount: 16 }],
      },
      {
        chargeName: 'Driving on a Suspended License (Cal. Vehicle Code § 14601.1)',
        year: 2023,
        sentences: [{ type: 'FINE', unit: 'DOLLARS', amount: 500 }],
      },
    ],
    oceanTraits: {
      openness: 2,
      conscientiousness: 8,
      extraversion: 4,
      agreeableness: 6,
      neuroticism: 9,
    },
  },
  // [LLM-FILL: EnvironmentGen] — scene enums plus the narrative description.
  environment: {
    locationType: 'PUBLIC_SPACE',
    timeOfDay: 'EVENING',
    weather: 'CLEAR',
    description: 'The intersection of Alder Avenue and 9th, four blocks from the middle school: a bike lane the city painted last spring, a four-way stop drivers treat as a suggestion, and streetlights on a seasonal timer that, in the first week of October, still believed it was summer. At 6:40 p.m. it is dusk on the ground and daylight on paper.',
  },
  // [LLM-FILL: StatuteSelection] — charges (with elements and per-charge
  // statutory ranges) and statuteContexts. Two charges: case-level exposure
  // is derived across them (prison + fine from the felony, jail from the
  // misdemeanor), and the verdict is entered per charge.
  charges: [
    {
      id: 'charge-hit-run',
      name: 'Felony Hit-and-Run Causing Injury (Cal. Vehicle Code § 20001(a))',
      classification: 'FELONY',
      elements: [
        { id: 'elem-hr-accident', description: 'While driving, defendant was involved in an accident that caused injury to another person.' },
        { id: 'elem-hr-knowledge', description: 'Defendant knew, or reasonably should have known, that the accident injured another person.' },
        { id: 'elem-hr-flee', description: 'Defendant willfully failed to stop at the scene, provide identifying information, and render reasonable assistance.' },
      ],
      mandatoryMinimums: [],
      maximumPenalties: [
        { type: 'PRISON', unit: 'YEARS', amount: 3 },
        { type: 'FINE', unit: 'DOLLARS', amount: 10000 },
      ],
    },
    {
      id: 'charge-susp-license',
      name: 'Driving on a Suspended License (Cal. Vehicle Code § 14601.1(a))',
      classification: 'MISDEMEANOR',
      elements: [
        { id: 'elem-dsl-drove', description: 'Defendant drove a motor vehicle on a public roadway.' },
        { id: 'elem-dsl-knowledge', description: 'When driving, defendant\'s license was suspended and defendant knew of the suspension.' },
      ],
      mandatoryMinimums: [],
      maximumPenalties: [{ type: 'JAIL', unit: 'MONTHS', amount: 6 }],
    },
  ],
  statuteContexts: [
    'Cal. Vehicle Code § 20001(a) — the driver of a vehicle involved in an accident resulting in injury to another person shall immediately stop, provide identification, and render reasonable assistance.',
    'Cal. Vehicle Code § 14601.1(a) — driving a motor vehicle while the driving privilege is suspended, with knowledge of the suspension.',
  ],
  // [LLM-FILL: EvidenceGen] — witnesses and evidence. The license count is
  // built on LOW-risk paper; the hit-and-run count leans on a MEDIUM-risk
  // inference and a HIGH-risk eight seconds of audio — which is where the
  // judge's Act 2 rulings will actually matter.
  witnesses: [
    {
      id: 'wit-cyclist',
      name: 'Gordon Pyle',
      role: 'VICTIM',
      bias: 'PROSECUTION',
      statement: 'The cyclist, 58, a retired shop teacher who rides the Alder Avenue lane home every evening. Will testify to headlights behind him, the strike, and the pavement — a shattered pelvis, two surgeries, a walker he is still using. He never saw the driver and will say so plainly; what he remembers is the sound of a car that did not stop getting quieter.',
      credibilityScore: 6,
    },
    {
      id: 'wit-neighbor',
      name: 'June Castellanos',
      role: 'EYEWITNESS',
      bias: 'NEUTRAL',
      statement: 'Lives on the corner of Alder and 9th. Will testify she heard the impact from her porch, saw a light-colored sedan stopped in the intersection "for a breath or two," and watched it pull away before she understood what the shape in the bike lane was. She cannot describe the driver and puts the light at "almost dark." Neither side\'s witness, which is why both sides will spend an hour with her.',
      credibilityScore: 7,
    },
    {
      id: 'wit-officer',
      name: 'Sgt. Dale Kirby',
      role: 'INVESTIGATOR',
      bias: 'PROSECUTION',
      statement: 'Traffic investigator. Will testify to the paint transfer match, the bumper fragment fitted to Vaughn\'s sedan "like a puzzle piece," the online repair quote opened from her phone at 7:04 the next morning, and the certified DMV mailing history on her suspension. Will acknowledge on cross that no witness puts Vaughn behind the wheel and that her son, eleven, was in the car — a fact the defense will use for sympathy and Kirby uses for knowledge: a mother, he will say, checks the seat next to her before anything else.',
      credibilityScore: 8,
    },
    {
      id: 'wit-sponsor',
      name: 'Walt Emery',
      role: 'CHARACTER',
      bias: 'DEFENSE',
      statement: 'Vaughn\'s AA sponsor of three years. Will testify she called him at 7:20 that evening — not about an accident, about her ex missing the custody exchange again — and that she was sober, has been for three years, and drives only when the alternative is her son standing alone outside a locked gym at dusk. He will not be able to say what she did or did not feel her car strike.',
      credibilityScore: 7,
    },
  ],
  evidence: [
    {
      id: 'ev-paint',
      name: 'Paint transfer and bumper fragment',
      type: 'FORENSIC',
      description: 'Lab-matched paint transfer on Pyle\'s bicycle frame and a bumper fragment recovered at the scene, fitted to the damage on Vaughn\'s sedan. The crime lab calls the fragment match "physical fit," its highest confidence language. That the car was involved is, functionally, not in dispute.',
      relevanceScore: 8,
      objectionRisk: 'LOW',
      targetElementId: 'elem-hr-accident',
    },
    {
      id: 'ev-repair',
      name: 'Online repair-quote request',
      type: 'DIGITAL',
      description: 'A body-shop web form opened from Vaughn\'s phone at 7:04 the next morning: front-right bumper and headlamp, photos attached, damage description "hit a deer." The People call the deer a confession with antlers. The defense notes it is also what a person types when she believes she hit something, not someone.',
      relevanceScore: 7,
      objectionRisk: 'MEDIUM',
      targetElementId: 'elem-hr-knowledge',
    },
    {
      id: 'ev-doorbell',
      name: 'Doorbell-camera audio',
      type: 'DIGITAL',
      description: 'Audio from a doorbell camera facing away from the intersection: the impact, then approximately eight seconds of engine idle, then acceleration. No video of the street. The People say eight seconds is a driver looking in her mirror and deciding. The defense says it is a stop sign, and that the camera that heard everything saw nothing.',
      relevanceScore: 5,
      objectionRisk: 'HIGH',
      targetElementId: 'elem-hr-flee',
    },
    {
      id: 'ev-dmv',
      name: 'Certified DMV record',
      type: 'DOCUMENTARY',
      description: 'Certified driving record: license suspended since the 2021 conviction, two renewal denials, and proof of mailed notice to Vaughn\'s current address — an address she wrote on the forms herself. The 2023 conviction for the same offense forecloses any argument that she did not know.',
      relevanceScore: 8,
      objectionRisk: 'LOW',
      targetElementId: 'elem-dsl-knowledge',
    },
    {
      id: 'ev-cam-still',
      name: 'Intersection camera still',
      type: 'DIGITAL',
      description: 'A single frame from a red-light camera two intersections north, four minutes after the collision: Vaughn\'s sedan, plate legible, driver a silhouette. It places the car on the road that evening; it cannot say who is driving, though no one seriously suggests it was the eleven-year-old.',
      relevanceScore: 5,
      objectionRisk: 'MEDIUM',
      targetElementId: 'elem-dsl-drove',
    },
  ],
  // [LLM-FILL: CasePayload] — the case-opening summary, written by the final
  // assembly call with all four stage outputs in context.
  summary: 'At 6:40 on an October evening, a sedan clipped Gordon Pyle in the Alder Avenue bike lane, idled for roughly eight seconds, and drove on. Pyle, 58, got a shattered pelvis and two surgeries. The car was Teresa Vaughn\'s — paint transfer and a fitted bumper fragment put that beyond argument — and her license has been suspended since a felony DUI in 2021, a fact she has already been convicted of ignoring once. At 7:04 the next morning her phone opened a repair-quote form: "hit a deer." Vaughn, 41 and three years sober, was driving her son home because her ex missed the custody exchange again. One count is paper: she drove, and she knew she couldn\'t. The other is those eight seconds of engine idle on a doorbell camera that saw nothing — the distance between a woman who hit a deer and a mother who looked in the mirror, saw a man in the bike lane, and chose the child in the passenger seat over the stranger on the ground.',
};

// [LLM-FILL: PleaNarrative] — both rationales required on an offering band;
// here the defense recommends taking the deal, and the offer reaches the
// bench for judicial review.
const rawVaughnPleaNarrative = {
  prosecutionRationale: 'The license count is arithmetic — certified record, mailed notice, a prior for the identical offense. On the felony, I have her car, her bumper in the road, her phone calling it a deer, and eight seconds of idle that a jury will not forgive. What I don\'t have is a monster: a sober woman, a missed custody exchange, a kid in the car. The offer prices all of it — she pleads to both counts at a real discount, Mr. Pyle gets restitution and is spared testifying from a walker, and nobody pretends those eight seconds didn\'t happen.',
  defenseRationale: 'I can try the felony — the camera saw nothing, the deer is honest confusion, and June Castellanos\'s "breath or two" is a stop sign, not a getaway. But I cannot try the license count, and once a jury hears "suspended, again," the felony gets harder to win in the same room. Teresa has a prison prior; a trial loss means the full term and her son standing outside a locked gym for good this time. She wept when I explained the offer. Then she asked where to sign. I have advised the court she accepts.',
};

// [LLM-FILL: Aftermath] — all four variants: the offer is pending (plea
// branch reachable) and the case is multi-charge (a split verdict is
// possible). SPLIT is written direction-neutral because either count can be
// the one that lands.
const vaughnAftermath = {
  PLEA_ACCEPTED:
    'The plea hearing took eleven minutes. The Sentinel gave it a column inside the local section — "Sober Driver, Suspended License, Split-Second Choice" — and for once the comment page was quieter than the courtroom. Gordon Pyle\'s restitution was ordered before the ink dried; his first payment arrived with a handwritten line the paper later printed: "I am sorry I was not braver." Pyle told the reporter he believed the deer more than the district attorney did, and that he still checks over his shoulder at every intersection. Family court took notice of the conviction, as family court does; Vaughn kept primary custody, with a transportation plan built around a bus pass and Walt Emery\'s Tuesday-night rides. The city, sued by no one, nonetheless fixed the streetlight timer on Alder the following week — dusk now gets light. Her sedan sat in the impound lot for a month before she sold it to cover the first restitution installment. She has not missed a meeting since.',
  CONVICTED:
    'Guilty on both counts, and the courtroom\'s loudest sound was Teresa Vaughn asking her lawyer, twice, who would pick up her son. The Sentinel\'s editorial board spent a week on the case — not on the verdict, which it called inevitable, but on the arithmetic that put a three-years-sober mother behind the wheel: a suspended license with no restricted-permit path she could afford, an ex who missed exchanges without consequence, a county bus that does not go near the gym. None of it, the board conceded, was Gordon Pyle\'s problem; he did his rehab a mile from the courthouse and came to sentencing on a cane he called an upgrade. The boy went to his grandmother\'s on a school-year order. Walt Emery started a Tuesday ride list at the meeting — eleven names by spring, people with licenses gone and children who still need to be somewhere. The streetlight timer on Alder was fixed the week after sentencing. Nobody at the city would say why then.',
  ACQUITTED:
    'Not guilty — on both counts, which even the defense table did not appear to expect. The Sentinel led with the eight seconds: the court, it wrote, "declined to convict a woman for what a camera heard but could not see," and on the paper count the verdict read less like doubt than like mercy with a gavel. The district attorney\'s statement was one sentence and did not contain the word "respect." Gordon Pyle\'s civil suit was filed within the month — a lighter burden, a friendlier forum, and the bumper fragment will fit the same either way. Vaughn walked out un-convicted and still unlicensed; the DMV, unmoved by verdicts, denied her restricted permit again in the spring. Her ex\'s lawyer cited the trial in a custody motion anyway and lost. She sold the sedan, kept the bus pass, and told her Tuesday meeting that being acquitted and being innocent had turned out to be different weights to carry. The streetlight timer on Alder still runs a season behind.',
  SPLIT:
    'The court split the verdict — guilty on one count, acquitted on the other — and each table left with half a win it had to explain. The Sentinel called it "a verdict down the center line" and noted, not unkindly, that splitting the difference is sometimes what judging honestly looks like: the paper and the eight seconds were never really one case. Gordon Pyle heard the word "guilty" once, which his son said mattered more than which count it was attached to; his civil counsel, wanting the whole loaf, filed within the month. The conviction — whichever half of the docket it landed on — went into the family-court file, where Vaughn\'s transportation plan (a bus pass, Walt Emery\'s Tuesday rides) persuaded the judge more than the verdict did; she kept primary custody by a narrower margin than before. The DMV\'s position required no deliberation at all: still suspended. The city fixed the Alder streetlight timer that winter, and the bike lane got a fresh coat of paint that spring, which is how municipalities apologize.',
};

export const vaughnCase = defineDemoCase({
  title: 'People v. Teresa Vaughn',
  teaser: 'A struck cyclist, eight seconds of engine idle, and a license she was never supposed to be using.',
  payload: rawVaughnPayload,
  pleaNarrative: rawVaughnPleaNarrative,
  aftermath: vaughnAftermath,
});
