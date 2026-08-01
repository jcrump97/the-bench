import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { selectModel, getOrSelectModel, clearModelCache } from '../modelSelection';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('selectModel', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prefers flash-lite over flash over pro', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        models: [
          { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-flash-latest', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-flash-lite-latest', supportedGenerationMethods: ['generateContent'] },
        ],
      }),
    );

    await expect(selectModel('AIzaTestKey1234567890123456789')).resolves.toBe('gemini-flash-lite-latest');
  });

  it('excludes pro/ultra/embedding/vision models and picks the best remaining candidate', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        models: [
          { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/text-embedding-004', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-flash-latest', supportedGenerationMethods: ['generateContent'] },
        ],
      }),
    );

    await expect(selectModel('AIzaTestKey1234567890123456789')).resolves.toBe('gemini-flash-latest');
  });

  it('ignores models that do not support generateContent', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        models: [
          { name: 'models/gemini-flash-lite-latest', supportedGenerationMethods: ['embedContent'] },
          { name: 'models/gemini-flash-latest', supportedGenerationMethods: ['generateContent'] },
        ],
      }),
    );

    await expect(selectModel('AIzaTestKey1234567890123456789')).resolves.toBe('gemini-flash-latest');
  });

  it('falls back to the candidate constant when discovery rejects', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    await expect(selectModel('AIzaTestKey1234567890123456789')).resolves.toBe('gemini-flash-lite-latest');
  });

  it('falls back to the candidate constant when no model matches', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        models: [{ name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] }],
      }),
    );

    await expect(selectModel('AIzaTestKey1234567890123456789')).resolves.toBe('gemini-flash-lite-latest');
  });

  it('prefers a -latest alias over a pinned numeric build in the same tier', async () => {
    // Regression case: a live run once picked "gemini-2.0-flash-lite-001" —
    // a build ListModels still listed as generateContent-capable but that
    // had actually been retired (generateContent 404'd) — ahead of
    // "gemini-flash-lite-latest", which Google keeps pointing at a working
    // model. Deliberately listed in the retirement-prone order first.
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        models: [
          { name: 'models/gemini-2.0-flash-lite-001', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-2.0-flash-lite', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-flash-lite-latest', supportedGenerationMethods: ['generateContent'] },
        ],
      }),
    );

    await expect(selectModel('AIzaTestKey1234567890123456789')).resolves.toBe('gemini-flash-lite-latest');
  });

  it('deprioritizes preview and dated-snapshot builds behind a plain or -latest name', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        models: [
          { name: 'models/gemini-3-flash-preview', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-2.5-computer-use-preview-10-2025', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
        ],
      }),
    );

    await expect(selectModel('AIzaTestKey1234567890123456789')).resolves.toBe('gemini-2.5-flash');
  });

  it('excludes specialist non-text families even when the name contains "flash"', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        models: [
          { name: 'models/gemini-3.1-flash-lite-image', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-2.5-flash-preview-tts', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-flash-latest', supportedGenerationMethods: ['generateContent'] },
        ],
      }),
    );

    await expect(selectModel('AIzaTestKey1234567890123456789')).resolves.toBe('gemini-flash-latest');
  });
});

describe('getOrSelectModel', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    clearModelCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearModelCache();
  });

  it('discovers the model only once for the same key across separate calls', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      jsonResponse({
        models: [{ name: 'models/gemini-flash-lite-latest', supportedGenerationMethods: ['generateContent'] }],
      }),
    );

    const key = 'AIzaTestKey1234567890123456789';
    const first = await getOrSelectModel(key);
    const second = await getOrSelectModel(key);

    expect(first).toBe('gemini-flash-lite-latest');
    expect(second).toBe('gemini-flash-lite-latest');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('discovers independently per distinct API key', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      jsonResponse({
        models: [{ name: 'models/gemini-flash-lite-latest', supportedGenerationMethods: ['generateContent'] }],
      }),
    );

    await getOrSelectModel('AIzaKeyOne1234567890123456789');
    await getOrSelectModel('AIzaKeyTwo1234567890123456789');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('discovers again after clearModelCache', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      jsonResponse({
        models: [{ name: 'models/gemini-flash-lite-latest', supportedGenerationMethods: ['generateContent'] }],
      }),
    );

    const key = 'AIzaTestKey1234567890123456789';
    await getOrSelectModel(key);
    clearModelCache();
    await getOrSelectModel(key);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
