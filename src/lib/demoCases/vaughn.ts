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
      verdictReactions: {
        GUILTY: [
          { speaker: 'DEFENSE', text: 'The defense notes its exception on this count for the record, Your Honor.' },
          { speaker: 'PROSECUTION', text: 'The People thank the court. Mr. Pyle has waited a long time for those eight seconds to count for something.' },
        ],
        NOT_GUILTY: [
          { speaker: 'PROSECUTION', text: 'The People accept the verdict on this count, Your Honor, though Mr. Pyle is still on the walker.' },
          { speaker: 'DEFENSE', text: 'The defense thanks the court. Eight seconds of idle was never proof of flight.' },
        ],
      },
      verdictOptions: [
        { choice: 'GUILTY', lineText: 'Eight seconds of idle before acceleration is a decision, not a stop sign. On the charge of felony hit-and-run causing injury, the court finds the defendant guilty.' },
        { choice: 'GUILTY', lineText: 'The physical evidence is not in dispute, and the court is satisfied beyond a reasonable doubt that the defendant knew she had struck someone and drove on. Guilty.' },
        { choice: 'NOT_GUILTY', lineText: 'A recording that heard the intersection but never saw it cannot establish beyond a reasonable doubt what the defendant knew. Not guilty.' },
        { choice: 'NOT_GUILTY', lineText: 'The People have not excluded the reasonable possibility that eight seconds of idle was nothing more than a stop sign. Not guilty on this count.' },
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
      verdictReactions: {
        GUILTY: [
          { speaker: 'PROSECUTION', text: 'The People thank the court. The DMV record was never seriously in dispute.' },
          { speaker: 'DEFENSE', text: 'The defense has no exception on this count, Your Honor. We said as much in closing.' },
        ],
        NOT_GUILTY: [
          { speaker: 'PROSECUTION', text: 'The People note their exception, Your Honor — the certified record was not contested.' },
          { speaker: 'DEFENSE', text: 'The defense thanks the court.' },
        ],
      },
      verdictOptions: [
        { choice: 'GUILTY', lineText: 'The certified DMV record and the prior conviction for the same offense foreclose any argument the defendant did not know. Guilty.' },
        { choice: 'GUILTY', lineText: 'On the charge of driving on a suspended license, the court finds the defendant guilty.' },
        { choice: 'NOT_GUILTY', lineText: 'Notwithstanding the record, the court is not satisfied beyond a reasonable doubt on this count. Not guilty.' },
        { choice: 'NOT_GUILTY', lineText: 'Not guilty on the charge of driving on a suspended license.' },
      ],
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
      directExamination: 'I ride that lane home every evening — thirty years of shop class, you keep your habits. I remember headlights coming up behind me, and then I was on the pavement and my hip was wrong in a way I knew immediately. Two surgeries. I\'m still on the walker. I never saw the driver, and I won\'t pretend I did. What I remember is lying in the lane listening to a car that didn\'t stop get quieter.',
      crossExamination: 'That\'s right — I can\'t tell you who was driving, or whether they could see me, or what they knew. It was dusk and my tail light was on; past that I won\'t guess. You want me to say the engine I heard idling was a stop sign two blocks up? Could be. I was busy on the ground, counselor. I\'ll give you this much: whoever it was, I\'d rather believe they didn\'t know. Believing it is harder some days than others.',
    },
    {
      id: 'wit-neighbor',
      name: 'June Castellanos',
      role: 'EYEWITNESS',
      bias: 'NEUTRAL',
      statement: 'Lives on the corner of Alder and 9th. Will testify she heard the impact from her porch, saw a light-colored sedan stopped in the intersection "for a breath or two," and watched it pull away before she understood what the shape in the bike lane was. She cannot describe the driver and puts the light at "almost dark." Neither side\'s witness, which is why both sides will spend an hour with her.',
      credibilityScore: 7,
      directExamination: 'I was on my porch when I heard it — a thump, not a crash, the kind of sound you talk yourself out of. There was a light-colored sedan stopped in the intersection. It sat there a breath or two. Then it pulled away, calm as anything, and it wasn\'t until it was gone that I understood what the shape in the bike lane was. I called 911 before I got to him.',
      crossExamination: 'A breath or two — I won\'t swear to seconds, I wasn\'t counting. It was almost dark; the streetlights weren\'t on yet, which everyone on that block has complained about for a year. No, I couldn\'t see the driver, not even to say man or woman. Was the car stopped at the stop sign or stopped because of what happened? Counselor, I\'ve asked myself that every night since. The honest answer is I don\'t know.',
    },
    {
      id: 'wit-officer',
      name: 'Sgt. Dale Kirby',
      role: 'INVESTIGATOR',
      bias: 'PROSECUTION',
      statement: 'Traffic investigator. Will testify to the paint transfer match, the bumper fragment fitted to Vaughn\'s sedan "like a puzzle piece," the online repair quote opened from her phone at 7:04 the next morning, and the certified DMV mailing history on her suspension. Will acknowledge on cross that no witness puts Vaughn behind the wheel and that her son, eleven, was in the car — a fact the defense will use for sympathy and Kirby uses for knowledge: a mother, he will say, checks the seat next to her before anything else.',
      credibilityScore: 8,
      directExamination: 'The lab matched the paint transfer on Mr. Pyle\'s frame to the Vaughn sedan, and the bumper fragment from the scene fits her car\'s damage like a puzzle piece — physical fit, the lab\'s highest confidence finding. At 7:04 the next morning, her phone opened a body-shop quote form: front-right bumper, headlamp, "hit a deer." And the DMV file shows mailed notice of her suspension to an address she wrote on the forms herself, plus a prior conviction for driving on it. This was not a car that didn\'t know where it had been.',
      crossExamination: 'Correct: no witness puts Mrs. Vaughn behind the wheel, and I\'ve never claimed otherwise — I put her car there, and her phone the next morning. Her son was in the car, yes. Eleven years old. Counsel offers that for sympathy and I understand why. I\'ll tell you how I read it after twenty years of these: a mother who feels an impact checks the seat next to her before anything else. She knew something happened. The eight seconds say she checked.',
    },
    {
      id: 'wit-sponsor',
      name: 'Walt Emery',
      role: 'CHARACTER',
      bias: 'DEFENSE',
      statement: 'Vaughn\'s AA sponsor of three years. Will testify she called him at 7:20 that evening — not about an accident, about her ex missing the custody exchange again — and that she was sober, has been for three years, and drives only when the alternative is her son standing alone outside a locked gym at dusk. He will not be able to say what she did or did not feel her car strike.',
      credibilityScore: 7,
      directExamination: 'Teresa called me at 7:20 that evening. Not about any accident — about her ex missing the custody exchange again, third time that month, and her boy standing outside a locked gym at dusk. She was calm, she was sober — three years sober, and I\'d stake my own chip on it. She drives when the choice is her son alone on a curb in the dark or her behind the wheel. I\'m not excusing it. I\'m telling you what the choice looked like from inside her life.',
      crossExamination: 'No — I can\'t say what she felt her car hit, or what she saw in the mirror. I wasn\'t in the car and I won\'t pretend I was. Did she mention hitting anything at 7:20? A deer. She said she thought she\'d clipped a deer coming down Alder, and she was rattled about the car because the car is how her son gets anywhere. That\'s what she told me nine hours before any police officer knocked. Make of the timing what you will, counselor. I make of it that she believed it.',
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
      prosecutionArgument: 'The People offer the paint transfer and the bumper fragment. The lab calls the fragment match "physical fit" — its highest confidence language. The defendant\'s sedan struck Mr. Pyle. The defense does not seriously contest it, and the exhibits close the question.',
      defenseObjection: null,
      rulingReactions: {
        ADMITTED: [
          { speaker: 'PROSECUTION', text: 'Thank you, Your Honor. That much has never been the fight.' },
          { speaker: 'DEFENSE', text: 'The defense does not contest this exhibit, Your Honor — our case is about the eight seconds after it.' },
        ],
        EXCLUDED: [
          { speaker: 'CLERK', text: 'The paint transfer and bumper fragment are withdrawn from the exhibit list.' },
          { speaker: 'PROSECUTION', text: 'The People note their exception for the record, Your Honor.' },
        ],
      },
      rulingOptions: [
        { choice: 'ADMITTED', lineText: 'The lab match is uncontested and goes directly to whether the defendant\'s vehicle was involved. Admitted.' },
        { choice: 'ADMITTED', lineText: 'No objection has been raised, and the exhibit is squarely relevant. Admitted.' },
        { choice: 'EXCLUDED', lineText: 'The court excludes this exhibit on its own initiative, unpersuaded the foundation has been adequately laid. Excluded.' },
        { choice: 'EXCLUDED', lineText: 'The paint transfer and bumper fragment are excluded.' },
      ],
    },
    {
      id: 'ev-repair',
      name: 'Online repair-quote request',
      type: 'DIGITAL',
      description: 'A body-shop web form opened from Vaughn\'s phone at 7:04 the next morning: front-right bumper and headlamp, photos attached, damage description "hit a deer."',
      relevanceScore: 7,
      objectionRisk: 'MEDIUM',
      targetElementId: 'elem-hr-knowledge',
      prosecutionArgument: 'The People offer the repair-quote request from the defendant\'s own phone, 7:04 the next morning: front-right bumper, headlamp, photos attached, cause of damage — "hit a deer." There are no deer on Alder Avenue, Your Honor. It is a confession with antlers: she knew that night she had hit something, and by sunrise she was writing the cover story.',
      defenseObjection: 'Objection to the People\'s characterization. This form is exactly what a person types when she believes she hit something, not someone — no deletion, no cash repair across town, her own name and number on the request. People conscious of guilt hide damage. Teresa Vaughn photographed hers and asked for a quote before breakfast. The exhibit is the defense\'s case, and the People know it.',
      rulingReactions: {
        ADMITTED: [
          { speaker: 'DEFENSE', text: 'Then let the jury read the whole form, Your Honor — her own name, her own number, and "hit a deer."' },
          { speaker: 'PROSECUTION', text: 'The People are glad to have it in, counsel, deer and all.' },
        ],
        EXCLUDED: [
          { speaker: 'CLERK', text: 'The repair-quote request is withdrawn from the exhibit list.' },
          { speaker: 'PROSECUTION', text: 'The People note their exception, Your Honor.' },
        ],
      },
      rulingOptions: [
        { choice: 'ADMITTED', lineText: 'The defendant\'s own morning-after actions are relevant to what she knew the night before. Admitted, in full.' },
        { choice: 'ADMITTED', lineText: 'The form comes in as written — no deletion, no alteration. Admitted.' },
        { choice: 'EXCLUDED', lineText: 'The People\'s characterization of an ambiguous exhibit invites more prejudice than the form itself is worth. Excluded.' },
        { choice: 'EXCLUDED', lineText: 'The motion is granted; the repair-quote request is excluded.' },
      ],
    },
    {
      id: 'ev-doorbell',
      name: 'Doorbell-camera audio',
      type: 'DIGITAL',
      description: 'Audio from a doorbell camera facing away from the intersection: the impact, then approximately eight seconds of engine idle, then acceleration. No video of the street.',
      relevanceScore: 5,
      objectionRisk: 'HIGH',
      targetElementId: 'elem-hr-flee',
      prosecutionArgument: 'The People offer the doorbell-camera audio: the impact, then eight seconds of engine idle, then acceleration. Eight seconds, Your Honor. That is a driver looking in her mirror at a man in the bike lane and deciding. The idle is the decision; the acceleration is the crime.',
      defenseObjection: 'Objection — this is a soundtrack being offered as an eyewitness. The camera faces away from the intersection; it heard everything and saw nothing. There is a four-way stop at Alder and 9th, and eight seconds of idle is called "stopping at it." The People want the court to convict on the noise a stop sign makes. Speculation on top of foundation problems, and the prejudice is the whole point of the offer.',
      rulingReactions: {
        ADMITTED: [
          { speaker: 'PROSECUTION', text: 'Thank you, Your Honor. Eight seconds is eight seconds, and the jury is entitled to hear them.' },
          { speaker: 'DEFENSE', text: 'The defense renews its objection for the record. A stop sign makes the same sound.' },
        ],
        EXCLUDED: [
          { speaker: 'CLERK', text: 'The doorbell-camera audio is withdrawn from the exhibit list.' },
          { speaker: 'PROSECUTION', text: 'The People note their exception, Your Honor — that was the heart of the flight element.' },
        ],
      },
      rulingOptions: [
        { choice: 'ADMITTED', lineText: 'Eight seconds of idle before acceleration is relevant to the flight element, and its ambiguity goes to weight. Admitted.' },
        { choice: 'ADMITTED', lineText: 'The jury may draw its own inference from what it hears. The audio is admitted.' },
        { choice: 'EXCLUDED', lineText: 'An audio recording of an intersection it cannot see cannot tell this court what the driver saw or decided. Excluded.' },
        { choice: 'EXCLUDED', lineText: 'The foundation problems here are real, and the prejudice outweighs the value. The doorbell-camera audio is excluded.' },
      ],
    },
    {
      id: 'ev-dmv',
      name: 'Certified DMV record',
      type: 'DOCUMENTARY',
      description: 'Certified driving record: license suspended since the 2021 conviction, two renewal denials, and proof of mailed notice to Vaughn\'s current address — an address she wrote on the forms herself. The 2023 conviction for the same offense forecloses any argument that she did not know.',
      relevanceScore: 8,
      objectionRisk: 'LOW',
      targetElementId: 'elem-dsl-knowledge',
      prosecutionArgument: 'The People offer the certified DMV record: suspended since 2021, two renewal denials, mailed notice to an address the defendant wrote on the forms herself — and a 2023 conviction for driving on this very suspension. Knowledge is not an inference here. It is a prior conviction.',
      defenseObjection: null,
      rulingReactions: {
        ADMITTED: [
          { speaker: 'PROSECUTION', text: 'Thank you, Your Honor. The license count rests on this exhibit and nothing else needs to be said about it.' },
          { speaker: 'DEFENSE', text: 'The defense does not contest the record, Your Honor. We never have.' },
        ],
        EXCLUDED: [
          { speaker: 'CLERK', text: 'The DMV record is withdrawn from the exhibit list.' },
          { speaker: 'PROSECUTION', text: 'The People note their exception for the record, Your Honor.' },
        ],
      },
      rulingOptions: [
        { choice: 'ADMITTED', lineText: 'A certified record with no objection is admitted as a matter of course.' },
        { choice: 'ADMITTED', lineText: 'The record goes directly to knowledge of suspension and is admitted.' },
        { choice: 'EXCLUDED', lineText: 'The court excludes this exhibit on its own initiative, unpersuaded of its authentication. Excluded.' },
        { choice: 'EXCLUDED', lineText: 'The certified DMV record is excluded.' },
      ],
    },
    {
      id: 'ev-cam-still',
      name: 'Intersection camera still',
      type: 'DIGITAL',
      description: 'A single frame from a red-light camera two intersections north, four minutes after the collision: Vaughn\'s sedan, plate legible, driver a silhouette. It places the car on the road that evening; it cannot say who is driving, though no one seriously suggests it was the eleven-year-old.',
      relevanceScore: 5,
      objectionRisk: 'MEDIUM',
      targetElementId: 'elem-dsl-drove',
      prosecutionArgument: 'The People offer the red-light camera still: the defendant\'s sedan, plate legible, two intersections north, four minutes after the collision. Her car, on that road, at that hour — and the only other person in it was eleven years old.',
      defenseObjection: 'Objection — the driver in this frame is a silhouette, and the People\'s argument for who it shows is "who else would it be." That is burden-shifting in a picture frame. The exhibit proves the car was on the road; it cannot put anyone behind the wheel, and offering it for that purpose invites exactly the inference the rules of evidence exist to police.',
      rulingReactions: {
        ADMITTED: [
          { speaker: 'PROSECUTION', text: 'Thank you, Your Honor. The plate and the timestamp speak for themselves.' },
          { speaker: 'DEFENSE', text: 'The defense renews its objection. A silhouette is not a driver.' },
        ],
        EXCLUDED: [
          { speaker: 'CLERK', text: 'The intersection camera still is withdrawn from the exhibit list.' },
          { speaker: 'PROSECUTION', text: 'The People note their exception, Your Honor.' },
        ],
      },
      rulingOptions: [
        { choice: 'ADMITTED', lineText: 'The still places the vehicle on the road that evening, and its limits go to weight. Admitted.' },
        { choice: 'ADMITTED', lineText: 'The plate and timestamp are relevant to the driving element. Admitted.' },
        { choice: 'EXCLUDED', lineText: 'A silhouette proves the car moved, not who moved it, and the People\'s inference invites the jury to fill the gap. Excluded.' },
        { choice: 'EXCLUDED', lineText: 'The motion is granted; the intersection camera still is excluded.' },
      ],
    },
  ],
  // [LLM-FILL: CasePayload] — the case-opening summary, written by the final
  // assembly call with all four stage outputs in context.
  summary: 'At 6:40 on an October evening, a sedan clipped Gordon Pyle in the Alder Avenue bike lane, idled for roughly eight seconds, and drove on. Pyle, 58, got a shattered pelvis and two surgeries. The car was Teresa Vaughn\'s — paint transfer and a fitted bumper fragment put that beyond argument — and her license has been suspended since a felony DUI in 2021, a fact she has already been convicted of ignoring once. At 7:04 the next morning her phone opened a repair-quote form: "hit a deer." Vaughn, 41 and three years sober, was driving her son home because her ex missed the custody exchange again. One count is paper: she drove, and she knew she couldn\'t. The other is those eight seconds of engine idle on a doorbell camera that saw nothing — the distance between a woman who hit a deer and a mother who looked in the mirror, saw a man in the bike lane, and chose the child in the passenger seat over the stranger on the ground.',
  // [LLM-FILL: CasePayload] — closing arguments, written by the final
  // assembly call once the evidence and witness stages are complete.
  closingArguments: {
    prosecution: 'Take the counts in order. The license: certified suspension, mailed notice, and a prior conviction for ignoring it — that count was over before opening statements. The felony: her car struck a man hard enough to shatter his pelvis, her engine idled for eight seconds, and she drove on. Eight seconds is not a stop sign — it is a mirror, a man in a bike lane, and a decision. By morning she had a story with antlers in it. The People are not asking the court to punish her bad luck or her ex-husband\'s failures. We are asking the court to say that the man bleeding in the bike lane was owed those eight seconds, and everything after them.',
    defense: 'The People\'s felony case is a sound with no picture. Eight seconds of idle at a four-way stop — their own neutral witness cannot tell you whether that car was fleeing or obeying the sign, and she was looking right at it. "Hit a deer" is not a cover story; it is what Teresa told her sponsor at 7:20 that night, nine hours before any officer knocked, and it is what a person believes when dusk and a bad streetlight and a glancing blow leave her nothing else to go on. Convict her of the license count if the paper demands it — she has never pretended otherwise. But the felony asks whether she knew she left a human being on the ground, and on that question the People have a silhouette, a soundtrack, and a guess.',
  },
};

// [LLM-FILL: PleaNarrative] — both rationales required on an offering band;
// here the defense recommends taking the deal, and the offer reaches the
// bench for judicial review.
const rawVaughnPleaNarrative = {
  prosecutionRationale: 'The license count is arithmetic — certified record, mailed notice, a prior for the identical offense. On the felony, I have her car, her bumper in the road, her phone calling it a deer, and eight seconds of idle that a jury will not forgive. What I don\'t have is a monster: a sober woman, a missed custody exchange, a kid in the car. The offer prices all of it — she pleads to both counts at a real discount, Mr. Pyle gets restitution and is spared testifying from a walker, and nobody pretends those eight seconds didn\'t happen.',
  defenseRationale: 'I can try the felony — the camera saw nothing, the deer is honest confusion, and June Castellanos\'s "breath or two" is a stop sign, not a getaway. But I cannot try the license count, and once a jury hears "suspended, again," the felony gets harder to win in the same room. Teresa has a prison prior; a trial loss means the full term and her son standing outside a locked gym for good this time. She wept when I explained the offer. Then she asked where to sign. I have advised the court she accepts.',
  allocution: 'I\'ve gone over those eight seconds every night since, Your Honor, and I want to be honest with the court even where it doesn\'t help me: I don\'t know what I knew. I felt the hit and I told myself it was a deer, and I have asked myself every day whether I told myself that because it was almost dark, or because my son was in the seat next to me and I couldn\'t afford for it to be anything else. I know I shouldn\'t have been driving at all. I knew it that night. Mr. Pyle was on the ground and whatever I believed, he stayed there after I didn\'t. I\'m sorry in a way I don\'t have better words for. Whatever the court decides, I\'ll carry those eight seconds longer than any sentence.',
  pleaReactions: {
    ACCEPT: [
      { speaker: 'CLERK', text: 'The plea of guilty to both counts is entered and accepted. The matter proceeds to sentencing.' },
      { speaker: 'DEFENSE', text: 'Thank you, Your Honor. We would ask the court to carry the restitution plan and Ms. Vaughn\'s three years of recovery into sentencing.' },
    ],
    REJECT: [
      { speaker: 'PROSECUTION', text: 'Understood, Your Honor. Then the People will call Mr. Pyle after all.' },
      { speaker: 'DEFENSE', text: 'My client understands the court\'s ruling. We are ready for trial, and we renew every objection to the People\'s evidence — starting with that doorbell audio.' },
      { speaker: 'CLERK', text: 'The plea is withdrawn. The matter is set for trial. The parties will be heard on the admissibility of the People\'s evidence.' },
    ],
  },
  pleaRulingOptions: [
    { choice: 'ACCEPT', lineText: 'Two years, five months, and restitution to Mr. Pyle is a serious term honestly arrived at. The plea is accepted.' },
    { choice: 'ACCEPT', lineText: 'Ms. Vaughn, the court will not pretend this comes free. But the agreement is fair and it is final. The plea is accepted; we proceed to sentencing.' },
    { choice: 'REJECT', lineText: 'A struck cyclist, a suspended license driven a second time, and eight seconds unaccounted for — this disposition does not answer it. The plea is rejected. Set the matter for trial.' },
    { choice: 'REJECT', lineText: 'The court is not satisfied this agreement serves the public interest. The plea is rejected. The People will prove their case, or they will not.' },
  ],
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
