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
    expect(fetchMock).toHaveBeenCalledTimes(3);
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
