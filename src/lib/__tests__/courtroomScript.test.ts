import { describe, it, expect } from 'vitest';
import {
  buildCourtroomScript,
  type BuildCourtroomScriptInput,
  type ScriptBeat,
  type StatementBeat,
} from '../courtroomScript';
import { validCase, validCaseWithInterrogation } from './fixtures';
import { DEMO_CASES } from '../demoCases';
import { computePleaPostureForCase } from '../pleaAssessment';
import type { PleaPosture, MotionRuling, ChargeVerdict } from '../../schemas/gameSchemas';

const pendingPosture: PleaPosture = {
  status: 'PENDING_JUDICIAL_REVIEW',
  pleadsToChargeIds: ['c1'],
  dismissedChargeIds: [],
  proposedSentence: [{ type: 'PRISON', unit: 'YEARS', amount: 8 }],
  prosecutionRationale: 'Provable but contestable.',
  defenseRationale: 'A deal beats the downside.',
};

const rejectedPosture: PleaPosture = {
  status: 'REJECTED_BY_DEFENSE',
  pleadsToChargeIds: ['c1'],
  dismissedChargeIds: [],
  proposedSentence: [{ type: 'PRISON', unit: 'YEARS', amount: 8 }],
  prosecutionRationale: 'Provable but contestable.',
  defenseRationale: 'Not worth the exposure.',
};

const noOfferPosture: PleaPosture = {
  status: 'NO_OFFER',
  prosecutionRationale: 'Too thin to bargain.',
};

const baseInput: BuildCourtroomScriptInput = {
  caseData: validCase,
  pleaNarrative: null,
  pleaPosture: null,
  currentPhase: 'ACT_1_INTAKE',
  pleaDecision: null,
  motionRulings: [],
  chargeVerdicts: [],
  imposedSentence: [],
  aftermathNarrative: null,
  spokenJudgeLines: {},
};

const statements = (beats: ScriptBeat[]): StatementBeat[] =>
  beats.filter((b): b is StatementBeat => b.kind === 'STATEMENT');

const kinds = (beats: ScriptBeat[]): string[] =>
  beats.map((b) => (b.kind === 'STATEMENT' ? b.entryKind : `DECISION:${b.decision.type}`));

// validCase: 1 charge, 3 exhibits, 2 witnesses (both People-side) — so Act 1
// runs call, charge, arraignment, facts, 3 disclosures, 2 witness
// disclosures before any plea beat.
const ACT_1_RUN_UP = [
  'CASE_OPENED',
  'CHARGE_READ',
  'ARRAIGNMENT_PLEA',
  'STATEMENT_OF_FACTS',
  'DISCOVERY_EXHIBIT',
  'DISCOVERY_EXHIBIT',
  'DISCOVERY_EXHIBIT',
  'DISCOVERY_WITNESS',
  'DISCOVERY_WITNESS',
];

describe('buildCourtroomScript — Act 1 sequence', () => {
  it('runs call, charges, arraignment, facts, and discovery before any plea beat', () => {
    const beats = buildCourtroomScript(baseInput);
    expect(kinds(beats)).toEqual(ACT_1_RUN_UP);
    // The clerk performs procedure only: the call is the procedural call,
    // not a narrative summary.
    expect(beats[0]?.kind === 'STATEMENT' && beats[0].speaker).toBe('CLERK');
    expect(beats[0]?.kind === 'STATEMENT' && beats[0].body).toBe(
      'Calling case 24-CR-00001, the People of the State of California v. Jordan Vance.',
    );
    // The facts come from a party, in the case's authored voice.
    const facts = statements(beats).find((b) => b.entryKind === 'STATEMENT_OF_FACTS');
    expect(facts?.speaker).toBe('PROSECUTION');
    expect(facts?.body).toBe(validCase.statementOfFacts);
    // The defense enters the not-guilty plea for the defendant by name.
    const arraignment = statements(beats).find((b) => b.entryKind === 'ARRAIGNMENT_PLEA');
    expect(arraignment?.speaker).toBe('DEFENSE');
    expect(arraignment?.body).toContain('Jordan Vance');
    expect(arraignment?.body).toContain('not guilty');
  });

  it('discovery beats carry Tier-1 disclosure text and are spoken by the disclosing side', () => {
    const beats = buildCourtroomScript(baseInput);
    const exhibits = statements(beats).filter((b) => b.entryKind === 'DISCOVERY_EXHIBIT');
    expect(exhibits.map((b) => b.body)).toEqual(validCase.evidence.map((e) => e.disclosureSummary));
    expect(exhibits.every((b) => b.speaker === 'PROSECUTION')).toBe(true);
    const witnesses = statements(beats).filter((b) => b.entryKind === 'DISCOVERY_WITNESS');
    // Disclosure bodies reuse the witness statements; both fixture witnesses
    // are People-side (PROSECUTION / NEUTRAL bias).
    expect(witnesses.map((b) => b.body)).toEqual(validCase.witnesses.map((w) => w.statement));
    expect(witnesses.every((b) => b.speaker === 'PROSECUTION')).toBe(true);
  });

  it('a DEFENSE-bias witness is disclosed by the defense', () => {
    const beats = buildCourtroomScript({
      ...baseInput,
      caseData: {
        ...validCase,
        witnesses: validCase.witnesses.map((w, i) => (i === 1 ? { ...w, bias: 'DEFENSE' as const } : w)),
      },
    });
    const witnesses = statements(beats).filter((b) => b.entryKind === 'DISCOVERY_WITNESS');
    expect(witnesses.map((b) => b.speaker)).toEqual(['PROSECUTION', 'DEFENSE']);
    expect(witnesses[1]?.heading).toBe('The Defense Discloses: Sam Okafor');
  });

  it('with a pending offer: offer, defense response, then the plea-ruling decision — after discovery', () => {
    const beats = buildCourtroomScript({ ...baseInput, pleaPosture: pendingPosture });
    expect(kinds(beats)).toEqual([
      ...ACT_1_RUN_UP,
      'PLEA_OFFER',
      'PLEA_DEFENSE_RESPONSE',
      'DECISION:PLEA_RULING',
    ]);
    const decision = beats.at(-1);
    expect(decision?.kind === 'DECISION' && decision.decision.type === 'PLEA_RULING' && decision.decision.hasOffer).toBe(true);
    const offer = statements(beats).find((b) => b.entryKind === 'PLEA_OFFER');
    expect(offer?.body).toContain('Second-degree burglary');
    expect(offer?.body).toContain('8 years in prison');
  });

  it('NO_OFFER: declination beat after the same run-up, decision carries hasOffer=false', () => {
    const beats = buildCourtroomScript({ ...baseInput, pleaPosture: noOfferPosture });
    expect(kinds(beats)).toEqual([...ACT_1_RUN_UP, 'PLEA_OFFER', 'DECISION:PLEA_RULING']);
    const decision = beats.at(-1);
    expect(decision?.kind === 'DECISION' && decision.decision.type === 'PLEA_RULING' && decision.decision.hasOffer).toBe(false);
  });

  it('emits nothing past discovery when no posture is loaded', () => {
    expect(kinds(buildCourtroomScript(baseInput))).not.toContain('DECISION:PLEA_RULING');
  });

  it('a trial order with no live offer resolves via phase, voiced as the court\'s order', () => {
    const beats = buildCourtroomScript({
      ...baseInput,
      pleaPosture: noOfferPosture,
      currentPhase: 'ACT_2_MOTIONS',
    });
    const ruling = statements(beats).find((b) => b.entryKind === 'PLEA_DECISION');
    expect(ruling?.heading).toBe('Trial Ordered');
    expect(ruling?.speaker).toBe('COURT');
  });
});

describe('buildCourtroomScript — Act 2 exhibit-by-exhibit', () => {
  const trialInput: BuildCourtroomScriptInput = {
    ...baseInput,
    pleaPosture: rejectedPosture,
    currentPhase: 'ACT_2_MOTIONS',
  };

  it('offers the first exhibit, voices the waiver on a LOW-risk null objection, then pauses', () => {
    const beats = buildCourtroomScript(trialInput);
    // e1 is LOW risk with defenseObjection: null — the waiver is derived.
    expect(kinds(beats).slice(-3)).toEqual(['EXHIBIT_OFFERED', 'EXHIBIT_OBJECTION', 'DECISION:MOTION_RULING']);
    const objection = statements(beats).at(-1);
    expect(objection?.heading).toBe('No Objection');
    expect(objection?.body).toBe('No objection from the defense.');
    const decision = beats.at(-1);
    expect(decision?.kind === 'DECISION' && decision.decision.type === 'MOTION_RULING' && decision.decision.evidenceId).toBe('e1');
  });

  it('a ruling replaces its decision in place and the next exhibit begins', () => {
    const rulings: MotionRuling[] = [{ evidenceId: 'e1', ruling: 'ADMITTED' }];
    const before = buildCourtroomScript(trialInput);
    const after = buildCourtroomScript({ ...trialInput, motionRulings: rulings });
    // Prefix stability: everything before the decision is unchanged.
    expect(after.slice(0, before.length - 1)).toEqual(before.slice(0, -1));
    const rulingBeat = after[before.length - 1];
    expect(rulingBeat?.kind === 'STATEMENT' && rulingBeat.entryKind).toBe('MOTION_RULING');
    // No voice record → the first authored option matching the ruling speaks.
    expect(rulingBeat?.kind === 'STATEMENT' && rulingBeat.heading).toBe('Ruling of the Court — Rear door fingerprint: Admitted');
    expect(rulingBeat?.kind === 'STATEMENT' && rulingBeat.body).toBe('The print comes in. Admitted.');
    // The MEDIUM-risk e2 carries a voiced objection.
    const nextObjection = statements(after).at(-1);
    expect(nextObjection?.heading).toBe('Defense Objects');
  });

  it('exhibits are argued in payload order regardless of ruling insertion order', () => {
    const rulings: MotionRuling[] = [
      { evidenceId: 'e3', ruling: 'EXCLUDED' },
      { evidenceId: 'e1', ruling: 'ADMITTED' },
      { evidenceId: 'e2', ruling: 'EXCLUDED' },
    ];
    const beats = buildCourtroomScript({ ...trialInput, motionRulings: rulings });
    const rulingHeadings = statements(beats)
      .filter((b) => b.entryKind === 'MOTION_RULING')
      .map((b) => b.heading);
    expect(rulingHeadings).toEqual([
      'Ruling of the Court — Rear door fingerprint: Admitted',
      'Ruling of the Court — Security camera still: Excluded',
      'Ruling of the Court — Recovered crowbar: Excluded',
    ]);
  });
});

describe('buildCourtroomScript — Act 3 trial path', () => {
  const allRuled: MotionRuling[] = [
    { evidenceId: 'e1', ruling: 'ADMITTED' },
    { evidenceId: 'e2', ruling: 'EXCLUDED' },
    { evidenceId: 'e3', ruling: 'EXCLUDED' },
  ];
  const trialInput: BuildCourtroomScriptInput = {
    ...baseInput,
    pleaPosture: rejectedPosture,
    currentPhase: 'ACT_3_VERDICT',
    motionRulings: allRuled,
  };

  it('after motions: testimony (direct + optional cross), closings, then the first verdict decision', () => {
    const beats = buildCourtroomScript(trialInput);
    // w1 has a cross; w2's cross is null and is skipped.
    expect(kinds(beats).slice(-6)).toEqual([
      'TESTIMONY_DIRECT',
      'TESTIMONY_CROSS',
      'TESTIMONY_DIRECT',
      'CLOSING_ARGUMENT',
      'CLOSING_ARGUMENT',
      'DECISION:CHARGE_VERDICT',
    ]);
    const direct = statements(beats).find((b) => b.entryKind === 'TESTIMONY_DIRECT');
    expect(direct?.speaker).toBe('WITNESS');
    expect(direct?.heading).toBe('The People Call Alex Reed');
    // The transcript leads the utterance with the witness's own name, not the
    // generic WITNESS role.
    expect(direct?.speakerName).toBe('Alex Reed');
    // Called by the prosecution (bias: 'PROSECUTION') — the caption still
    // needs this once the heading is demoted in the rendered transcript.
    expect(direct?.calledByDefense).toBe(false);
    const cross = statements(beats).find((b) => b.entryKind === 'TESTIMONY_CROSS');
    expect(cross?.speakerName).toBe('Alex Reed');
  });

  it('a guilty verdict leads to a sentencing decision with anyGuilty=true', () => {
    const chargeVerdicts: ChargeVerdict[] = [
      { chargeId: 'c1', chargeName: 'Second-degree burglary', classification: 'FELONY', verdict: 'GUILTY' },
    ];
    const beats = buildCourtroomScript({ ...trialInput, chargeVerdicts });
    const last = beats.at(-1);
    expect(last?.kind === 'DECISION' && last.decision.type === 'SENTENCING' && last.decision.anyGuilty).toBe(true);
  });

  it('a full acquittal still reaches sentencing (adjournment) with anyGuilty=false, and no sentence beats follow', () => {
    const chargeVerdicts: ChargeVerdict[] = [
      { chargeId: 'c1', chargeName: 'Second-degree burglary', classification: 'FELONY', verdict: 'NOT_GUILTY' },
    ];
    const pending = buildCourtroomScript({ ...trialInput, chargeVerdicts });
    const last = pending.at(-1);
    expect(last?.kind === 'DECISION' && last.decision.type === 'SENTENCING' && last.decision.anyGuilty).toBe(false);

    const resolved = buildCourtroomScript({
      ...trialInput,
      chargeVerdicts,
      currentPhase: 'END_STATE',
      aftermathNarrative: 'The acquittal made the morning edition.',
    });
    expect(kinds(resolved)).not.toContain('SENTENCE_IMPOSED');
    expect(kinds(resolved).at(-1)).toBe('AFTERMATH');
  });
});

describe('buildCourtroomScript — accepted-plea path', () => {
  const pleaInput: BuildCourtroomScriptInput = {
    ...baseInput,
    pleaNarrative: {
      prosecutionRationale: 'Provable but contestable.',
      defenseRationale: 'A deal beats the downside.',
      allocution: 'I want to say I am sorry.',
    },
    pleaPosture: pendingPosture,
    currentPhase: 'ACT_3_VERDICT',
    pleaDecision: 'ACCEPT',
  };

  it('skips motions and trial entirely: acceptance, allocution, sentencing decision', () => {
    const beats = buildCourtroomScript(pleaInput);
    expect(kinds(beats)).toEqual([
      ...ACT_1_RUN_UP,
      'PLEA_OFFER',
      'PLEA_DEFENSE_RESPONSE',
      'PLEA_DECISION',
      'ALLOCUTION',
      'DECISION:SENTENCING',
    ]);
    const allocution = statements(beats).find((b) => b.entryKind === 'ALLOCUTION');
    expect(allocution?.heading).toBe('Allocution of Jordan Vance');
    // The defendant allocutes in their own name, though the beat is voiced by
    // the defense.
    expect(allocution?.speaker).toBe('DEFENSE');
    expect(allocution?.speakerName).toBe('Jordan Vance');
  });

  it('sentencing resolves into sentence beats and the aftermath at END_STATE', () => {
    const beats = buildCourtroomScript({
      ...pleaInput,
      currentPhase: 'END_STATE',
      imposedSentence: [{ type: 'PRISON', unit: 'YEARS', amount: 5 }],
      aftermathNarrative: 'Coverage was minimal.',
    });
    expect(kinds(beats).slice(-2)).toEqual(['SENTENCE_IMPOSED', 'AFTERMATH']);
    const aftermath = statements(beats).at(-1);
    expect(aftermath?.speaker).toBe('PRESS');
    expect(aftermath?.body).toBe('Coverage was minimal.');
  });
});

describe('buildCourtroomScript — choice-keyed reaction beats', () => {
  const trialInput: BuildCourtroomScriptInput = {
    ...baseInput,
    pleaPosture: rejectedPosture,
    currentPhase: 'ACT_2_MOTIONS',
  };

  it('an admitted exhibit draws its ADMITTED reaction, right after the ruling', () => {
    const beats = buildCourtroomScript({
      ...trialInput,
      motionRulings: [{ evidenceId: 'e1', ruling: 'ADMITTED' }],
    });
    const rulingIndex = beats.findIndex((b) => b.kind === 'STATEMENT' && b.entryKind === 'MOTION_RULING');
    const reaction = beats[rulingIndex + 1];
    expect(reaction?.kind === 'STATEMENT' && reaction.entryKind).toBe('MOTION_REACTION');
    expect(reaction?.kind === 'STATEMENT' && reaction.speaker).toBe('PROSECUTION');
    expect(reaction?.kind === 'STATEMENT' && reaction.body).toBe('The People mark the print as Exhibit 1.');
  });

  it('the same exhibit excluded draws the EXCLUDED reaction instead', () => {
    const beats = buildCourtroomScript({
      ...trialInput,
      motionRulings: [{ evidenceId: 'e1', ruling: 'EXCLUDED' }],
    });
    const reaction = statements(beats).find((b) => b.entryKind === 'MOTION_REACTION');
    expect(reaction?.speaker).toBe('DEFENSE');
    expect(reaction?.body).toBe('The defense thanks the court.');
  });

  it('a verdict draws its charge\'s keyed reaction after the verdict beat', () => {
    const beats = buildCourtroomScript({
      ...trialInput,
      currentPhase: 'ACT_3_VERDICT',
      motionRulings: [
        { evidenceId: 'e1', ruling: 'ADMITTED' },
        { evidenceId: 'e2', ruling: 'ADMITTED' },
        { evidenceId: 'e3', ruling: 'ADMITTED' },
      ],
      chargeVerdicts: [
        { chargeId: 'c1', chargeName: 'Second-degree burglary', classification: 'FELONY', verdict: 'NOT_GUILTY' },
      ],
    });
    const verdictIndex = beats.findIndex((b) => b.kind === 'STATEMENT' && b.entryKind === 'VERDICT');
    const reaction = beats[verdictIndex + 1];
    expect(reaction?.kind === 'STATEMENT' && reaction.entryKind).toBe('VERDICT_REACTION');
    expect(reaction?.kind === 'STATEMENT' && reaction.body).toBe('The People accept the verdict of the court.');
  });

  it('a ruled-on plea draws the matching plea reaction; the offer-less trial order draws none', () => {
    const pleaReactions = {
      ACCEPT: [
        { speaker: 'DEFENSE' as const, text: 'Thank you, Your Honor.' },
        { speaker: 'CLERK' as const, text: 'The plea is entered and accepted.' },
      ],
      REJECT: [{ speaker: 'PROSECUTION' as const, text: 'Then the People will prove it.' }],
    };
    const accepted = buildCourtroomScript({
      ...baseInput,
      pleaNarrative: { prosecutionRationale: 'p', defenseRationale: 'd', allocution: 'a', pleaReactions },
      pleaPosture: pendingPosture,
      currentPhase: 'ACT_3_VERDICT',
      pleaDecision: 'ACCEPT',
    });
    const reactions = statements(accepted).filter((b) => b.entryKind === 'PLEA_REACTION');
    expect(reactions.map((b) => b.body)).toEqual(['Thank you, Your Honor.', 'The plea is entered and accepted.']);

    const noOffer = buildCourtroomScript({
      ...baseInput,
      pleaNarrative: { prosecutionRationale: 'p' },
      pleaPosture: noOfferPosture,
      currentPhase: 'ACT_2_MOTIONS',
    });
    expect(kinds(noOffer)).not.toContain('PLEA_REACTION');
  });
});

describe('buildCourtroomScript — voiced judge lines', () => {
  const trialInput: BuildCourtroomScriptInput = {
    ...baseInput,
    pleaPosture: rejectedPosture,
    currentPhase: 'ACT_2_MOTIONS',
    motionRulings: [{ evidenceId: 'e1', ruling: 'ADMITTED' }],
  };

  it('the recorded spoken line wins over the authored fallback', () => {
    const beats = buildCourtroomScript({
      ...trialInput,
      spokenJudgeLines: { 'motion-e1': 'The court has heard enough. Admitted.' },
    });
    const ruling = statements(beats).find((b) => b.entryKind === 'MOTION_RULING');
    expect(ruling?.body).toBe('The court has heard enough. Admitted.');
  });

  it('a verdict speaks the recorded line under its verdict-<chargeId> key', () => {
    const beats = buildCourtroomScript({
      ...trialInput,
      currentPhase: 'ACT_3_VERDICT',
      motionRulings: [
        { evidenceId: 'e1', ruling: 'ADMITTED' },
        { evidenceId: 'e2', ruling: 'ADMITTED' },
        { evidenceId: 'e3', ruling: 'ADMITTED' },
      ],
      chargeVerdicts: [
        { chargeId: 'c1', chargeName: 'Second-degree burglary', classification: 'FELONY', verdict: 'GUILTY' },
      ],
      spokenJudgeLines: { 'verdict-c1': 'The paper convicts you, Mr. Vance. Guilty.' },
    });
    const verdict = statements(beats).find((b) => b.entryKind === 'VERDICT');
    expect(verdict?.body).toBe('The paper convicts you, Mr. Vance. Guilty.');
    expect(verdict?.heading).toBe('Verdict of the Court — Second-degree burglary: Guilty');
  });

  it('a ruled-on plea speaks the recorded line; without one it falls back to the matching option', () => {
    const narrative = {
      prosecutionRationale: 'p',
      defenseRationale: 'd',
      allocution: 'a',
      pleaReactions: {
        ACCEPT: [{ speaker: 'CLERK' as const, text: 'The plea is entered.' }],
        REJECT: [{ speaker: 'PROSECUTION' as const, text: 'The People will prove it.' }],
      },
      pleaRulingOptions: [
        { choice: 'ACCEPT' as const, lineText: 'The deal is fair and final. Accepted.' },
        { choice: 'REJECT' as const, lineText: 'Two years does not answer it. Rejected.' },
      ],
    };
    const base = {
      ...baseInput,
      pleaNarrative: narrative,
      pleaPosture: pendingPosture,
      currentPhase: 'ACT_3_VERDICT' as const,
      pleaDecision: 'ACCEPT' as const,
    };
    const spoken = buildCourtroomScript({ ...base, spokenJudgeLines: { plea: 'So ordered. We proceed to sentencing.' } });
    expect(statements(spoken).find((b) => b.entryKind === 'PLEA_DECISION')?.body).toBe('So ordered. We proceed to sentencing.');

    const fallback = buildCourtroomScript(base);
    expect(statements(fallback).find((b) => b.entryKind === 'PLEA_DECISION')?.body).toBe('The deal is fair and final. Accepted.');
  });
});

describe('buildCourtroomScript — interrogation playback', () => {
  // validCaseWithInterrogation appends the tape as e4; rule the first three
  // exhibits so the script reaches it.
  const playbackInput: BuildCourtroomScriptInput = {
    ...baseInput,
    caseData: validCaseWithInterrogation,
    pleaPosture: rejectedPosture,
    currentPhase: 'ACT_2_MOTIONS',
    motionRulings: [
      { evidenceId: 'e1', ruling: 'ADMITTED' },
      { evidenceId: 'e2', ruling: 'ADMITTED' },
      { evidenceId: 'e3', ruling: 'ADMITTED' },
    ],
  };

  it('plays the tape line by line between the offer and the suppression objection', () => {
    const beats = buildCourtroomScript(playbackInput);
    // The tail: offer, 4 playback lines, objection, pending ruling.
    expect(kinds(beats).slice(-7)).toEqual([
      'EXHIBIT_OFFERED',
      'INTERROGATION_PLAYBACK',
      'INTERROGATION_PLAYBACK',
      'INTERROGATION_PLAYBACK',
      'INTERROGATION_PLAYBACK',
      'EXHIBIT_OBJECTION',
      'DECISION:MOTION_RULING',
    ]);
  });

  it('attributes detective lines to the detective and defendant lines to the defendant', () => {
    const beats = buildCourtroomScript(playbackInput);
    const playback = statements(beats).filter((b) => b.entryKind === 'INTERROGATION_PLAYBACK');
    expect(playback.map((b) => b.speakerName)).toEqual([
      'Sam Okafor', 'Jordan Vance', 'Sam Okafor', 'Jordan Vance',
    ]);
    expect(playback.map((b) => b.speaker)).toEqual(['WITNESS', 'DEFENSE', 'WITNESS', 'DEFENSE']);
    // Every playback beat presents the tape exhibit.
    expect(playback.every((b) => b.subject?.type === 'EVIDENCE' && b.subject.id === 'e4')).toBe(true);
    // Bodies are the transcript, in order.
    expect(playback[0]?.body).toBe('You understand the rights as I read them to you?');
  });

  it('emits no playback for cases without an interrogation exhibit', () => {
    const beats = buildCourtroomScript({
      ...baseInput,
      pleaPosture: rejectedPosture,
      currentPhase: 'ACT_2_MOTIONS',
    });
    expect(kinds(beats)).not.toContain('INTERROGATION_PLAYBACK');
  });
});

describe('buildCourtroomScript — subject stamping', () => {
  it('stamps discovery and presentation beats with the item they present', () => {
    const beats = buildCourtroomScript({
      ...baseInput,
      pleaPosture: rejectedPosture,
      currentPhase: 'ACT_3_VERDICT',
      motionRulings: [
        { evidenceId: 'e1', ruling: 'ADMITTED' },
        { evidenceId: 'e2', ruling: 'ADMITTED' },
        { evidenceId: 'e3', ruling: 'ADMITTED' },
      ],
      chargeVerdicts: [
        { chargeId: 'c1', chargeName: 'Second-degree burglary', classification: 'FELONY', verdict: 'GUILTY' },
      ],
    });
    const firstSubject = (kind: StatementBeat['entryKind']) =>
      statements(beats).find((b) => b.entryKind === kind)?.subject;
    expect(firstSubject('CHARGE_READ')).toEqual({ type: 'CHARGE', id: 'c1' });
    expect(firstSubject('DISCOVERY_EXHIBIT')).toEqual({ type: 'EVIDENCE', id: 'e1' });
    expect(firstSubject('DISCOVERY_WITNESS')).toEqual({ type: 'WITNESS', id: 'w1' });
    expect(firstSubject('EXHIBIT_OFFERED')).toEqual({ type: 'EVIDENCE', id: 'e1' });
    expect(firstSubject('EXHIBIT_OBJECTION')).toEqual({ type: 'EVIDENCE', id: 'e1' });
    expect(firstSubject('MOTION_RULING')).toEqual({ type: 'EVIDENCE', id: 'e1' });
    expect(firstSubject('TESTIMONY_DIRECT')).toEqual({ type: 'WITNESS', id: 'w1' });
    expect(firstSubject('TESTIMONY_CROSS')).toEqual({ type: 'WITNESS', id: 'w1' });
    expect(firstSubject('VERDICT')).toEqual({ type: 'CHARGE', id: 'c1' });
  });

  it('leaves non-presentation beats unstamped', () => {
    const beats = buildCourtroomScript({
      ...baseInput,
      pleaPosture: rejectedPosture,
      currentPhase: 'ACT_2_MOTIONS',
      motionRulings: [{ evidenceId: 'e1', ruling: 'ADMITTED' }],
    });
    for (const kind of ['CASE_OPENED', 'ARRAIGNMENT_PLEA', 'STATEMENT_OF_FACTS', 'PLEA_OFFER', 'MOTION_REACTION'] as const) {
      const beat = statements(beats).find((b) => b.entryKind === kind);
      expect(beat, kind).toBeDefined();
      expect(beat?.subject, kind).toBeUndefined();
    }
  });
});

describe('buildCourtroomScript — robustness and purity', () => {
  it('attributes every statement to a courtroom speaker, never an omniscient narrator', () => {
    const beats = buildCourtroomScript({
      ...baseInput,
      pleaNarrative: { prosecutionRationale: 'p', defenseRationale: 'd' },
      pleaPosture: pendingPosture,
      currentPhase: 'END_STATE',
      pleaDecision: 'ACCEPT',
      imposedSentence: [{ type: 'PRISON', unit: 'YEARS', amount: 5 }],
      aftermathNarrative: 'Coverage was minimal.',
    });
    const speakers = new Set(statements(beats).map((b) => b.speaker));
    for (const speaker of speakers) {
      expect(['CLERK', 'PROSECUTION', 'DEFENSE', 'WITNESS', 'COURT', 'PRESS']).toContain(speaker);
    }
  });

  it('is pure: identical input produces a deep-equal result both times', () => {
    const input: BuildCourtroomScriptInput = { ...baseInput, pleaPosture: pendingPosture };
    expect(buildCourtroomScript(input)).toEqual(buildCourtroomScript(input));
  });

  it('order is a monotonic zero-based index matching array position', () => {
    const beats = buildCourtroomScript({ ...baseInput, pleaPosture: rejectedPosture, currentPhase: 'ACT_2_MOTIONS' });
    expect(beats.map((b) => b.order)).toEqual(beats.map((_, i) => i));
  });

  it('emission stops at the first unresolved decision — no beats leak past it', () => {
    const beats = buildCourtroomScript({ ...baseInput, pleaPosture: pendingPosture });
    const firstDecision = beats.findIndex((b) => b.kind === 'DECISION');
    expect(firstDecision).toBe(beats.length - 1);
  });
});

// ============================================================================
// Prefix-stability playthroughs: for every demo case, on both branches where
// reachable, simulate resolving each pending decision in turn and assert that
// no earlier beat ever changes. This is the invariant that lets the UI's
// reveal cursor trust its own past.
// ============================================================================
describe('buildCourtroomScript — demo docket playthroughs are prefix-stable', () => {
  function playThrough(
    bundle: (typeof DEMO_CASES)[number],
    branch: 'ACCEPT' | 'TRIAL',
    verdictFor: (chargeId: string, index: number) => 'GUILTY' | 'NOT_GUILTY',
  ): void {
    const { posture } = computePleaPostureForCase(bundle.payload, bundle.pleaNarrative);
    let input: BuildCourtroomScriptInput = {
      caseData: bundle.payload,
      pleaNarrative: bundle.pleaNarrative,
      pleaPosture: posture,
      currentPhase: 'ACT_1_INTAKE',
      pleaDecision: null,
      motionRulings: [],
      chargeVerdicts: [],
      imposedSentence: [],
      aftermathNarrative: null,
      spokenJudgeLines: {},
    };

    let previous = buildCourtroomScript(input);
    let verdictCount = 0;
    for (let guard = 0; guard < 100; guard++) {
      const pending = previous.at(-1);
      if (pending?.kind !== 'DECISION') break;

      const d = pending.decision;
      if (d.type === 'PLEA_RULING') {
        input = d.hasOffer && branch === 'ACCEPT'
          ? { ...input, pleaDecision: 'ACCEPT', currentPhase: 'ACT_3_VERDICT' }
          : {
              ...input,
              pleaDecision: d.hasOffer ? 'REJECT' : null,
              currentPhase: 'ACT_2_MOTIONS',
            };
      } else if (d.type === 'MOTION_RULING') {
        input = { ...input, motionRulings: [...input.motionRulings, { evidenceId: d.evidenceId, ruling: 'ADMITTED' }] };
      } else if (d.type === 'CHARGE_VERDICT') {
        input = {
          ...input,
          currentPhase: 'ACT_3_VERDICT',
          chargeVerdicts: [
            ...input.chargeVerdicts,
            {
              chargeId: d.chargeId,
              chargeName: bundle.payload.charges.find((c) => c.id === d.chargeId)?.name ?? 'Unknown',
              classification: bundle.payload.charges.find((c) => c.id === d.chargeId)?.classification ?? 'FELONY',
              verdict: verdictFor(d.chargeId, verdictCount++),
            },
          ],
        };
      } else {
        input = {
          ...input,
          currentPhase: 'END_STATE',
          imposedSentence: d.anyGuilty ? [{ type: 'FINE', unit: 'DOLLARS', amount: 100 }] : [],
          aftermathNarrative: 'The town read about it the next morning.',
        };
      }

      const next = buildCourtroomScript(input);
      // Every beat before the resolved decision is byte-for-byte unchanged.
      expect(next.slice(0, previous.length - 1)).toEqual(previous.slice(0, -1));
      expect(next.length).toBeGreaterThanOrEqual(previous.length - 1);
      previous = next;
    }

    // Every playthrough ends with the press report — a complete court record.
    const finale = previous.at(-1);
    expect(finale?.kind === 'STATEMENT' && finale.entryKind).toBe('AFTERMATH');
  }

  for (const bundle of DEMO_CASES) {
    const { posture } = computePleaPostureForCase(bundle.payload, bundle.pleaNarrative);

    it(`${bundle.title} — trial branch, all guilty`, () => {
      playThrough(bundle, 'TRIAL', () => 'GUILTY');
    });

    it(`${bundle.title} — trial branch, full acquittal`, () => {
      playThrough(bundle, 'TRIAL', () => 'NOT_GUILTY');
    });

    if (posture.status === 'PENDING_JUDICIAL_REVIEW') {
      it(`${bundle.title} — accepted-plea branch (with allocution beat)`, () => {
        playThrough(bundle, 'ACCEPT', () => 'GUILTY');
      });
    }

    if (bundle.payload.charges.length > 1) {
      it(`${bundle.title} — split verdict`, () => {
        playThrough(bundle, 'TRIAL', (_id, index) => (index === 0 ? 'GUILTY' : 'NOT_GUILTY'));
      });
    }
  }
});
