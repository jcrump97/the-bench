import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { selectModel } from '../modelSelection';

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
});
