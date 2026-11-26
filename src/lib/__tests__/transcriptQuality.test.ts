import { describe, it, expect } from 'vitest';
import { DEMO_CASES } from '../demoCases';
import { demoCaseSource } from '../caseSource';
import {
  PLAYTHROUGH_PATHS,
  aftermathContextFor,
  auditCase,
  auditRulingsRespected,
  auditTranscript,
  planPlaythrough,
  playTranscript,
} from './transcriptQuality';
import { validCase } from './fixtures';
import { buildCourtroomScript } from '../courtroomScript';

// The calibration for the live suite's reading checks. The demo docket was
// written and reviewed by a person, so every check must pass on every branch
// of every case; a check that fires here is too strict to trust on generated
// content. Free: no model call is made.
describe('transcript quality checks — calibrated on the demo docket', () => {
  for (const bundle of DEMO_CASES) {
    const { payload, pleaNarrative } = bundle;

    it(`${payload.caseId}: the case gives the judge contested, varied decisions`, () => {
      expect(auditCase(payload)).toEqual([]);
    });

    for (const path of PLAYTHROUGH_PATHS) {
      const plan = planPlaythrough(payload, pleaNarrative, path);
      it.skipIf(plan === null)(`${payload.caseId}: the ${path} transcript reads clean and respects the rulings`, async () => {
        if (plan === null) return;
        const aftermath = await demoCaseSource(bundle).generateAftermath(aftermathContextFor(payload, plan));
        const beats = playTranscript(payload, pleaNarrative, plan, aftermath);
        expect(auditTranscript(beats)).toEqual([]);
        expect(auditRulingsRespected(beats, payload, plan)).toEqual([]);
      });
    }
  }
});

// The checks have to be able to fail, or a clean live run proves nothing.
describe('transcript quality checks — each one fires on the defect it names', () => {
  const bundle = DEMO_CASES[0];
  const plan = planPlaythrough(bundle.payload, bundle.pleaNarrative, 'CONVICTED_ALL_ADMITTED');
  if (plan === null) throw new Error('every demo case can be tried');

  const play = (caseData: typeof bundle.payload, aftermath = 'The courthouse emptied.') =>
    playTranscript(caseData, bundle.pleaNarrative, plan, aftermath);

  const withWitness = (patch: Partial<(typeof bundle.payload.witnesses)[number]>) => ({
    ...bundle.payload,
    witnesses: bundle.payload.witnesses.map((w, i) => (i === 0 ? { ...w, ...patch } : w)),
  });

  it('flags a beat that stops mid-sentence', () => {
    const problems = auditTranscript(play(withWitness({ directExamination: 'I saw him walk toward the' })));
    expect(problems.some((p) => p.includes('looks cut off'))).toBe(true);
  });

  it('flags a beat that repeats a sentence', () => {
    const loop = 'I remember the door was open when I got there. I remember the door was open when I got there.';
    expect(auditTranscript(play(withWitness({ directExamination: loop }))).some((p) => p.includes('repeats the sentence'))).toBe(true);
  });

  it('flags testimony in the third person or as a Q-and-A script', () => {
    const third = auditTranscript(play(withWitness({
      directExamination: 'The officer arrived and the door was open.',
      crossExamination: 'The report was filed that night.',
    })));
    expect(third.some((p) => p.includes('first person'))).toBe(true);
    const qa = auditTranscript(play(withWitness({ directExamination: 'Q: Where were you?\nA: I was at home.' })));
    expect(qa.some((p) => p.includes('Q-and-A'))).toBe(true);
  });

  it('flags a jury reference and a serializer artifact anywhere in the record', () => {
    const problems = auditTranscript(play(bundle.payload, 'The jury filed out at undefined.'));
    expect(problems.some((p) => p.includes('jury'))).toBe(true);
    expect(problems.some((p) => p.includes('artifact'))).toBe(true);
  });

  it('flags a transcript that never reaches the aftermath', () => {
    const beats = buildCourtroomScript({
      caseData: bundle.payload,
      pleaNarrative: bundle.pleaNarrative,
      pleaPosture: plan.posture,
      currentPhase: 'ACT_1_INTAKE',
      pleaDecision: null,
      motionRulings: [],
      chargeVerdicts: [],
      imposedSentence: [],
      aftermathNarrative: null,
      spokenJudgeLines: {},
    });
    expect(auditTranscript(beats)).toContain('transcript does not end with the aftermath');
  });

  it('flags an uncontested Act 2 and a one-sided trial', () => {
    const flat = {
      ...validCase,
      evidence: validCase.evidence.map((e) => ({ ...e, objectionRisk: 'LOW' as const, defenseObjection: null })),
      witnesses: validCase.witnesses.map((w) => ({ ...w, crossExamination: null })),
    };
    const problems = auditCase(flat);
    expect(problems.some((p) => p.includes('objects to no exhibit'))).toBe(true);
    expect(problems.some((p) => p.includes('cross-examined'))).toBe(true);
  });

  it('flags testimony that quotes an excluded interview', () => {
    const tapeCase = DEMO_CASES.find((b) => b.payload.evidence.some((e) => e.interrogation !== undefined));
    if (!tapeCase) throw new Error('the demo docket includes a recorded interview');
    const tape = tapeCase.payload.evidence.find((e) => e.interrogation !== undefined);
    const line = tape?.interrogation?.lines.find((l) => l.speaker === 'DEFENDANT' && l.text.split(/\s+/).length >= 12)?.text;
    if (!line) throw new Error('the demo tape has a full defendant line to quote');

    const audit = (directExamination: string) => {
      const leaky = {
        ...tapeCase.payload,
        witnesses: tapeCase.payload.witnesses.map((w, i) => (i === 0 ? { ...w, directExamination } : w)),
      };
      const excluded = planPlaythrough(leaky, tapeCase.pleaNarrative, 'ACQUITTED_ALL_EXCLUDED');
      if (excluded === null) throw new Error('every demo case can be tried');
      return auditRulingsRespected(playTranscript(leaky, tapeCase.pleaNarrative, excluded, 'The courthouse emptied.'), leaky, excluded);
    };

    expect(audit(`I heard it played back myself. ${line}`).some((p) => p.includes('quotes the excluded interview'))).toBe(true);
    expect(audit('In the interview she told us that she thought it was a deer.').some((p) => p.includes('recounts the excluded interview'))).toBe(true);
  });
});
