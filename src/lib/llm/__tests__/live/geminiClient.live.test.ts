import { describe, it, expect } from 'vitest';
import { callGemini, listModels, GeminiError } from '../../geminiClient';
import { LIVE_API_KEY } from './liveEnv';

// Real network calls to the Gemini API. Runs only via `npm run test:live`
// with a real key present (see liveEnv.ts) — skipped everywhere else.
describe.skipIf(LIVE_API_KEY === null)('geminiClient (live)', () => {
  const apiKey = LIVE_API_KEY as string;

  it('lists at least one model that supports generateContent', async () => {
    const models = await listModels(apiKey);
    expect(models.length).toBeGreaterThan(0);
    expect(models.some((m) => m.supportedGenerationMethods?.includes('generateContent'))).toBe(true);
  });

  it('calls generateContent and returns schema-shaped JSON', async () => {
    const text = await callGemini(apiKey, 'gemini-flash-lite-latest', {
      systemInstruction: 'Reply with JSON only, matching the given schema exactly.',
      contents: 'Return a greeting field containing the single word "hello".',
      responseSchema: {
        type: 'object',
        properties: { greeting: { type: 'string' } },
        required: ['greeting'],
      },
    });

    const parsed: unknown = JSON.parse(text);
    expect(typeof (parsed as { greeting?: unknown }).greeting).toBe('string');
  });

  // What a player with a mistyped or revoked key meets. The transport retries
  // 429s and 5xx with backoff; a 4xx must not be retried, or the player waits
  // through five attempts and a growing backoff to be told the key is wrong.
  // Costs nothing: Google refuses the request before any generation.
  it('refuses a bad key with one 4xx request, not a retry storm', async () => {
    let requests = 0;
    const realFetch = globalThis.fetch;
    globalThis.fetch = (input, init) => {
      requests += 1;
      return realFetch(input, init);
    };
    let error: unknown;
    try {
      await callGemini('not-a-real-key-live-test', 'gemini-flash-lite-latest', {
        systemInstruction: 'Reply with JSON.',
        contents: 'Return an empty object.',
        responseSchema: { type: 'object', properties: { ok: { type: 'boolean' } } },
      });
    } catch (err) {
      error = err;
    } finally {
      globalThis.fetch = realFetch;
    }
    expect(error).toBeInstanceOf(GeminiError);
    const status = (error as GeminiError).status;
    expect(status).not.toBeNull();
    expect(status).toBeGreaterThanOrEqual(400);
    expect(status).toBeLessThan(500);
    expect(requests).toBe(1);
  });
});
