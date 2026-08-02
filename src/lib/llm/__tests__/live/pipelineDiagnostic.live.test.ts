/* eslint-disable no-console -- The report *is* this file's output. It runs
   only under `npm run test:live`, never in the app bundle, and console.warn
   would misrepresent a successful measurement as a problem. */
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

const RUNS = 5;
// Five sequential pipelines, each 7+ Gemini calls that may retry twice over.
// The config-level testTimeout (60s) is sized for a single call.
const TIMEOUT_MS = 900_000;

interface RunOutcome {
  ok: boolean;
  /** The stage whose exhausted retries ended the run; null when it succeeded. */
  failedStage: string | null;
  message: string | null;
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

function printTable(title: string, rows: [string, number][]): void {
  console.log(`\n${title}`);
  if (rows.length === 0) {
    console.log('  (none)');
    return;
  }
  const width = Math.max(...rows.map(([label]) => label.length));
  for (const [label, count] of rows) {
    console.log(`  ${String(count).padStart(4)}  ${label.padEnd(width)}`);
  }
}

describe.skipIf(LIVE_API_KEY === null)('Generation pipeline diagnostic (live)', () => {
  const apiKey = LIVE_API_KEY as string;

  it(
    `measures the end-to-end failure rate over ${RUNS} runs and ranks the causes`,
    async () => {
      const failures: GenerationAttemptFailure[] = [];
      const outcomes: RunOutcome[] = [];

      setGenerationObserver((failure) => failures.push(failure));
      try {
        for (let run = 0; run < RUNS; run++) {
          try {
            await createGameService(apiKey).generateCase();
            outcomes.push({ ok: true, failedStage: null, message: null });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            // GameServiceError messages are "[StageName] Failed to ...".
            const stage = /^\[([^\]]+)\]/.exec(message)?.[1] ?? 'unknown';
            outcomes.push({ ok: false, failedStage: stage, message });
          }
        }
      } finally {
        setGenerationObserver(null);
      }

      const succeeded = outcomes.filter((o) => o.ok).length;
      const schemaFailures = failures.filter((f) => f.kind === 'SCHEMA');
      const issues = schemaFailures.flatMap((f) => f.issues);

      console.log('\n' + '='.repeat(72));
      console.log(`PIPELINE DIAGNOSTIC — ${succeeded}/${RUNS} runs produced a valid case ` +
        `(${Math.round((succeeded / RUNS) * 100)}%)`);
      console.log('='.repeat(72));

      printTable(
        'Runs killed by stage (exhausted all attempts):',
        ranked(tally(outcomes.filter((o) => !o.ok), (o) => o.failedStage ?? 'unknown')),
      );
      printTable(
        'Failed attempts by stage (survivable retries included):',
        ranked(tally(failures, (f) => f.stage)),
      );
      printTable('Failed attempts by kind:', ranked(tally(failures, (f) => f.kind)));
      printTable('Schema violations by field path:', ranked(tally(issues, normalizeIssuePath)));
      printTable('Schema violations, full message:', ranked(tally(issues, (issue) => issue)));

      for (const outcome of outcomes.filter((o) => !o.ok)) {
        console.log(`\nFATAL: ${outcome.message}`);
      }
      console.log('');
    },
    TIMEOUT_MS,
  );
});
