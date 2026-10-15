/// <reference types="node" />
import { writeFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import { createGameService } from '../../gameService';
import { setGenerationObserver, type GenerationAttemptFailure } from '../../generationObserver';
import { LIVE_API_KEY } from './liveEnv';

// A measuring instrument, not a gate.
//
// gameService.live.test.ts proves the pipeline *can* succeed once. That
// catches a total outage and nothing else — it cannot see a 70% failure rate,
// which is exactly the symptom this suite exists to diagnose. This test runs
// the full pipeline several times and reports where the failures actually
// land: which stage, which field, which constraint, how often.
//
// It asserts nothing about the results on purpose. A run that mistrials 5/5
// is a *successful measurement*; failing the suite on it would just hide the
// table you came here to read. Costs a real case generation per run — like
// the rest of this directory, it only runs under `npm run test:live`.

const RUNS = Number(process.env.DIAGNOSTIC_RUNS ?? 5);
const REPORT_PATH = process.env.DIAGNOSTIC_REPORT ?? '/tmp/bench-pipeline-diagnostic.txt';
// A pause between runs, so a sweep stays inside a free-tier per-minute quota
// instead of measuring the rate limiter: a case is eight or nine calls, two at
// a time, and back-to-back cases would stack them into the same minute.
const PAUSE_MS = Number(process.env.DIAGNOSTIC_PAUSE_MS ?? 60_000);
// Sequential pipelines, each 8+ Gemini calls that may retry twice over, plus
// the pauses. The config-level testTimeout (60s) is sized for a single call.
const TIMEOUT_MS = RUNS * 300_000 + Math.max(0, RUNS - 1) * PAUSE_MS;

interface RunOutcome {
  ok: boolean;
  /** The stage whose exhausted retries ended the run; null when it succeeded. */
  failedStage: string | null;
  message: string | null;
  ms: number;
  /** generateContent requests sent, retries included. */
  calls: number;
  /** Responses with HTTP 429 (rate limited), each retried by the transport. */
  rateLimited: number;
  /** Failed attempts the observer saw during this run (survived or not). */
  failedAttempts: number;
  promptTokens: number;
  outputTokens: number;
}

interface CallCounter {
  calls: number;
  rateLimited: number;
  promptTokens: number;
  outputTokens: number;
}

// Counts what each run costs by watching the requests it makes. Only the
// method, status and usageMetadata are read; the request (and the key in its
// header) is passed through untouched and never recorded.
function meterFetch(counter: CallCounter): () => void {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const response = await realFetch(input, init);
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes(':generateContent')) {
      counter.calls += 1;
      if (response.status === 429) counter.rateLimited += 1;
      if (response.ok) {
        try {
          const body = (await response.clone().json()) as {
            usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
          };
          counter.promptTokens += body.usageMetadata?.promptTokenCount ?? 0;
          counter.outputTokens += body.usageMetadata?.candidatesTokenCount ?? 0;
        } catch {
          // A body that isn't JSON is the pipeline's problem to report, not the meter's.
        }
      }
    }
    return response;
  };
  return () => {
    globalThis.fetch = realFetch;
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid] ?? 0;
  return sorted.length % 2 === 1 ? upper : ((sorted[mid - 1] ?? 0) + upper) / 2;
}

function tally<T>(items: T[], key: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

function ranked(counts: Map<string, number>): [string, number][] {
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

// "evidence.0.rulingOptions: No judge-line option covers choice EXCLUDED"
// collapses to "evidence[].rulingOptions" so the same constraint failing on
// three different exhibits ranks as one problem worth three hits, rather than
// three problems worth one each.
function normalizeIssuePath(issue: string): string {
  const path = issue.split(':')[0] ?? issue;
  return path.replace(/\.\d+/g, '[]');
}

function renderTable(title: string, rows: [string, number][]): string {
  if (rows.length === 0) return `\n${title}\n  (none)`;
  const width = Math.max(...rows.map(([label]) => label.length));
  const body = rows.map(([label, count]) => `  ${String(count).padStart(4)}  ${label.padEnd(width)}`);
  return `\n${title}\n${body.join('\n')}`;
}

describe.skipIf(LIVE_API_KEY === null)('Generation pipeline diagnostic (live)', () => {
  const apiKey = LIVE_API_KEY as string;

  it(
    `measures the end-to-end failure rate over ${RUNS} runs and ranks the causes`,
    async () => {
      const failures: GenerationAttemptFailure[] = [];
      const outcomes: RunOutcome[] = [];

      setGenerationObserver((failure) => failures.push(failure));
      const counter: CallCounter = { calls: 0, rateLimited: 0, promptTokens: 0, outputTokens: 0 };
      const restoreFetch = meterFetch(counter);
      try {
        for (let run = 0; run < RUNS; run++) {
          if (run > 0 && PAUSE_MS > 0) await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
          const before = { ...counter, failures: failures.length };
          const started = Date.now();
          const cost = () => ({
            ms: Date.now() - started,
            calls: counter.calls - before.calls,
            rateLimited: counter.rateLimited - before.rateLimited,
            failedAttempts: failures.length - before.failures,
            promptTokens: counter.promptTokens - before.promptTokens,
            outputTokens: counter.outputTokens - before.outputTokens,
          });
          try {
            await createGameService(apiKey).generateCase();
            outcomes.push({ ok: true, failedStage: null, message: null, ...cost() });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            // GameServiceError messages are "[StageName] Failed to ...".
            const stage = /^\[([^\]]+)\]/.exec(message)?.[1] ?? 'unknown';
            outcomes.push({ ok: false, failedStage: stage, message, ...cost() });
          }
        }
      } finally {
        restoreFetch();
        setGenerationObserver(null);
      }

      const succeeded = outcomes.filter((o) => o.ok).length;
      const schemaFailures = failures.filter((f) => f.kind === 'SCHEMA');
      const issues = schemaFailures.flatMap((f) => f.issues);

      // One row per stage × schema-shape pair: "InterrogationGen: [detectiveName, outcome, ...]"
      // vs "EnvironmentGen: [environment]". A stage whose Gemini responseSchema
      // top-level keys don't match its Zod wrapper (e.g. unwrapped `{detectiveName,...}`
      // when Zod expects `{interrogation: {...}}`) shows up here as a mismatch
      // against the other stages' wrapped shapes — the exact divergence that
      // made InterrogationGen return the wrong shape and Zod reject it with
      // `interrogation: Invalid input`.
      const shapeRows = ranked(
        tally(
          schemaFailures,
          (f) => `${f.stage}: [${(f.schemaShape ?? []).join(', ')}]`,
        ),
      );

      const report = [
        '='.repeat(72),
        `PIPELINE DIAGNOSTIC — ${succeeded}/${RUNS} runs produced a valid case ` +
          `(${Math.round((succeeded / RUNS) * 100)}%)`,
        '='.repeat(72),
        '\nPer run (time, generateContent calls incl. retries, 429s, failed attempts, tokens in/out):',
        ...outcomes.map(
          (o, i) =>
            `  run ${String(i + 1).padStart(2)}  ${o.ok ? 'ok      ' : 'MISTRIAL'}  ${(o.ms / 1000).toFixed(1).padStart(6)}s  ` +
            `${String(o.calls).padStart(3)} calls  ${String(o.rateLimited).padStart(2)} x429  ` +
            `${String(o.failedAttempts).padStart(2)} failed  ${o.promptTokens} in / ${o.outputTokens} out`,
        ),
        `  median ${(median(outcomes.map((o) => o.ms)) / 1000).toFixed(1)}s per case, ` +
          `${median(outcomes.map((o) => o.calls))} calls per case, ` +
          `${outcomes.filter((o) => o.failedAttempts === 0).length}/${RUNS} runs with zero failed attempts, ` +
          `${outcomes.reduce((n, o) => n + o.rateLimited, 0)} rate-limited responses in total`,
        renderTable(
          'Runs killed by stage (exhausted all attempts):',
          ranked(tally(outcomes.filter((o) => !o.ok), (o) => o.failedStage ?? 'unknown')),
        ),
        renderTable(
          'Failed attempts by stage (survivable retries included):',
          ranked(tally(failures, (f) => f.stage)),
        ),
        renderTable('Failed attempts by kind:', ranked(tally(failures, (f) => f.kind))),
        renderTable('Schema response shape by stage (top-level Gemini keys):', shapeRows),
        renderTable('Schema violations by field path:', ranked(tally(issues, normalizeIssuePath))),
        renderTable('Schema violations, full message:', ranked(tally(issues, (issue) => issue))),
        ...outcomes.filter((o) => !o.ok).map((o) => `\nFATAL: ${o.message}`),
        '',
      ].join('\n');

      // Written to a file, not just logged: vitest's reporter swallows test
      // console output depending on how the run is invoked, and a measurement
      // that costs five real case generations must not be recoverable only
      // from a terminal scrollback.
      writeFileSync(REPORT_PATH, report);
      console.error(`\n${report}\nDiagnostic report written to ${REPORT_PATH}`);
    },
    TIMEOUT_MS,
  );
});
