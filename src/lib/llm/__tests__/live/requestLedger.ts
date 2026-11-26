/// <reference types="node" />
import { appendFileSync } from 'node:fs';
import { relative } from 'node:path';
import { afterAll, expect } from 'vitest';
import { LIVE_API_KEY } from './liveEnv';

// Setup file for the live suite (vitest.live.config.ts): a ledger of every
// request made to the Gemini API with the real key, so a run can say how many
// it sent and, of those refused, which were refused by the network (no HTTP
// response at all: DNS, proxy, TLS, reset) and which by Google (an HTTP error
// status). Those need different fixes — one is the runner's network, the
// other is the request or the quota — and a failed test alone doesn't say
// which happened.
//
// One line of JSON per test file is appended to LIVE_REQUEST_LOG at the end
// of that file; the CI workflow turns the lines into the run's summary.
// Recorded per request: only the HTTP status or the network
// error's name. Never the URL's query, the headers, or the key — the key is
// only compared against, to leave out the requests a test sends with a fake
// key on purpose.

const LOG_PATH = process.env.LIVE_REQUEST_LOG ?? '/tmp/bench-live-requests.jsonl';
const API_HOST = 'generativelanguage.googleapis.com';
// From liveEnv, so a key read from a local .env is matched too.
const realKey = LIVE_API_KEY;

interface Ledger {
  requests: number;
  ok: number;
  /** HTTP status → count, for every non-2xx response. */
  refusedByGoogle: Record<string, number>;
  /** Error name/code → count, for requests that never got an HTTP response. */
  refusedByNetwork: Record<string, number>;
  /** Requests ended by the caller's own cancel or timeout signal. */
  aborted: number;
}

const ledger: Ledger = { requests: 0, ok: 0, refusedByGoogle: {}, refusedByNetwork: {}, aborted: 0 };

function bump(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

function keyOf(init: RequestInit | undefined): string | null {
  const headers = init?.headers;
  if (headers === undefined) return null;
  if (headers instanceof Headers) return headers.get('x-goog-api-key');
  if (Array.isArray(headers)) return headers.find(([name]) => name.toLowerCase() === 'x-goog-api-key')?.[1] ?? null;
  return (headers as Record<string, string>)['x-goog-api-key'] ?? null;
}

function networkErrorName(err: unknown): string {
  const cause = (err as { cause?: { code?: unknown; name?: unknown } } | null)?.cause;
  const code = cause?.code ?? cause?.name ?? (err as { name?: unknown } | null)?.name;
  return typeof code === 'string' ? code : 'unknown';
}

if (realKey !== null) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes(API_HOST) || keyOf(init) !== realKey) return realFetch(input, init);

    ledger.requests += 1;
    try {
      const response = await realFetch(input, init);
      if (response.ok) ledger.ok += 1;
      else bump(ledger.refusedByGoogle, String(response.status));
      return response;
    } catch (err) {
      if (init?.signal?.aborted) ledger.aborted += 1;
      else bump(ledger.refusedByNetwork, networkErrorName(err));
      throw err;
    }
  };

  afterAll(() => {
    const testPath = expect.getState().testPath;
    const file = testPath ? relative(process.cwd(), testPath) : 'unknown';
    try {
      appendFileSync(LOG_PATH, `${JSON.stringify({ file, ...ledger })}\n`);
    } catch {
      // The ledger is a report, never a reason for a test to fail.
    }
  });
}
