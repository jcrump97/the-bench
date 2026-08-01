/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Loads GEMINI_API_KEY from the repo-root .env (gitignored, never committed)
// into process.env, for live tests only. The default `npm test` run excludes
// this whole directory (see vite.config.ts's test.exclude and
// vitest.live.config.ts) — only `npm run test:live` reaches these files — so
// a locally present .env never makes the regular hermetic suite start
// spending real API calls.
function loadDotEnvOnce(): void {
  if (process.env.GEMINI_API_KEY !== undefined) return;
  let text: string;
  try {
    text = readFileSync(resolve(process.cwd(), '.env'), 'utf-8');
  } catch {
    return;
  }
  for (const line of text.split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!match) continue;
    const [, key, value] = match;
    if (key !== undefined && value !== undefined && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadDotEnvOnce();

// null when no key is available anywhere — every live test suite skips
// itself via describe.skipIf(LIVE_API_KEY === null) rather than failing.
export const LIVE_API_KEY: string | null = process.env.GEMINI_API_KEY ?? null;
