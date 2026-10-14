import { describe, it, expect } from 'vitest';
import { callGemini, GeminiError } from '../../geminiClient';
import { getOrSelectModel } from '../../modelSelection';
import { PIPELINE_RESPONSE_SCHEMAS } from '../../stages';
import { LIVE_API_KEY } from './liveEnv';

// Gemini rejects a responseSchema it finds too complex with a bare 400
// INVALID_ARGUMENT, before generating anything. A stage whose schema is
// rejected fails every request — and the repair round's schema shipped that
// way, unseen, because a sweep only reaches the repair round when an
// assembled case fails validation. So each schema is sent here on its own,
// whether or not any run would reach it.
//
// Only acceptance is asserted. The output budget is kept tiny, so a call the
// API accepts typically stops at MAX_TOKENS — that is a pass: the schema was
// accepted and generation began. Only a 4xx means the schema itself failed.
describe.skipIf(LIVE_API_KEY === null)('pipeline response schemas (live)', () => {
  const apiKey = LIVE_API_KEY as string;

  for (const [stage, responseSchema] of Object.entries(PIPELINE_RESPONSE_SCHEMAS)) {
    it(`accepts the ${stage} schema`, async () => {
      const model = await getOrSelectModel(apiKey);
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
