import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  selectModel,
  getOrSelectModel,
  clearModelCache,
  chooseModel,
  MAX_COST_PER_CASE_USD,
} from '../modelSelection';
import type { RawModel } from '../geminiClient';
import { costPerCase, findPricedModel, priceOn } from '../modelPricing';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// A fresh Response per call: a body can be read once, and a reused one fails
// every call after the first — which selectModel would quietly paper over by
// falling back to its hardcoded candidate.
function liteLatestModels(): Response {
  return jsonResponse({
    models: [{ name: 'models/gemini-flash-lite-latest', supportedGenerationMethods: ['generateContent'] }],
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
    // fetchWithRetry's hardened backoff (5 attempts, up to ~15s ceiling) is
    // real wall-clock time without fake timers — this exercises every
    // retry, so it needs them to stay fast.
    vi.useFakeTimers();
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValue(new Error('network down'));

    const promise = selectModel('AIzaTestKey1234567890123456789');
    const expectation = expect(promise).resolves.toBe('gemini-flash-lite-latest');
    await vi.runAllTimersAsync();
    await expectation;
    vi.useRealTimers();
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

function model(name: string, extra: Partial<RawModel> = {}): RawModel {
  return { name: `models/${name}`, supportedGenerationMethods: ['generateContent'], ...extra };
}

const NOV_26_2026 = new Date('2026-11-26T12:00:00Z');

describe('chooseModel (priced)', () => {
  const CURRENT_LINEUP = [
    model('gemini-flash-lite-latest'),
    model('gemini-flash-latest'),
    model('gemini-2.5-flash-lite'),
    model('gemini-3.1-flash-lite'),
    model('gemini-3.5-flash-lite'),
    model('gemini-3.6-flash'),
    model('gemini-3.8-flash'),
    model('gemini-4-argon'),
    model('gemini-3.1-pro-preview'),
  ];

  it('picks a concrete priced model over any alias or unpriced name', () => {
    expect(chooseModel(CURRENT_LINEUP, NOV_26_2026)).toBe('gemini-3.5-flash-lite');
  });

  it('picks the newest model within the per-case budget, not the cheapest alone', () => {
    // 3.1 Flash-Lite is cheaper per case, but 3.5 Flash-Lite is newer and
    // within budget; 3.8 Flash is newer still but over it.
    const lineup = [model('gemini-3.1-flash-lite'), model('gemini-3.5-flash-lite'), model('gemini-3.8-flash')];
    expect(chooseModel(lineup, NOV_26_2026)).toBe('gemini-3.5-flash-lite');
  });

  it('places the 2026-11-26 table on the budget as the selector comments describe', () => {
    const costOn = (id: string, day: Date): number => {
      const entry = findPricedModel(id);
      const price = entry === undefined ? null : priceOn(entry, day);
      if (price === null) throw new Error(`${id} is not priced on ${day.toISOString()}`);
      return costPerCase(price);
    };
    expect(costOn('gemini-3.1-flash-lite', NOV_26_2026)).toBeLessThanOrEqual(MAX_COST_PER_CASE_USD);
    expect(costOn('gemini-3.5-flash-lite', NOV_26_2026)).toBeLessThanOrEqual(MAX_COST_PER_CASE_USD);
    expect(costOn('gemini-3.8-flash', NOV_26_2026)).toBeGreaterThan(MAX_COST_PER_CASE_USD);
    expect(costOn('gemini-3.6-flash', NOV_26_2026)).toBeGreaterThan(MAX_COST_PER_CASE_USD);
  });

  it('chooses only among models ListModels returned, whatever the table holds', () => {
    expect(chooseModel([model('gemini-3.1-flash-lite'), model('gemini-3.6-flash')], NOV_26_2026)).toBe(
      'gemini-3.1-flash-lite',
    );
  });

  it('skips a priced model on or after its shutdown day, even while ListModels still lists it', () => {
    const lineup = [model('gemini-3.1-flash-lite'), model('gemini-flash-lite-latest')];
    expect(chooseModel(lineup, new Date('2027-05-06T23:59:59Z'))).toBe('gemini-3.1-flash-lite');
    // Shut down, and known to be: the unpriced alias takes over.
    expect(chooseModel(lineup, new Date('2027-05-07T00:00:00Z'))).toBe('gemini-flash-lite-latest');
  });

  it('uses the cheapest priced model when none is within budget, newest on a tie', () => {
    const lineup = [model('gemini-3.6-flash'), model('gemini-3.8-flash')];
    // 3.8 Flash's introductory price makes it the cheaper of the two.
    expect(chooseModel(lineup, new Date('2026-12-31T12:00:00Z'))).toBe('gemini-3.8-flash');
    // From 2027-01-01 both cost the same; the newer one wins.
    expect(chooseModel(lineup, new Date('2027-01-01T12:00:00Z'))).toBe('gemini-3.8-flash');
    expect(chooseModel([model('gemini-3.6-flash')], new Date('2027-01-01T12:00:00Z'))).toBe('gemini-3.6-flash');
  });

  it('rejects a model whose reported output limit is below what every call asks for', () => {
    const lineup = [model('gemini-3.5-flash-lite', { outputTokenLimit: 8_192 }), model('gemini-3.1-flash-lite')];
    expect(chooseModel(lineup, NOV_26_2026)).toBe('gemini-3.1-flash-lite');
  });

  it('rejects a model whose reported input limit is too small, and accepts one that reports none', () => {
    const lineup = [model('gemini-3.5-flash-lite', { inputTokenLimit: 4_096 }), model('gemini-3.1-flash-lite')];
    expect(chooseModel(lineup, NOV_26_2026)).toBe('gemini-3.1-flash-lite');
    expect(
      chooseModel([model('gemini-3.5-flash-lite', { inputTokenLimit: 1_048_576, outputTokenLimit: 65_536 })], NOV_26_2026),
    ).toBe('gemini-3.5-flash-lite');
  });

  it('ignores a priced model that does not support generateContent', () => {
    const lineup = [
      { name: 'models/gemini-3.5-flash-lite', supportedGenerationMethods: ['embedContent'] },
      model('gemini-3.1-flash-lite'),
    ];
    expect(chooseModel(lineup, NOV_26_2026)).toBe('gemini-3.1-flash-lite');
  });

  it('falls back to the unpriced ranking when no listed model is priced', () => {
    const lineup = [model('gemini-4-argon'), model('gemini-flash-latest'), model('gemini-flash-lite-latest')];
    expect(chooseModel(lineup, NOV_26_2026)).toBe('gemini-flash-lite-latest');
  });

  it('returns null when nothing survives the filters', () => {
    expect(chooseModel([model('gemini-2.5-pro'), model('text-embedding-004')], NOV_26_2026)).toBeNull();
  });

  it('is deterministic regardless of the order ListModels returns', () => {
    const reversed = [...CURRENT_LINEUP].reverse();
    expect(chooseModel(reversed, NOV_26_2026)).toBe(chooseModel(CURRENT_LINEUP, NOV_26_2026));
  });
});

describe('selectModel (priced)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads token limits from ListModels and returns the priced pick for the given day', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        models: [
          {
            name: 'models/gemini-3.5-flash-lite',
            supportedGenerationMethods: ['generateContent'],
            inputTokenLimit: 1_048_576,
            outputTokenLimit: 65_536,
          },
          { name: 'models/gemini-flash-lite-latest', supportedGenerationMethods: ['generateContent'] },
        ],
      }),
    );

    await expect(selectModel('AIzaTestKey1234567890123456789', NOV_26_2026)).resolves.toBe('gemini-3.5-flash-lite');
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
    fetchMock.mockImplementation(async () => liteLatestModels());

    const key = 'AIzaTestKey1234567890123456789';
    const first = await getOrSelectModel(key);
    const second = await getOrSelectModel(key);

    expect(first).toBe('gemini-flash-lite-latest');
    expect(second).toBe('gemini-flash-lite-latest');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('discovers independently per distinct API key', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async () => liteLatestModels());

    expect(await getOrSelectModel('AIzaKeyOne1234567890123456789')).toBe('gemini-flash-lite-latest');
    expect(await getOrSelectModel('AIzaKeyTwo1234567890123456789')).toBe('gemini-flash-lite-latest');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('discovers again after clearModelCache', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async () => liteLatestModels());

    const key = 'AIzaTestKey1234567890123456789';
    await getOrSelectModel(key);
    clearModelCache();
    expect(await getOrSelectModel(key)).toBe('gemini-flash-lite-latest');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
