import { FinalResultSchema, type FinalResult } from '../schemas/gameSchemas';

// ===========================================================================
// The judge's record.
//
// The only thing this app ever persists: immutable FinalResult snapshots,
// written once when a case closes and never edited afterwards. No active game
// state, and never the API key.
//
// localStorage is a trust boundary in both directions. Anything read back has
// been sitting in a store the player can hand-edit (and that a previous
// schema version may have written), so every entry is re-parsed through
// FinalResultSchema and a failing one is dropped rather than hydrated. And
// every access is wrapped: reading `globalThis.localStorage` itself throws in
// a browser with site data blocked, and setItem throws on quota — neither may
// ever take down a game the player just finished.
// ===========================================================================

export const RESULTS_STORAGE_KEY = 'the-bench:results:v1';

// Bounded so a long-lived record cannot grow into the storage quota. Oldest
// judgments fall off the end.
export const MAX_ARCHIVED_RESULTS = 25;

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

// Newest first. Invalid entries are dropped individually — one corrupt
// snapshot must not cost the player the rest of their record.
export function loadFinalResults(): FinalResult[] {
  const store = storage();
  if (store === null) return [];

  let raw: string | null;
  try {
    raw = store.getItem(RESULTS_STORAGE_KEY);
  } catch {
    return [];
  }
  if (raw === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed.flatMap((entry) => {
    const result = FinalResultSchema.safeParse(entry);
    return result.success ? [result.data] : [];
  });
}

// Takes a validated FinalResult by type: the store's schema gate runs before
// anything reaches here, so the archive can never be the thing that persists
// an unvalidated snapshot.
export function saveFinalResult(result: FinalResult): void {
  const store = storage();
  if (store === null) return;

  const next = [result, ...loadFinalResults()].slice(0, MAX_ARCHIVED_RESULTS);
  try {
    store.setItem(RESULTS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Quota or blocked storage: the finished case still shows on screen, it
    // just does not join the record.
  }
}

export function clearFinalResults(): void {
  const store = storage();
  if (store === null) return;
  try {
    store.removeItem(RESULTS_STORAGE_KEY);
  } catch {
    // Nothing to do — the record simply stays as it was.
  }
}
