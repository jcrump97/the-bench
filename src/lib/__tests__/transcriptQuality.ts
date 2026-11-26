import {
  buildCourtroomScript,
  type ScriptBeat,
  type StatementBeat,
  type StatementEntryKind,
} from '../courtroomScript';
import { computePleaPostureForCase } from '../pleaAssessment';
import { deriveSentencingExposure, selectSentenceableCharges } from '../sentencingExposure';
import type { AftermathContext } from '../caseSource';
import type {
  CasePayload,
  ChargeVerdict,
  MotionRuling,
  PleaDecision,
  PleaNarrative,
  PleaPosture,
  Sentence,
} from '../../schemas/gameSchemas';

// ============================================================================
// Reads a case the way a player meets it: as the transcript the courtroom
// actually plays, end to end, down one branch at a time.
//
// The schemas gate shape and a few hard rules (no jury, the defendant's name).
// They cannot see whether the record *reads*: a closing that stops mid-word,
// a witness who repeats the same sentence, testimony written as a Q&A script
// instead of spoken from the stand, an Act 2 where the defense never objects
// to anything, or a witness recounting a confession the court just threw out.
// Those are the failures that make a generated trial dull or wrong, and none
// of them is a schema violation.
//
// Two callers. The live suite runs these checks over a freshly generated case
// (src/lib/llm/__tests__/live/gameService.live.test.ts). The hermetic suite
// runs them over the hand-authored demo docket (transcriptQuality.test.ts),
// which is what proves the checks themselves: content written and reviewed by
// a person must pass, so a check that fires on the demo docket is a bad check,
// not a bad case.
// ============================================================================

export type PlaythroughPath = 'PLEA_ACCEPTED' | 'CONVICTED_ALL_ADMITTED' | 'ACQUITTED_ALL_EXCLUDED';

export const PLAYTHROUGH_PATHS: readonly PlaythroughPath[] = [
  'PLEA_ACCEPTED',
  'CONVICTED_ALL_ADMITTED',
  'ACQUITTED_ALL_EXCLUDED',
];

export interface PlaythroughPlan {
  path: PlaythroughPath;
  posture: PleaPosture;
  pleaDecision: PleaDecision | null;
  motionRulings: MotionRuling[];
  chargeVerdicts: ChargeVerdict[];
  imposedSentence: Sentence[];
}

// The decisions a judge would enter to reach the end of one branch. Returns
// null when the case cannot go down that branch: only a posture pending the
// court's review puts a plea before the judge.
export function planPlaythrough(
  caseData: CasePayload,
  narrative: PleaNarrative,
  path: PlaythroughPath,
): PlaythroughPlan | null {
  const { posture } = computePleaPostureForCase(caseData, narrative);
  const offerBeforeCourt = posture.status === 'PENDING_JUDICIAL_REVIEW';

  if (path === 'PLEA_ACCEPTED') {
    if (posture.status !== 'PENDING_JUDICIAL_REVIEW') return null;
    return {
      path,
      posture,
      pleaDecision: 'ACCEPT',
      motionRulings: [],
      chargeVerdicts: [],
      imposedSentence: posture.proposedSentence,
    };
  }

  const ruling = path === 'CONVICTED_ALL_ADMITTED' ? 'ADMITTED' : 'EXCLUDED';
  const verdict = path === 'CONVICTED_ALL_ADMITTED' ? 'GUILTY' : 'NOT_GUILTY';
  const chargeVerdicts: ChargeVerdict[] = caseData.charges.map((charge) => ({
    chargeId: charge.id,
    chargeName: charge.name,
    classification: charge.classification,
    verdict,
  }));
  // The statutory maximum on every count of conviction: a legal sentence the
  // picker allows, and the one whose aftermath has the most to answer for.
  const imposedSentence = verdict === 'GUILTY'
    ? deriveSentencingExposure(selectSentenceableCharges(caseData.charges, false, chargeVerdicts)).maximumPenalties
    : [];

  return {
    path,
    posture,
    pleaDecision: offerBeforeCourt ? 'REJECT' : null,
    motionRulings: caseData.evidence.map((e) => ({ evidenceId: e.id, ruling })),
    chargeVerdicts,
    imposedSentence,
  };
}

// The same context SentencingControl hands generateAftermath at the close.
export function aftermathContextFor(caseData: CasePayload, plan: PlaythroughPlan): AftermathContext {
  return {
    caseData,
    pleaDecision: plan.pleaDecision,
    verdict: plan.path === 'PLEA_ACCEPTED' ? null : plan.chargeVerdicts,
    imposedSentence: plan.imposedSentence,
    motionRulings: plan.motionRulings,
  };
}

// Every beat the player reads on this branch, from the clerk's call to the
// press, with every decision resolved.
export function playTranscript(
  caseData: CasePayload,
  narrative: PleaNarrative,
  plan: PlaythroughPlan,
  aftermath: string,
): ScriptBeat[] {
  return buildCourtroomScript({
    caseData,
    pleaNarrative: narrative,
    pleaPosture: plan.posture,
    currentPhase: 'END_STATE',
    pleaDecision: plan.pleaDecision,
    motionRulings: plan.motionRulings,
    chargeVerdicts: plan.chargeVerdicts,
    imposedSentence: plan.imposedSentence,
    aftermathNarrative: aftermath,
    spokenJudgeLines: {},
  });
}

const statements = (beats: ScriptBeat[]): StatementBeat[] =>
  beats.filter((b): b is StatementBeat => b.kind === 'STATEMENT');

// Built by code from structured fields (the case call, a charge's name, a
// formatted sentence), not written by anyone, so they are not held to prose
// rules like closing punctuation.
const STRUCTURAL_KINDS: ReadonlySet<StatementEntryKind> = new Set([
  'CASE_OPENED',
  'CHARGE_READ',
  'ARRAIGNMENT_PLEA',
  'SENTENCE_IMPOSED',
]);

// The long-form beats a player actually reads for substance. Two of them
// saying the same thing word for word is the record padding itself out.
const SUBSTANTIVE_KINDS: ReadonlySet<StatementEntryKind> = new Set([
  'STATEMENT_OF_FACTS',
  'TESTIMONY_DIRECT',
  'TESTIMONY_CROSS',
  'CLOSING_ARGUMENT',
  'ALLOCUTION',
  'AFTERMATH',
]);

const TESTIMONY_KINDS: ReadonlySet<StatementEntryKind> = new Set(['TESTIMONY_DIRECT', 'TESTIMONY_CROSS']);

// Kept in step with gameSchemas.ts's JURY_PATTERN. Re-checked over the whole
// played transcript, headings included, because the schema only guards the
// fields it was attached to.
const JURY_PATTERN = /\bjur(?:y|ies|or|ors)\b|\bfore(?:man|men|woman|women|person|persons)\b|\bvoir dire\b/i;

// Leftovers of a template or a serializer that should never reach a player.
const ARTIFACT_PATTERN =
  /\bundefined\b|\bNaN\b|\[object Object\]|\{\{|\}\}|\bTODO\b|\bTBD\b|lorem ipsum|\[(?:name|defendant|witness|insert)[^\]]*\]|<[a-z][^>]*>/i;

// A sentence of prose ends with punctuation, possibly inside a closing quote
// or bracket. Anything else is a cut-off: the model ran out of budget, or a
// field was filled with a fragment.
const TERMINAL = /[.!?…]["'”’)\]]*$/;

// Testimony is spoken from the stand, in the first person.
const FIRST_PERSON = /\b(?:I|I'm|I've|I'd|I'll|me|my|mine|myself|we|our|us)\b/i;

// A transcript in Q-and-A form ("Q: Where were you?") instead of the
// witness's own continuous account. The schema asks for no counsel questions.
const QA_SCRIPT = /(?:^|\n)\s*(?:Q|A|Question|Answer)\s*[:.]\s/;

function norm(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function sentencesOf(text: string): string[] {
  return text.split(/(?<=[.!?…])\s+/).map(norm).filter((s) => s.length > 0);
}

function label(beat: StatementBeat): string {
  return `${beat.entryKind}${beat.speakerName ? ` (${beat.speakerName})` : ''} [${beat.id}]`;
}

function excerpt(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 90 ? `…${flat.slice(-90)}` : flat;
}

// Prose-level problems in a played transcript. Empty means it reads clean.
// Each entry names the beat, so a failing live run says exactly what to fix.
export function auditTranscript(beats: ScriptBeat[]): string[] {
  const problems: string[] = [];
  const said = statements(beats);

  if (beats.some((b) => b.kind === 'DECISION')) {
    problems.push('transcript stops at an unresolved decision; the playthrough did not reach the end');
  }
  if (said.at(-1)?.entryKind !== 'AFTERMATH') {
    problems.push('transcript does not end with the aftermath');
  }

  const seenSubstantive = new Map<string, string>();
  const testimonyByWitness = new Map<string, string>();
  for (const beat of said) {
    const body = beat.body.trim();
    const where = label(beat);

    if (body.length === 0) {
      problems.push(`${where}: empty`);
      continue;
    }
    if (JURY_PATTERN.test(body) || JURY_PATTERN.test(beat.heading)) {
      problems.push(`${where}: refers to a jury in a bench trial`);
    }
    const artifact = ARTIFACT_PATTERN.exec(body);
    if (artifact) problems.push(`${where}: template or serializer artifact "${artifact[0]}"`);

    if (!STRUCTURAL_KINDS.has(beat.entryKind) && !TERMINAL.test(body)) {
      problems.push(`${where}: looks cut off — "${excerpt(body)}"`);
    }

    // The model looping: the same full sentence twice inside one beat.
    const seenSentences = new Set<string>();
    for (const sentence of sentencesOf(body)) {
      if (sentence.split(' ').length < 6) continue;
      if (seenSentences.has(sentence)) problems.push(`${where}: repeats the sentence "${sentence}"`);
      seenSentences.add(sentence);
    }

    if (SUBSTANTIVE_KINDS.has(beat.entryKind)) {
      const key = norm(body);
      const earlier = seenSubstantive.get(key);
      if (earlier !== undefined) problems.push(`${where}: word for word the same as ${earlier}`);
      else seenSubstantive.set(key, where);
    }

    if (TESTIMONY_KINDS.has(beat.entryKind)) {
      if (!beat.speakerName) problems.push(`${where}: testimony with no named witness`);
      else testimonyByWitness.set(beat.speakerName, `${testimonyByWitness.get(beat.speakerName) ?? ''} ${body}`);
      if (QA_SCRIPT.test(body)) problems.push(`${where}: testimony written as a Q-and-A script`);
    }
  }

  // Judged per witness, across direct and cross together: an officer may
  // recite a lab finding on direct without once saying "I" (the demo docket's
  // Sgt. Kirby does), but a witness who never speaks as themselves anywhere
  // on the stand is being narrated, not heard.
  for (const [witness, testimony] of testimonyByWitness) {
    if (!FIRST_PERSON.test(testimony)) problems.push(`${witness}: never speaks in the first person on the stand`);
  }

  return problems;
}

// Problems with the case as a game: does it give the judge real decisions,
// and does the room answer them with variety? A case can be schema-valid and
// still be a trial where nothing is contested and every ruling sounds alike.
export function auditCase(caseData: CasePayload): string[] {
  const problems: string[] = [];

  // Act 2 is the judge ruling on fights. If the defense waives every exhibit,
  // the act is a run of rubber stamps.
  if (!caseData.evidence.some((e) => e.defenseObjection !== null)) {
    problems.push('the defense objects to no exhibit, so Act 2 has nothing contested to rule on');
  }
  // Testimony with no cross-examination anywhere is a one-sided trial.
  if (!caseData.witnesses.some((w) => w.crossExamination !== null)) {
    problems.push('no witness is cross-examined');
  }

  const dupes = (values: string[]): string[] => {
    const seen = new Set<string>();
    return values.filter((v) => {
      const k = norm(v);
      if (seen.has(k)) return true;
      seen.add(k);
      return false;
    });
  };
  for (const name of dupes(caseData.witnesses.map((w) => w.name))) problems.push(`two witnesses share the name "${name}"`);
  for (const name of dupes(caseData.evidence.map((e) => e.name))) problems.push(`two exhibits share the name "${name}"`);

  for (const w of caseData.witnesses) {
    if (w.crossExamination !== null && norm(w.crossExamination) === norm(w.directExamination)) {
      problems.push(`witness ${w.id}: cross-examination repeats the direct word for word`);
    }
  }
  if (norm(caseData.closingArguments.prosecution) === norm(caseData.closingArguments.defense)) {
    problems.push('both closing arguments are the same text');
  }

  // The judge's choices: each option should be a different line, or the
  // choice of words is no choice at all.
  const optionSets: [string, { lineText: string }[]][] = [
    ...caseData.evidence.map((e): [string, { lineText: string }[]] => [`exhibit ${e.id} ruling options`, e.rulingOptions]),
    ...caseData.charges.map((c): [string, { lineText: string }[]] => [`charge ${c.id} verdict options`, c.verdictOptions]),
  ];
  for (const [where, options] of optionSets) {
    for (const line of dupes(options.map((o) => o.lineText))) problems.push(`${where}: "${line}" offered twice`);
  }

  // Opposite rulings should not draw the same reaction from the room.
  const reactionText = (lines: { text: string }[]) => norm(lines.map((l) => l.text).join(' '));
  for (const e of caseData.evidence) {
    if (reactionText(e.rulingReactions.ADMITTED) === reactionText(e.rulingReactions.EXCLUDED)) {
      problems.push(`exhibit ${e.id}: the room reacts the same way to admission and exclusion`);
    }
  }
  for (const c of caseData.charges) {
    if (reactionText(c.verdictReactions.GUILTY) === reactionText(c.verdictReactions.NOT_GUILTY)) {
      problems.push(`charge ${c.id}: the room reacts the same way to guilty and not guilty`);
    }
  }

  // A closing fragment that reads the same either way is not answering the ruling.
  for (const point of caseData.closingArguments.exhibitPoints ?? []) {
    for (const side of ['prosecution', 'defense'] as const) {
      const admitted = point.ifAdmitted[side];
      const excluded = point.ifExcluded[side];
      if (admitted !== null && excluded !== null && norm(admitted) === norm(excluded)) {
        problems.push(`closing ${side} on exhibit ${point.evidenceId}: same text whether admitted or excluded`);
      }
    }
  }

  return problems;
}

// Long enough that a scene fact the defendant and a witness both describe
// ("it was almost dark, the streetlights weren't on" appears in the demo
// docket's tape *and* in a neighbor's cross) does not count as quoting the
// tape; short enough to catch a sentence lifted from it.
const QUOTE_RUN = 10;

function shingles(text: string): Set<string> {
  const words = norm(text).split(' ').filter((w) => w.length > 0);
  const out = new Set<string>();
  for (let i = 0; i + QUOTE_RUN <= words.length; i++) out.add(words.slice(i, i + QUOTE_RUN).join(' '));
  return out;
}

// A witness recounting what the defendant said in custody. Verbatim overlap
// alone misses a paraphrase, and a paraphrase is how the live failure looked.
const RECOUNTS_INTERVIEW =
  /\bconfess(?:ed|es|ion)\b|\btold (?:me|us|detectives?|investigators?|(?:the )?police|officers?) (?:that )?(?:he|she|they)\b|\b(?:during|in) (?:the|his|her|their|my|our) (?:interview|interrogation)\b|\b(?:interview|interrogation) (?:tape|recording|room)\b/i;

// Does the record, after the court has excluded a recorded interview, still
// carry it? Two signs: testimony recounting what the defendant said in the
// interview, or a run of words lifted from the defendant's side of the tape
// into testimony or a closing. Either is the tape reaching the record by
// another door — the exact failure a live run produced, with a detective
// recounting a confession the court had suppressed.
export function auditRulingsRespected(beats: ScriptBeat[], caseData: CasePayload, plan: PlaythroughPlan): string[] {
  const excludedTapes = caseData.evidence.filter(
    (e) => e.interrogation !== undefined
      && plan.motionRulings.some((r) => r.evidenceId === e.id && r.ruling === 'EXCLUDED'),
  );
  if (excludedTapes.length === 0) return [];

  const tape = new Set<string>();
  for (const e of excludedTapes) {
    for (const line of e.interrogation?.lines ?? []) {
      if (line.speaker === 'DEFENDANT') for (const s of shingles(line.text)) tape.add(s);
    }
  }

  const problems: string[] = [];
  for (const beat of statements(beats)) {
    const testimony = TESTIMONY_KINDS.has(beat.entryKind);
    if (!testimony && beat.entryKind !== 'CLOSING_ARGUMENT') continue;
    const quoted = [...shingles(beat.body)].find((s) => tape.has(s));
    if (quoted !== undefined) problems.push(`${label(beat)}: quotes the excluded interview — "${quoted}"`);
    const recounted = testimony ? RECOUNTS_INTERVIEW.exec(beat.body) : null;
    if (recounted) problems.push(`${label(beat)}: recounts the excluded interview — "${recounted[0]}"`);
  }
  return problems;
}

// True when the case carries per-exhibit testimony that answers the motion
// rulings (the mechanism that keeps an excluded exhibit out of testimony).
// Until a case has it, testimony is fixed text written before any ruling, so
// an excluded tape leaking into it is a known gap to measure, not a
// regression to fail on.
export function hasRulingConditionedTestimony(caseData: CasePayload): boolean {
  return caseData.witnesses.some((w) => 'exhibitTestimony' in w && (w as { exhibitTestimony?: unknown }).exhibitTestimony !== undefined);
}
