import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  RESULTS_STORAGE_KEY,
  MAX_ARCHIVED_RESULTS,
  loadFinalResults,
  saveFinalResult,
  clearFinalResults,
} from '../resultArchive';
import { buildFinalResult } from '../resultGenerator';
import { FinalResultSchema, type FinalResult } from '../../schemas/gameSchemas';
import { webbCase } from '../demoCases/webb';

// A real, schema-valid snapshot — the archive only ever handles validated
// results, so the fixtures are built the same way the game builds them.
function result(overrides: Partial<FinalResult> = {}): FinalResult {
  const candidate = buildFinalResult({
    caseData: webbCase.payload,
    pleaNarrative: webbCase.pleaNarrative,
    pleaDecision: 'ACCEPT',
    motionRulings: [],
    chargeVerdicts: [],
    imposedSentence: [{ type: 'PRISON', unit: 'YEARS', amount: 2 }],
    aftermathNarrative: 'The courthouse emptied by four.',
    completedAt: '2026-08-23T17:04:05.000Z',
  });
  return { ...FinalResultSchema.parse(candidate), ...overrides } as FinalResult;
}

// Minimal in-memory Storage stand-in: node has no localStorage, and the real
// one is a trust boundary this module has to treat as hostile anyway.
function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() { return data.size; },
    raw: data,
  };
}

let store: ReturnType<typeof fakeStorage>;

beforeEach(() => {
  store = fakeStorage();
  vi.stubGlobal('localStorage', store);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('resultArchive — round trip', () => {
  it('reads back what it wrote', () => {
    const saved = result();
    saveFinalResult(saved);
    expect(loadFinalResults()).toEqual([saved]);
  });

  it('returns an empty record before anything is decided', () => {
    expect(loadFinalResults()).toEqual([]);
  });

  it('lists the most recent judgment first', () => {
    const first = result({ completedAt: '2026-08-01T10:00:00.000Z' });
    const second = result({ completedAt: '2026-08-02T10:00:00.000Z' });
    saveFinalResult(first);
    saveFinalResult(second);
    expect(loadFinalResults().map((r) => r.completedAt)).toEqual([second.completedAt, first.completedAt]);
  });

  it('keeps a bounded history, dropping the oldest judgments', () => {
    for (let i = 0; i < MAX_ARCHIVED_RESULTS + 3; i++) {
      saveFinalResult(result({ completedAt: `2026-08-23T17:0${i % 10}:0${i % 10}.000Z` }));
    }
    expect(loadFinalResults()).toHaveLength(MAX_ARCHIVED_RESULTS);
  });

  it('clears the whole record', () => {
    saveFinalResult(result());
    clearFinalResults();
    expect(loadFinalResults()).toEqual([]);
  });
});

describe('resultArchive — localStorage is a trust boundary', () => {
  it('drops a hand-edited entry that no longer passes FinalResultSchema', () => {
    const good = result();
    store.raw.set(RESULTS_STORAGE_KEY, JSON.stringify([{ ...good, imposedSentence: 'twenty years' }, good]));
    expect(loadFinalResults()).toEqual([good]);
  });

  it('survives stored content that is not an array of results', () => {
    for (const junk of ['not json at all', '{"results":1}', '"a string"', 'null', '[1,2,3]']) {
      store.raw.set(RESULTS_STORAGE_KEY, junk);
      expect(loadFinalResults()).toEqual([]);
    }
  });
});

describe('resultArchive — storage failures never reach the game', () => {
  it('degrades to an empty record when localStorage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(() => saveFinalResult(result())).not.toThrow();
    expect(loadFinalResults()).toEqual([]);
  });

  it('degrades when reading or writing throws (quota, blocked site data)', () => {
    vi.spyOn(store, 'getItem').mockImplementation(() => { throw new Error('SecurityError'); });
    vi.spyOn(store, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    expect(() => saveFinalResult(result())).not.toThrow();
    expect(loadFinalResults()).toEqual([]);
  });
});
