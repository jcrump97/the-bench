import { describe, it, expect, beforeAll } from 'vitest';
import { callGemini, GeminiError } from '../../geminiClient';
import { getOrSelectModel } from '../../modelSelection';
import { STAGE_RESPONSE_SCHEMAS } from '../../stages';
import { LIVE_API_KEY } from './liveEnv';

// Gemini rejects a responseSchema it finds too complex with a bare 400
// INVALID_ARGUMENT, before generating anything. A stage whose schema is
// rejected fails every request — and the repair round's schema shipped that
// way, unseen, because a sweep only reaches the repair round when an
// assembled case fails validation. So each compiled schema is sent here on
// its own, whether or not any run would reach it.
//
// Only acceptance is asserted. The output budget is kept tiny, so a call the
// API accepts typically stops at MAX_TOKENS — that is a pass: the schema was
// accepted and generation began. Only a 4xx means the schema itself failed.
//
// Paced, because a 429 is the free tier's per-minute limit (15 requests), not
// a verdict on the schema. The files run one at a time, and the one before
// this can spend most of a minute's allowance in its last seconds; firing all
// eleven probes straight after it once ran two of them out of retries on 429.
// So the probes start after a full minute's pause and go out no faster than
// one every PROBE_SPACING_MS, which keeps them under the limit on their own.
const COOL_DOWN_MS = 60_000;
const PROBE_SPACING_MS = 5_000;

describe.skipIf(LIVE_API_KEY === null)('pipeline response schemas (live)', () => {
  const apiKey = LIVE_API_KEY as string;
  let lastProbeAt = 0;

  beforeAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, COOL_DOWN_MS));
  }, COOL_DOWN_MS + 10_000);

  for (const [stage, { gemini: responseSchema }] of Object.entries(STAGE_RESPONSE_SCHEMAS)) {
    it(`accepts the ${stage} schema`, async () => {
      const model = await getOrSelectModel(apiKey);
      const wait = lastProbeAt + PROBE_SPACING_MS - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      lastProbeAt = Date.now();
      try {
        await callGemini(apiKey, model, {
          systemInstruction: 'Reply with JSON matching the schema.',
          contents: 'Return a minimal object.',
          responseSchema,
          maxOutputTokens: 64,
        });
      } catch (err) {
        const rejected = err instanceof GeminiError && err.status !== null && err.status >= 400 && err.status < 500;
        expect(rejected, `${stage}: ${err instanceof Error ? err.message : String(err)}`).toBe(false);
      }
    });
  }
});
