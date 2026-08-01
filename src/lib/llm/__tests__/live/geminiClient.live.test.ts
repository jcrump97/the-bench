import { describe, it, expect } from 'vitest';
import { callGemini, listModels } from '../../geminiClient';
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
});
