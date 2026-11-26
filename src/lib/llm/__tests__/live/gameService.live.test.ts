/// <reference types="node" />
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createGameService } from '../../gameService';
import {
  CaseSchema,
  PleaNarrativeSchema,
  AftermathNarrativeSchema,
  defendantFullName,
  type CasePayload,
  type PleaNarrative,
} from '../../../../schemas/gameSchemas';
import type { ScriptBeat } from '../../../courtroomScript';
import {
  PLAYTHROUGH_PATHS,
  aftermathContextFor,
  auditCase,
  auditRulingsRespected,
  auditTranscript,
  hasRulingConditionedTestimony,
  planPlaythrough,
  playTranscript,
} from '../../../__tests__/transcriptQuality';
import { LIVE_API_KEY } from './liveEnv';

// The real end-to-end proof, read the way a player meets it.
//
// One generateCase() run (eight model calls, some possibly retrying), reused
// by every test below, plus one Aftermath call per branch the case can reach
// (two or three): the whole file costs one case generation and a few small
// calls, not one generation per assertion.
//
// Schema validity is the floor. Above it, each reachable branch is played to
// the end and the transcript the courtroom would actually show is checked for
// what makes a trial read badly — a line cut off mid-sentence, a witness
// looping, testimony scripted as Q-and-A, a jury in a bench trial — and the
// case itself for what makes one dull: an Act 2 with nothing contested, a
// room that reacts the same way to opposite rulings. The checks live in
// src/lib/__tests__/transcriptQuality.ts and are calibrated against the
// hand-authored demo docket in the ordinary `npm test` run.
//
// Every played transcript is written to LIVE_TRANSCRIPT_DIR so a person can
// read what the model wrote; the CI workflow uploads that directory.

const TRANSCRIPT_DIR = process.env.LIVE_TRANSCRIPT_DIR ?? '/tmp/bench-live-transcripts';
// The player watches the generating screen for this long. The measured median
// is under 20 s; this bound leaves room for rate-limit retries and still
// fails a pipeline that has become something nobody would wait for.
const MAX_GENERATION_MS = 180_000;

function render(beats: ScriptBeat[]): string {
  return beats
    .map((b) => (b.kind === 'DECISION'
      ? `\n--- [awaiting the court: ${b.decision.type}] ---\n`
      : `${b.speakerName ?? b.speaker} — ${b.heading}\n${b.body}\n`))
    .join('\n');
}

describe.skipIf(LIVE_API_KEY === null)('GameService (live)', () => {
  const apiKey = LIVE_API_KEY as string;
  let payload: CasePayload;
  let pleaNarrative: PleaNarrative;
  let generationMs = 0;
  const findings: string[] = [];

  beforeAll(async () => {
    const started = Date.now();
    ({ payload, pleaNarrative } = await createGameService(apiKey).generateCase());
    generationMs = Date.now() - started;
    mkdirSync(TRANSCRIPT_DIR, { recursive: true });
    writeFileSync(join(TRANSCRIPT_DIR, 'case.json'), JSON.stringify({ payload, pleaNarrative }, null, 2));
  }, 240_000);

  afterAll(() => {
    if (findings.length === 0) return;
    const text = findings.join('\n');
    writeFileSync(join(TRANSCRIPT_DIR, 'findings.txt'), `${text}\n`);
    console.error(`\nTranscript findings (also in ${TRANSCRIPT_DIR}/findings.txt):\n${text}`);
  });

  it('generates a schema-valid case end to end against the real Gemini API', () => {
    expect(CaseSchema.safeParse(payload).success).toBe(true);
    expect(payload.evidence.length).toBeGreaterThanOrEqual(3);
    expect(payload.witnesses.length).toBeGreaterThanOrEqual(2);
  });

  it('generates a schema-valid plea narrative alongside the case', () => {
    expect(PleaNarrativeSchema.safeParse(pleaNarrative).success).toBe(true);
  });

  it('finishes generating within a wait a player would sit through', () => {
    console.error(`Case generated in ${(generationMs / 1000).toFixed(1)}s`);
    expect(generationMs).toBeLessThan(MAX_GENERATION_MS);
  });

  it('gives the judge contested, varied decisions', () => {
    const problems = auditCase(payload);
    findings.push(...problems.map((p) => `[case] ${p}`));
    expect(problems).toEqual([]);
  });

  for (const path of PLAYTHROUGH_PATHS) {
    it(`plays the ${path} branch to the end, aftermath included, and the record reads clean`, async (ctx) => {
      const plan = planPlaythrough(payload, pleaNarrative, path);
      // Only a posture pending the court's review puts a plea before the
      // judge; on any other case this branch does not exist.
      if (plan === null) {
        ctx.skip();
        return;
      }

      const aftermath = await createGameService(apiKey).generateAftermath(aftermathContextFor(payload, plan));
      expect(AftermathNarrativeSchema.safeParse(aftermath).success).toBe(true);

      const beats = playTranscript(payload, pleaNarrative, plan, aftermath);
      writeFileSync(join(TRANSCRIPT_DIR, `${path}.txt`), render(beats));

      const problems = auditTranscript(beats);
      // The press has to be writing about the case the judge decided.
      const defendant = payload.defendant.lastName;
      if (!aftermath.includes(defendant)) {
        problems.push(`AFTERMATH: never names the defendant (${defendantFullName(payload.defendant)})`);
      }
      if (path === 'ACQUITTED_ALL_EXCLUDED' && /\b(?:sentenced to|was convicted|found guilty)\b/i.test(aftermath)) {
        problems.push('AFTERMATH: reports a conviction or sentence after a full acquittal');
      }
      findings.push(...problems.map((p) => `[${path}] ${p}`));
      expect(problems).toEqual([]);
    }, 90_000);
  }

  // After the court excludes every exhibit, nothing from the recorded
  // interview may reach the record through testimony or a closing. A hard
  // gate once the case carries ruling-conditioned testimony; before that,
  // testimony is fixed text written before any ruling, so this measures the
  // known gap (written to findings.txt) instead of failing on it.
  it('keeps an excluded interview out of testimony and closings', () => {
    const plan = planPlaythrough(payload, pleaNarrative, 'ACQUITTED_ALL_EXCLUDED');
    if (plan === null) throw new Error('every case can be tried');
    const problems = auditRulingsRespected(playTranscript(payload, pleaNarrative, plan, 'The courthouse emptied.'), payload, plan);
    const enforced = hasRulingConditionedTestimony(payload);
    findings.push(...problems.map((p) => `[rulings${enforced ? '' : ', measured only'}] ${p}`));
    if (enforced) expect(problems).toEqual([]);
  });
});
