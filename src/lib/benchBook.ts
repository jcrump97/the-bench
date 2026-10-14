// The Bench Book: the reference a new judge keeps within reach. Static
// presentation copy — it reads no case data, so it can be opened from the
// docket or mid-trial without revealing anything the record has not.
//
// Written for two readers at once. `plain` is for someone meeting the word
// for the first time; `authority` is for someone who will want to know what
// it rests on. Authorities are cited only where the game actually models the
// rule (a term the game does not model is defined, but carries no citation),
// and `inThisCourt` says how — including where it is simplified, because
// a simplification passed off as the real rule is the one error an attorney
// will not forgive.

export interface BenchBookTerm {
  term: string;
  plain: string;
  authority?: string;
  inThisCourt?: string;
}

export interface BenchBookTermGroup {
  title: string;
  terms: readonly BenchBookTerm[];
}

export const BENCH_BOOK_TERMS: readonly BenchBookTermGroup[] = [
  {
    title: 'The proceeding',
    terms: [
      {
        term: 'Arraignment',
        plain: 'The first hearing: the charges are read and the defendant answers them with a plea, almost always "not guilty" to start.',
        inThisCourt: 'Act 1 opens with it — the clerk calls the case and reads each count, then defense counsel enters the plea.',
      },
      {
        term: 'The People',
        plain: 'The prosecution. In California a criminal case is brought in the name of the People of the State, which is why every case is "People v." the defendant.',
      },
      {
        term: 'Discovery',
        plain: 'Each side must tell the other what evidence and witnesses it has before trial, so nobody is ambushed.',
        authority: 'Cal. Penal Code §§ 1054.1, 1054.3',
        inThisCourt: 'Both sides disclose every exhibit and witness in Act 1 with a short, unverified summary. Full detail unlocks only once the item is offered or the witness is sworn.',
      },
      {
        term: 'Plea bargain',
        plain: 'A deal: the defendant pleads guilty in exchange for a lighter, agreed sentence. The judge does not have to accept it.',
        authority: 'Cal. Penal Code § 1192.5',
        inThisCourt: 'The offer and its terms are computed from the strength of the case, and the defense decides from the defendant’s situation whether to take it. You rule only on a deal both sides have agreed to.',
      },
      {
        term: 'Bench trial',
        plain: 'A trial decided by the judge alone, with no jury.',
        authority: 'Cal. Const., art. I, § 16 (a jury may be waived by consent of both parties in open court)',
        inThisCourt: 'Every trial here is a bench trial — you are the finder of fact. A real felony defendant has a right to a jury and would have to waive it.',
      },
      {
        term: 'Beyond a reasonable doubt',
        plain: 'The standard for a guilty verdict: not "probably," but an abiding conviction that the charge is true. The defendant is presumed innocent until the People meet it.',
        authority: 'Cal. Penal Code § 1096',
        inThisCourt: 'Each count lists its elements, marked supported once an exhibit you admitted speaks to one. Whether that evidence proves the element beyond a reasonable doubt is your call — nothing decides it for you.',
      },
      {
        term: 'Elements',
        plain: 'The separate facts the People must prove for a charge. Miss one and the charge fails, however strong the rest is.',
        inThisCourt: 'Open a charge from the case file to see its elements, and which of them the evidence you admitted supports.',
      },
      {
        term: 'Allocution',
        plain: 'Before sentence is pronounced, the defendant is given the chance to speak to the court.',
        authority: 'Cal. Penal Code § 1200',
        inThisCourt: 'On the plea path the defendant allocutes before you choose the sentence.',
      },
      {
        term: 'Minute order',
        plain: 'The clerk’s written record of what the court did at a hearing — the official summary, not a transcript.',
        inThisCourt: 'Filed under the record when the case closes: the disposition, every ruling, and the sentence read back as consequence.',
      },
    ],
  },
  {
    title: 'Evidence',
    terms: [
      {
        term: 'Exhibit',
        plain: 'A piece of physical or documentary evidence offered to the court — a video, a bank record, a recorded interview.',
      },
      {
        term: 'Relevance',
        plain: 'Evidence is admissible only if it tends to prove or disprove something that matters to the case.',
        authority: 'Cal. Evid. Code §§ 210, 350',
      },
      {
        term: 'Undue prejudice',
        plain: 'A judge may keep out relevant evidence when its power to inflame or mislead substantially outweighs what it actually proves.',
        authority: 'Cal. Evid. Code § 352',
        inThisCourt: 'Each exhibit carries an objection risk. You admit or exclude it, and closing arguments answer to your ruling: an excluded exhibit cannot be argued on its merits.',
      },
      {
        term: 'Miranda warnings',
        plain: 'Before police question someone in custody, they must say: you may stay silent, anything you say can be used against you, and you may have a lawyer.',
        authority: 'Miranda v. Arizona (1966) 384 U.S. 436',
        inThisCourt: 'A recorded interview is played into the record before the defense moves to exclude it. If the warnings or the waiver were defective, the tape can be excluded.',
      },
      {
        term: 'Voluntariness',
        plain: 'A confession is only usable if it was the person’s free choice — not the product of threats, promises, or pressure that overbore their will.',
        authority: 'Jackson v. Denno (1964) 378 U.S. 368',
        inThisCourt: 'When the interview turned on pressure rather than the warnings, this is the ground the defense attacks.',
      },
      {
        term: 'Invoking counsel',
        plain: 'Once a suspect in custody asks for a lawyer, questioning has to stop until the lawyer is there.',
        authority: 'Edwards v. Arizona (1981) 451 U.S. 477',
        inThisCourt: 'A defendant who asks for a lawyer at once produces no interview — so no tape exists to fight over.',
      },
      {
        term: 'Direct and cross-examination',
        plain: 'Direct is the questioning of a witness by the side that called them; cross is the other side’s chance to test that testimony.',
        authority: 'Cal. Evid. Code §§ 760, 761',
        inThisCourt: 'Which side calls a witness follows whose case the witness helps. Counsel may decline to cross.',
      },
    ],
  },
  {
    title: 'Sentencing',
    terms: [
      {
        term: 'Felony, misdemeanor, infraction',
        plain: 'The three grades of crime, from most to least serious. A felony can mean state prison; a misdemeanor, up to a year in county jail; an infraction, a fine.',
        authority: 'Cal. Penal Code §§ 16, 17',
      },
      {
        term: 'Wobbler',
        plain: 'A crime that can be charged or sentenced as either a felony or a misdemeanor, at the court’s discretion.',
        // No authority: the game does not model the election, and citing the
        // statute beside a rule it does not apply would pass a simplification
        // off as the law.
        inThisCourt: 'Not yet modeled as a choice: where a count could be prison or jail, prison governs. (This is a known simplification.)',
      },
      {
        term: 'Statutory range',
        plain: 'The lightest and heaviest sentence the law allows for a crime. The judge chooses a term inside it.',
        inThisCourt: 'The sentencing form only lets you choose inside the range of the counts you can sentence on — every count on a plea, only the counts of conviction after trial.',
      },
      {
        term: 'Mandatory minimum',
        plain: 'A floor set by law: the court cannot go below it, however sympathetic the case.',
      },
      {
        term: 'Prison and county jail',
        plain: 'State prison holds people serving longer felony terms; county jail holds misdemeanor terms and some felony terms after California’s 2011 realignment.',
        inThisCourt: 'Each count’s statutory range already says where its time is served. Which felonies realignment sends to county jail is not modeled.',
      },
      {
        term: 'Aggregate term',
        plain: 'When someone is sentenced on several counts at once, the terms combine into one commitment rather than separate sentences served in different places.',
        authority: 'Cal. Penal Code § 669',
        inThisCourt: 'A case that mixes prison and jail counts is sentenced as one prison commitment.',
      },
      {
        term: 'Probation',
        plain: 'Supervision in the community instead of custody, with conditions the person must follow.',
        authority: 'Cal. Penal Code § 1203',
      },
    ],
  },
];

// Where this court departs from a real California courtroom. Listed plainly so
// nobody mistakes a game mechanic for the law.
export const SIMPLIFICATIONS: readonly string[] = [
  'Every trial is a bench trial. You decide guilt alone; there is no jury to waive or instruct.',
  'There is no preliminary hearing, and no pretrial motions beyond one admissibility ruling per exhibit.',
  'You accept or reject a plea deal; you do not negotiate its terms or offer an indicated sentence.',
  'A wobbler’s choice between prison and county jail is not yet modeled — prison governs.',
  'Custody credits, restitution, sentence enhancements and prior-strike law are not modeled.',
  'Sentences are chosen as a single term inside the aggregate range, not count by count as consecutive or concurrent terms.',
];

// How the game is built, for the reader who wants to know. The one-sentence
// version of the architecture: the model provides color, code provides
// structure.
export const UNDER_THE_HOOD: readonly { heading: string; body: string }[] = [
  {
    heading: 'The model writes the words',
    body: 'People, places and dialogue — the scene, the defendant’s life, testimony, counsel’s arguments, the press coverage. On the docket these were written by hand; with your own Gemini key, they are generated fresh.',
  },
  {
    heading: 'Code decides the structure',
    body: 'Whether there is a plea offer and on what terms, whether the defense takes it, what the interview room produced, the sentencing range, the order of the record, and which closing points survive your rulings. All of it is computed, the same way, every time — the model is never asked.',
  },
  {
    heading: 'Nothing unchecked reaches the game',
    body: 'Every generated response is validated against a strict schema before it touches game state. A response that fails is sent back with the reasons and repaired; a case that still fails ends in a mistrial rather than in a broken courtroom.',
  },
  {
    heading: 'Your key stays with you',
    body: 'There is no server. Your key is held in memory for this tab only, sent straight to Google in a request header, and never stored. Only the closed record of a case is saved, in this browser.',
  },
];
