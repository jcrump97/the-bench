/// <reference types="node" />
import { describe, it, expect, beforeAll } from 'vitest';
import { callGemini, GeminiError } from '../../geminiClient';
import { selectModel } from '../../modelSelection';
import { STAGE_RESPONSE_SCHEMAS } from '../../stages';
import { LIVE_API_KEY } from './liveEnv';

// Does the live API accept every stage's compiled responseSchema?
//
// Gemini decides that before generating anything, and answers "no" with a bare
// 400 INVALID_ARGUMENT that names no field. The mocked suite cannot see it,
// and the diagnostic sweep only sees the stages a run actually reaches — which
// is how the repair round's schema went unnoticed: the pipeline repairs
// deterministically first, so no sweep ever sent it. This sends each schema
// once with a tiny output budget: acceptance comes back as a MAX_TOKENS stop
// (the model started writing), rejection as a 400. Eleven cheap calls.

// Rejected by the live API before this suite existed, with the hand-written
// schema as well as the compiled one: dropping any one of `defendant`,
// `charges` or `evidence` is accepted, so it reads as a size/complexity limit,
// not a bad keyword. Tracked in TODO.md (R13). `it.fails` so that the day it
// is fixed, this suite says so.
const KNOWN_REJECTED = new Set(['FinalizeCasePayload.repair']);

async function isAccepted(apiKey: string, model: string, stage: string): Promise<boolean> {
  try {
    await callGemini(apiKey, model, {
      systemInstruction: 'Return a small valid object.',
      contents: 'Begin.',
      responseSchema: STAGE_RESPONSE_SCHEMAS[stage]!.gemini,
      maxOutputTokens: 16,
    });
    return true;
  } catch (err) {
    if (err instanceof GeminiError && err.status === 400) return false;
    if (err instanceof GeminiError && err.reason === 'MAX_TOKENS') return true;
    throw err;
  }
}

describe.skipIf(LIVE_API_KEY === null)('compiled responseSchemas (live)', () => {
  let model: string;
  beforeAll(async () => {
    model = await selectModel(LIVE_API_KEY!);
  });

  for (const stage of Object.keys(STAGE_RESPONSE_SCHEMAS)) {
    const test = KNOWN_REJECTED.has(stage) ? it.fails : it;
    test(`${stage}: accepted by the API`, async () => {
      expect(await isAccepted(LIVE_API_KEY!, model, stage)).toBe(true);
    });
  }
});
