import {
  type CasePayload,
  type PleaNarrative,
  type PleaPosture,
  type PleaDecision,
  type MotionRuling,
  type ChargeVerdict,
  type GamePhase,
  type Sentence,
} from '../schemas/gameSchemas';
import { formatSentence, enumLabel } from './format';

// ============================================================================
// The courtroom script: the single source of courtroom truth.
//
// buildCourtroomScript is a pure, deterministic projection (successor to
// buildLedger) that emits the case as an ordered screenplay of beats. A beat
// is either a STATEMENT — one speaker-attributed line of the court record —
// or a DECISION — a point where the script pauses for the judge (the player).
//
// Two invariants everything downstream relies on:
//
// 1. No spoilers: emission stops at the first unresolved DECISION. Nothing
//    after the pending decision exists yet, so the UI cannot leak it.
// 2. Prefix stability: committing a decision never changes any beat at an
//    earlier index. A resolved decision is replaced in place by the COURT
//    statement recording the ruling (1:1), and new beats only ever append
//    after it. The reveal cursor can therefore trust its own past.
// ============================================================================

export type StatementEntryKind =
  | 'CASE_OPENED'
  | 'CHARGE_READ'
  | 'ARRAIGNMENT_PLEA'
  | 'STATEMENT_OF_FACTS'
  | 'DISCOVERY_EXHIBIT'
  | 'DISCOVERY_WITNESS'
  | 'PLEA_OFFER'
  | 'PLEA_DEFENSE_RESPONSE'
  | 'PLEA_DECISION'
  | 'PLEA_REACTION'
  | 'EXHIBIT_OFFERED'
  | 'INTERROGATION_PLAYBACK'
  | 'EXHIBIT_OBJECTION'
  | 'MOTION_RULING'
  | 'MOTION_REACTION'
  | 'TESTIMONY_DIRECT'
  | 'TESTIMONY_CROSS'
  | 'CLOSING_ARGUMENT'
  | 'ALLOCUTION'
  | 'VERDICT'
  | 'VERDICT_REACTION'
  | 'SENTENCE_IMPOSED'
  | 'AFTERMATH';

// Who is speaking. The record is assembled from the parties' own
// presentations — the attorneys argue, witnesses testify, the court speaks
// only through its rulings, the press reports the aftermath. No beat is
// voiced by an omniscient narrator.
export type LedgerSpeaker = 'CLERK' | 'PROSECUTION' | 'DEFENSE' | 'WITNESS' | 'COURT' | 'PRESS';

// The case-file item a beat presents, when it presents one. Stamped at
// emission on discovery and presentation beats; downstream this one field
// powers both the progressive reveal (what has the judge lawfully seen) and
// the transcript's click-through to the item's detail view. Never stored —
// like every beat property, it is a pure projection of validated state.
export interface BeatSubject {
  type: 'EVIDENCE' | 'WITNESS' | 'CHARGE';
  id: string;
}

export interface StatementBeat {
  kind: 'STATEMENT';
  id: string;
  entryKind: StatementEntryKind;
  phase: GamePhase;
  speaker: LedgerSpeaker;
  // The individual speaking, when the party role isn't identity enough: the
  // witness on the stand, the defendant allocuting. The transcript leads the
  // utterance with this name; absent, the party label (speaker) speaks.
  speakerName?: string;
  // Set only on TESTIMONY_DIRECT: which side called this witness (derived
  // from bias). The transcript's caption still needs this even though the
  // speaker leads with the witness's own name — it's the only place that
  // side is visible once the heading is demoted.
  calledByDefense?: boolean;
  // The item this beat presents (an exhibit disclosed or offered, a witness
  // disclosed or testifying, a charge read or called). Absent on beats that
  // present nothing (reactions, closings, the aftermath).
  subject?: BeatSubject;
  // Monotonic sequence index, NOT a wall-clock timestamp — the script is a
  // pure projection and must never call Date.now().
  order: number;
  heading: string;
  body: string;
}

export type DecisionPoint =
  | { type: 'PLEA_RULING'; hasOffer: boolean }
  | { type: 'MOTION_RULING'; evidenceId: string }
  | { type: 'CHARGE_VERDICT'; chargeId: string }
  | { type: 'SENTENCING'; anyGuilty: boolean };

export interface DecisionBeat {
  kind: 'DECISION';
  id: string;
  phase: GamePhase;
  order: number;
  decision: DecisionPoint;
}

export type ScriptBeat = StatementBeat | DecisionBeat;

export interface BuildCourtroomScriptInput {
  caseData: CasePayload;
  pleaNarrative: PleaNarrative | null;
  pleaPosture: PleaPosture | null;
  currentPhase: GamePhase;
  pleaDecision: PleaDecision | null;
  motionRulings: MotionRuling[];
  chargeVerdicts: ChargeVerdict[];
  imposedSentence: Sentence[];
  aftermathNarrative: string | null;
  // The judge's chosen line per decision-point id ('plea' | `motion-${id}` |
  // `verdict-${id}`) — the store's voice record. Display color only: outcomes
  // are always read off the structural decisions, and a missing key falls
  // back to the first authored option matching the recorded choice, so the
  // record stays total even if the voice record is lost.
  spokenJudgeLines: Record<string, string>;
}

// Phase ordering for "has the case moved past Act 1" checks. On the NO_OFFER
// and REJECTED_BY_DEFENSE paths the trial order writes no decision record —
// only the phase advances — so resolution is read off the phase itself.
// Exported for the Continue control, which fires the same one-way phase
// transitions when the reveal crosses an act boundary.
export const PHASE_RANK: Record<GamePhase, number> = {
  WELCOME: 0,
  ACT_1_INTAKE: 1,
  ACT_2_MOTIONS: 2,
  ACT_3_VERDICT: 3,
  END_STATE: 4,
  ERROR_STATE: -1,
};

const REACTION_HEADINGS = {
  PROSECUTION: 'The People Respond',
  DEFENSE: 'The Defense Responds',
  CLERK: 'The Clerk Notes the Record',
} as const;

function describeOffer(
  caseData: CasePayload,
  posture: Extract<PleaPosture, { status: 'REJECTED_BY_DEFENSE' | 'PENDING_JUDICIAL_REVIEW' }>,
): string {
  const findChargeName = (chargeId: string): string =>
    caseData.charges.find((c) => c.id === chargeId)?.name ?? 'Unknown charge';
  const pleadsTo = posture.pleadsToChargeIds.map(findChargeName).join(', ');
  const dismissed = posture.dismissedChargeIds.length > 0
    ? ` Dismissed: ${posture.dismissedChargeIds.map(findChargeName).join(', ')}.`
    : '';
  const sentence = posture.proposedSentence.map(formatSentence).join('; ');
  return `Pleads to: ${pleadsTo}. Proposed sentence: ${sentence}.${dismissed} ${posture.prosecutionRationale}`;
}

// The court's voiced line for a resolved decision: what the judge actually
// said (the store's voice record), else the first authored option matching
// the recorded choice — deterministic and total, since the schemas' coverage
// refinement guarantees every choice has at least one option.
// Assembles one side's closing argument from the base text plus its
// per-exhibit fragments, picking each fragment's ifAdmitted/ifExcluded
// variant off the ruling the player actually entered — so the argument can
// never reference an exhibit's merits under a ruling that didn't happen. An
// exhibit with no ruling on record (the plea path, where Act 2 never ran)
// defaults to ADMITTED: nothing was litigated, so nothing was suppressed.
// Absent `exhibitPoints` (hand-authored demo cases) leaves the base text
// untouched — those are already internally consistent by construction.
function assembleClosingArgument(
  base: string,
  exhibitPoints: CasePayload['closingArguments']['exhibitPoints'],
  motionRulings: MotionRuling[],
  side: 'prosecution' | 'defense',
): string {
  if (exhibitPoints === undefined) return base;
  const fragments = exhibitPoints
    .map((point) => {
      const ruling = motionRulings.find((r) => r.evidenceId === point.evidenceId)?.ruling ?? 'ADMITTED';
      const variant = ruling === 'ADMITTED' ? point.ifAdmitted : point.ifExcluded;
      return variant[side];
    })
    .filter((text): text is string => text !== null && text.length > 0);
  return [base, ...fragments].join(' ');
}

function spokenLine(
  recorded: string | undefined,
  options: readonly { choice: string; lineText: string }[] | undefined,
  choice: string,
): string | undefined {
  return recorded ?? options?.find((o) => o.choice === choice)?.lineText;
}

// This is a display projection, not a validator: unlike
// sentencingModifierFromRulings (which throws on an unknown evidenceId
// because it gates a sentencing calculation), an unresolvable id here just
// falls back to a label — nothing downstream depends on rejecting bad input.
export function buildCourtroomScript(input: BuildCourtroomScriptInput): ScriptBeat[] {
  const {
    caseData,
    pleaPosture,
    currentPhase,
    pleaDecision,
    motionRulings,
    chargeVerdicts,
    imposedSentence,
    aftermathNarrative,
    spokenJudgeLines,
  } = input;

  const beats: ScriptBeat[] = [];
  const pushStatement = (beat: Omit<StatementBeat, 'kind' | 'order'>) => {
    beats.push({ ...beat, kind: 'STATEMENT', order: beats.length });
  };
  const pushDecision = (beat: Omit<DecisionBeat, 'kind' | 'order'>) => {
    beats.push({ ...beat, kind: 'DECISION', order: beats.length });
  };

  // ---- Act 1: called, arraigned, the facts stated, discovery disclosed -----
  // The clerk only performs procedure: the call and the charges. The facts
  // of the case belong to the People (STATEMENT_OF_FACTS), and every item of
  // evidence and every witness is disclosed by counsel — briefly and
  // unverified — before any plea lands, so the judge rules knowing what
  // discovery holds and nothing more.
  const defendantName = `${caseData.defendant.firstName} ${caseData.defendant.lastName}`;
  pushStatement({
    id: 'case-opened',
    entryKind: 'CASE_OPENED',
    phase: 'ACT_1_INTAKE',
    speaker: 'CLERK',
    heading: 'Case Called',
    body: `Calling case ${caseData.caseId}, the People of the State of California v. ${defendantName}.`,
  });

  for (const charge of caseData.charges) {
    pushStatement({
      id: `charge-read-${charge.id}`,
      entryKind: 'CHARGE_READ',
      phase: 'ACT_1_INTAKE',
      speaker: 'CLERK',
      heading: 'The Clerk Reads the Charge',
      subject: { type: 'CHARGE', id: charge.id },
      body: `Count ${caseData.charges.indexOf(charge) + 1}: ${charge.name}, a ${enumLabel(charge.classification).toLowerCase()}.`,
    });
  }

  pushStatement({
    id: 'arraignment-plea',
    entryKind: 'ARRAIGNMENT_PLEA',
    phase: 'ACT_1_INTAKE',
    speaker: 'DEFENSE',
    heading: 'Arraignment',
    body: `Your Honor, on behalf of ${defendantName}, the defense waives further reading of the complaint and advisement of rights, and enters a plea of not guilty to all counts.`,
  });

  pushStatement({
    id: 'statement-of-facts',
    entryKind: 'STATEMENT_OF_FACTS',
    phase: 'ACT_1_INTAKE',
    speaker: 'PROSECUTION',
    heading: 'Statement of the Case',
    body: caseData.statementOfFacts,
  });

  for (const evidence of caseData.evidence) {
    pushStatement({
      id: `discovery-${evidence.id}`,
      entryKind: 'DISCOVERY_EXHIBIT',
      phase: 'ACT_1_INTAKE',
      speaker: 'PROSECUTION',
      heading: `The People Disclose: ${evidence.name}`,
      subject: { type: 'EVIDENCE', id: evidence.id },
      body: evidence.disclosureSummary,
    });
  }

  for (const witness of caseData.witnesses) {
    // Disclosure follows the same side derivation as trial testimony: the
    // People disclose their own and neutral witnesses, the defense its own.
    const disclosedByDefense = witness.bias === 'DEFENSE';
    pushStatement({
      id: `discovery-witness-${witness.id}`,
      entryKind: 'DISCOVERY_WITNESS',
      phase: 'ACT_1_INTAKE',
      speaker: disclosedByDefense ? 'DEFENSE' : 'PROSECUTION',
      heading: `${disclosedByDefense ? 'The Defense Discloses' : 'The People Disclose'}: ${witness.name}`,
      subject: { type: 'WITNESS', id: witness.id },
      body: witness.statement,
    });
  }

  if (pleaPosture === null) {
    // No posture means no plea narrative was loaded — the script cannot
    // proceed past discovery. (Reachable only in tests; the store hydrates
    // case and narrative together.)
    return beats;
  }

  if (pleaPosture.status === 'NO_OFFER') {
    pushStatement({
      id: 'plea-offer',
      entryKind: 'PLEA_OFFER',
      phase: 'ACT_1_INTAKE',
      speaker: 'PROSECUTION',
      heading: 'The People Decline to Offer a Plea',
      body: pleaPosture.prosecutionRationale,
    });
  } else {
    pushStatement({
      id: 'plea-offer',
      entryKind: 'PLEA_OFFER',
      phase: 'ACT_1_INTAKE',
      speaker: 'PROSECUTION',
      heading: "The People's Offer",
      body: describeOffer(caseData, pleaPosture),
    });
    pushStatement({
      id: 'plea-defense-response',
      entryKind: 'PLEA_DEFENSE_RESPONSE',
      phase: 'ACT_1_INTAKE',
      speaker: 'DEFENSE',
      heading: pleaPosture.status === 'PENDING_JUDICIAL_REVIEW'
        ? 'Defense Accepts the Offer'
        : 'Defense Rejects the Offer',
      body: pleaPosture.defenseRationale,
    });
  }

  // The judge's Act 1 decision. A live offer (PENDING_JUDICIAL_REVIEW) is
  // ruled on and recorded as pleaDecision; on the other postures the only
  // available order is "to trial", which writes no decision record — the
  // phase advancing past Act 1 is the resolution.
  const hasOffer = pleaPosture.status === 'PENDING_JUDICIAL_REVIEW';
  const pleaRulingResolved = pleaDecision !== null || PHASE_RANK[currentPhase] > PHASE_RANK.ACT_1_INTAKE;
  if (!pleaRulingResolved) {
    pushDecision({
      id: 'plea-ruling',
      phase: 'ACT_1_INTAKE',
      decision: { type: 'PLEA_RULING', hasOffer },
    });
    return beats;
  }

  pushStatement({
    id: 'plea-ruling',
    entryKind: 'PLEA_DECISION',
    phase: 'ACT_1_INTAKE',
    speaker: 'COURT',
    heading: pleaDecision === 'ACCEPT'
      ? 'Judge Accepts the Plea'
      : pleaDecision === 'REJECT'
        ? 'Judge Rejects the Plea — Trial Ordered'
        : 'Trial Ordered',
    body: (pleaDecision !== null
      ? spokenLine(spokenJudgeLines['plea'], input.pleaNarrative?.pleaRulingOptions, pleaDecision)
      : undefined)
      ?? (pleaDecision === 'ACCEPT'
        ? 'The court accepts the negotiated plea and proceeds directly to sentencing.'
        : pleaDecision === 'REJECT'
          ? 'The court rejects the negotiated plea and orders the case to trial.'
          : 'With no plea before the bench, the court orders the case to trial.'),
  });

  // The parties' voiced reaction to the plea ruling. Only a ruled-on offer
  // draws one (pleaReactions is authored exactly when the posture puts an
  // offer before the bench); the offer-less trial order passes in silence.
  const pleaReaction = pleaDecision !== null
    ? input.pleaNarrative?.pleaReactions?.[pleaDecision]
    : undefined;
  pleaReaction?.forEach((line, index) => {
    pushStatement({
      id: `plea-reaction-${index}`,
      entryKind: 'PLEA_REACTION',
      phase: 'ACT_1_INTAKE',
      speaker: line.speaker,
      heading: REACTION_HEADINGS[line.speaker],
      body: line.text,
    });
  });

  if (pleaDecision === 'ACCEPT') {
    // ---- Act 3, plea path: allocution, then sentencing ----------------------
    const allocution = input.pleaNarrative?.allocution;
    if (allocution !== undefined) {
      pushStatement({
        id: 'allocution',
        entryKind: 'ALLOCUTION',
        phase: 'ACT_3_VERDICT',
        speaker: 'DEFENSE',
        speakerName: `${caseData.defendant.firstName} ${caseData.defendant.lastName}`,
        heading: `Allocution of ${caseData.defendant.firstName} ${caseData.defendant.lastName}`,
        body: allocution,
      });
    }
  } else {
    // ---- Act 2: each exhibit is offered, argued, and ruled on ---------------
    for (const evidence of caseData.evidence) {
      pushStatement({
        id: `exhibit-${evidence.id}`,
        entryKind: 'EXHIBIT_OFFERED',
        phase: 'ACT_2_MOTIONS',
        speaker: 'PROSECUTION',
        heading: `The People Offer: ${evidence.name}`,
        subject: { type: 'EVIDENCE', id: evidence.id },
        body: evidence.prosecutionArgument,
      });
      // An INTERROGATION exhibit is played into the record line by line
      // between the offer and the objection: the judge hears the contested
      // exchange itself before ruling on the motion to suppress. Detective
      // lines speak as WITNESS under the detective's name; the defendant's
      // lines follow the ALLOCUTION attribution (DEFENSE, led by the
      // defendant's own name).
      const interrogation = evidence.interrogation;
      if (interrogation !== undefined) {
        interrogation.lines.forEach((line, index) => {
          const isDetective = line.speaker === 'DETECTIVE';
          pushStatement({
            id: `playback-${evidence.id}-${index}`,
            entryKind: 'INTERROGATION_PLAYBACK',
            phase: 'ACT_2_MOTIONS',
            speaker: isDetective ? 'WITNESS' : 'DEFENSE',
            speakerName: isDetective ? interrogation.detectiveName : defendantName,
            subject: { type: 'EVIDENCE', id: evidence.id },
            heading: 'From the Recording',
            body: line.text,
          });
        });
      }
      pushStatement({
        id: `objection-${evidence.id}`,
        entryKind: 'EXHIBIT_OBJECTION',
        phase: 'ACT_2_MOTIONS',
        speaker: 'DEFENSE',
        heading: evidence.defenseObjection === null ? 'No Objection' : 'Defense Objects',
        subject: { type: 'EVIDENCE', id: evidence.id },
        body: evidence.defenseObjection ?? 'No objection from the defense.',
      });

      const ruling = motionRulings.find((r) => r.evidenceId === evidence.id);
      if (ruling === undefined) {
        pushDecision({
          id: `motion-${evidence.id}`,
          phase: 'ACT_2_MOTIONS',
          decision: { type: 'MOTION_RULING', evidenceId: evidence.id },
        });
        return beats;
      }
      pushStatement({
        id: `motion-${evidence.id}`,
        entryKind: 'MOTION_RULING',
        phase: 'ACT_2_MOTIONS',
        speaker: 'COURT',
        subject: { type: 'EVIDENCE', id: evidence.id },
        heading: `Ruling of the Court — ${evidence.name}: ${enumLabel(ruling.ruling)}`,
        body: spokenLine(spokenJudgeLines[`motion-${evidence.id}`], evidence.rulingOptions, ruling.ruling)
          ?? `${evidence.name}: ${enumLabel(ruling.ruling)}`,
      });
      evidence.rulingReactions[ruling.ruling].forEach((line, index) => {
        pushStatement({
          id: `motion-reaction-${evidence.id}-${index}`,
          entryKind: 'MOTION_REACTION',
          phase: 'ACT_2_MOTIONS',
          speaker: line.speaker,
          heading: REACTION_HEADINGS[line.speaker],
          body: line.text,
        });
      });
    }

    // ---- Act 3, trial path: testimony, closings, per-charge verdicts --------
    for (const witness of caseData.witnesses) {
      // Which side calls the witness is derived from bias: the People call
      // their own and neutral witnesses; the defense calls its own.
      const calledByDefense = witness.bias === 'DEFENSE';
      pushStatement({
        id: `direct-${witness.id}`,
        entryKind: 'TESTIMONY_DIRECT',
        phase: 'ACT_3_VERDICT',
        speaker: 'WITNESS',
        speakerName: witness.name,
        calledByDefense,
        subject: { type: 'WITNESS', id: witness.id },
        heading: `${calledByDefense ? 'The Defense Calls' : 'The People Call'} ${witness.name}`,
        body: witness.directExamination,
      });
      if (witness.crossExamination !== null) {
        pushStatement({
          id: `cross-${witness.id}`,
          entryKind: 'TESTIMONY_CROSS',
          phase: 'ACT_3_VERDICT',
          speaker: 'WITNESS',
          speakerName: witness.name,
          subject: { type: 'WITNESS', id: witness.id },
          heading: `Cross-Examination of ${witness.name}`,
          body: witness.crossExamination,
        });
      }
    }

    pushStatement({
      id: 'closing-prosecution',
      entryKind: 'CLOSING_ARGUMENT',
      phase: 'ACT_3_VERDICT',
      speaker: 'PROSECUTION',
      heading: 'Closing Argument — The People',
      body: assembleClosingArgument(caseData.closingArguments.prosecution, caseData.closingArguments.exhibitPoints, motionRulings, 'prosecution'),
    });
    pushStatement({
      id: 'closing-defense',
      entryKind: 'CLOSING_ARGUMENT',
      phase: 'ACT_3_VERDICT',
      speaker: 'DEFENSE',
      heading: 'Closing Argument — The Defense',
      body: assembleClosingArgument(caseData.closingArguments.defense, caseData.closingArguments.exhibitPoints, motionRulings, 'defense'),
    });

    for (const charge of caseData.charges) {
      const chargeVerdict = chargeVerdicts.find((v) => v.chargeId === charge.id);
      if (chargeVerdict === undefined) {
        pushDecision({
          id: `verdict-${charge.id}`,
          phase: 'ACT_3_VERDICT',
          decision: { type: 'CHARGE_VERDICT', chargeId: charge.id },
        });
        return beats;
      }
      pushStatement({
        id: `verdict-${charge.id}`,
        entryKind: 'VERDICT',
        phase: 'ACT_3_VERDICT',
        speaker: 'COURT',
        subject: { type: 'CHARGE', id: charge.id },
        heading: `Verdict of the Court — ${chargeVerdict.chargeName}: ${enumLabel(chargeVerdict.verdict)}`,
        body: spokenLine(spokenJudgeLines[`verdict-${charge.id}`], charge.verdictOptions, chargeVerdict.verdict)
          ?? `${chargeVerdict.chargeName} (${enumLabel(chargeVerdict.classification)}): ${enumLabel(chargeVerdict.verdict)}`,
      });
      charge.verdictReactions[chargeVerdict.verdict].forEach((line, index) => {
        pushStatement({
          id: `verdict-reaction-${charge.id}-${index}`,
          entryKind: 'VERDICT_REACTION',
          phase: 'ACT_3_VERDICT',
          speaker: line.speaker,
          heading: REACTION_HEADINGS[line.speaker],
          body: line.text,
        });
      });
    }
  }

  // ---- Sentencing (both paths) ----------------------------------------------
  // On the plea path a sentence is always imposed; on the trial path only if
  // any charge came back guilty — on a full acquittal the decision control
  // renders as adjournment and no sentence beats follow. Either way the
  // aftermath narrative is written immediately before END_STATE, so its
  // presence — not imposedSentence — marks this decision resolved.
  const anyGuilty = pleaDecision === 'ACCEPT' || chargeVerdicts.some((v) => v.verdict === 'GUILTY');
  if (aftermathNarrative === null) {
    pushDecision({
      id: 'sentencing',
      phase: 'ACT_3_VERDICT',
      decision: { type: 'SENTENCING', anyGuilty },
    });
    return beats;
  }

  imposedSentence.forEach((sentence, index) => {
    pushStatement({
      id: `sentence-${index}`,
      entryKind: 'SENTENCE_IMPOSED',
      phase: 'ACT_3_VERDICT',
      speaker: 'COURT',
      heading: 'Sentence Imposed',
      body: formatSentence(sentence),
    });
  });

  if (currentPhase === 'END_STATE') {
    pushStatement({
      id: 'aftermath',
      entryKind: 'AFTERMATH',
      phase: 'END_STATE',
      speaker: 'PRESS',
      heading: 'Aftermath',
      body: aftermathNarrative,
    });
  }

  return beats;
}
