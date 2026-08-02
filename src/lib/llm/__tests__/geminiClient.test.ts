import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callGemini, listModels, GeminiError } from '../geminiClient';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function textResponse(body: string, status: number): Response {
  return new Response(body, { status });
}

describe('callGemini', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('parses candidate text on success', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }),
    );

    const promise = callGemini('AIzaTestKey1234567890123456789', 'gemini-flash-latest', {
      systemInstruction: 'sys',
      contents: 'content',
      responseSchema: { type: 'object' },
    });

    await expect(promise).resolves.toBe('{"ok":true}');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    expect(String(call?.[0])).toContain('gemini-flash-latest:generateContent');
  });

  it('sets a moderate temperature for schema-compliant-but-varied output', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }),
    );

    await callGemini('AIzaTestKey1234567890123456789', 'gemini-flash-latest', {
      systemInstruction: 'sys',
      contents: 'content',
      responseSchema: { type: 'object' },
    });

    const call = fetchMock.mock.calls[0];
    const body = JSON.parse(String(call?.[1]?.body));
    expect(body.generationConfig.temperature).toBe(0.7);
  });

  it('retries on a 429 then succeeds', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(textResponse('rate limited', 429))
      .mockResolvedValueOnce(
        jsonResponse({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }),
      );

    const promise = callGemini('AIzaTestKey1234567890123456789', 'gemini-flash-latest', {
      systemInstruction: 'sys',
      contents: 'content',
      responseSchema: { type: 'object' },
    });
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe('{"ok":true}');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries on 5xx then throws after exhausting attempts', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(textResponse('server error', 503));

    const promise = callGemini('AIzaTestKey1234567890123456789', 'gemini-flash-latest', {
      systemInstruction: 'sys',
      contents: 'content',
      responseSchema: { type: 'object' },
    });
    const expectation = expect(promise).rejects.toThrow(GeminiError);
    await vi.runAllTimersAsync();
    await expectation;
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('honors a Retry-After header on a 429 instead of the computed backoff', async () => {
    const fetchMock = vi.mocked(fetch);
    const retryAfterResponse = new Response('rate limited', {
      status: 429,
      headers: { 'Retry-After': '3' },
    });
    fetchMock
      .mockResolvedValueOnce(retryAfterResponse)
      .mockResolvedValueOnce(
        jsonResponse({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }),
      );

    const promise = callGemini('AIzaTestKey1234567890123456789', 'gemini-flash-latest', {
      systemInstruction: 'sys',
      contents: 'content',
      responseSchema: { type: 'object' },
    });

    // Advancing by less than the header's 3s shouldn't be enough to fire the
    // second attempt yet.
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2500);
    await expect(promise).resolves.toBe('{"ok":true}');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws immediately on a 4xx without retrying', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(textResponse('bad key', 400));

    await expect(
      callGemini('AIzaTestKey1234567890123456789', 'gemini-flash-latest', {
        systemInstruction: 'sys',
        contents: 'content',
        responseSchema: { type: 'object' },
      }),
    ).rejects.toThrow(/400/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws when the response has no candidate text', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ candidates: [] }));

    await expect(
      callGemini('AIzaTestKey1234567890123456789', 'gemini-flash-latest', {
        systemInstruction: 'sys',
        contents: 'content',
        responseSchema: { type: 'object' },
      }),
    ).rejects.toThrow(/no candidate text/i);
  });

  it('throws with reason NO_CANDIDATE when the response has no candidate text', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ candidates: [] }));

    const promise = callGemini('AIzaTestKey1234567890123456789', 'gemini-flash-latest', {
      systemInstruction: 'sys',
      contents: 'content',
      responseSchema: { type: 'object' },
    });

    await expect(promise).rejects.toMatchObject({ name: 'GeminiError', reason: 'NO_CANDIDATE' });
  });

  it('throws with reason MAX_TOKENS on a truncated candidate, even when partial text is present', async () => {
    // Handing truncated text back as if it were a complete response is the
    // exact bug this guards against: a MAX_TOKENS finish always means the
    // JSON is cut off mid-object, regardless of what text did make it through.
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        candidates: [
          { content: { parts: [{ text: '{"evidence": [{"id": "e1", "name": "Partial' }] }, finishReason: 'MAX_TOKENS' },
        ],
      }),
    );

    const promise = callGemini('AIzaTestKey1234567890123456789', 'gemini-flash-latest', {
      systemInstruction: 'sys',
      contents: 'content',
      responseSchema: { type: 'object' },
    });

    await expect(promise).rejects.toMatchObject({ name: 'GeminiError', reason: 'MAX_TOKENS' });
  });

  it('throws with reason SAFETY when promptFeedback carries a blockReason', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ candidates: [], promptFeedback: { blockReason: 'SAFETY' } }),
    );

    const promise = callGemini('AIzaTestKey1234567890123456789', 'gemini-flash-latest', {
      systemInstruction: 'sys',
      contents: 'content',
      responseSchema: { type: 'object' },
    });

    await expect(promise).rejects.toMatchObject({ name: 'GeminiError', reason: 'SAFETY' });
  });

  it('throws with reason SAFETY when a candidate finishes with finishReason SAFETY', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        candidates: [{ content: { parts: [{ text: '{"partial":' }] }, finishReason: 'SAFETY' }],
      }),
    );

    const promise = callGemini('AIzaTestKey1234567890123456789', 'gemini-flash-latest', {
      systemInstruction: 'sys',
      contents: 'content',
      responseSchema: { type: 'object' },
    });

    await expect(promise).rejects.toMatchObject({ name: 'GeminiError', reason: 'SAFETY' });
  });

  it('has no reason on a normal successful response', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] }, finishReason: 'STOP' }] }),
    );

    const result = await callGemini('AIzaTestKey1234567890123456789', 'gemini-flash-latest', {
      systemInstruction: 'sys',
      contents: 'content',
      responseSchema: { type: 'object' },
    });

    expect(result).toBe('{"ok":true}');
  });

  it('sends safetySettings and a generationConfig.maxOutputTokens in the request body', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }),
    );

    await callGemini('AIzaTestKey1234567890123456789', 'gemini-flash-latest', {
      systemInstruction: 'sys',
      contents: 'content',
      responseSchema: { type: 'object' },
    });

    const call = fetchMock.mock.calls[0];
    const body = JSON.parse(String(call?.[1]?.body));
    expect(typeof body.generationConfig.maxOutputTokens).toBe('number');
    expect(Array.isArray(body.safetySettings)).toBe(true);
    expect(body.safetySettings.length).toBeGreaterThan(0);
    expect(body.safetySettings[0]).toHaveProperty('category');
    expect(body.safetySettings[0]).toHaveProperty('threshold');
  });
});

describe('listModels', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses a models list response', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        models: [
          { name: 'models/gemini-flash-latest', supportedGenerationMethods: ['generateContent'] },
        ],
      }),
    );

    const models = await listModels('AIzaTestKey1234567890123456789');
    expect(models).toEqual([
      { name: 'models/gemini-flash-latest', supportedGenerationMethods: ['generateContent'] },
    ]);
  });

  it('returns an empty array when the response omits models', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({}));

    await expect(listModels('AIzaTestKey1234567890123456789')).resolves.toEqual([]);
  });
});
