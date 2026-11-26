// Turns a live-suite run's outputs into the job summary: each test's result,
// what the run cost in requests and how any refused request was refused, and
// the pipeline diagnostic's headline. Reads files only; prints nothing secret
// (no file it reads ever held the key).
//
// Usage: node .github/scripts/live-summary.mjs <output-dir>  (appends Markdown to stdout)

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] ?? '/tmp/live-output';
const read = (name) => {
  const path = join(dir, name);
  return existsSync(path) ? readFileSync(path, 'utf-8') : null;
};
const unescape = (s) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const cell = (s) => s.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
const out = ['## Live Gemini tests', ''];

const junit = read('junit.xml');
if (junit === null) {
  out.push('No test results were written: the suite did not run to completion.', '');
} else {
  const rows = [];
  for (const m of junit.matchAll(/<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g)) {
    const attrs = m[1];
    const body = m[3] ?? '';
    const name = unescape(/\bname="([^"]*)"/.exec(attrs)?.[1] ?? '?');
    const file = unescape(/\bclassname="([^"]*)"/.exec(attrs)?.[1] ?? '').replace(/^.*\//, '');
    const seconds = Number(/\btime="([^"]*)"/.exec(attrs)?.[1] ?? 0);
    const result = /<failure|<error/.test(body) ? 'FAIL' : /<skipped/.test(body) ? 'skipped' : 'pass';
    rows.push({ file, name, seconds, result });
  }
  const count = (r) => rows.filter((row) => row.result === r).length;
  out.push(`**${count('pass')} passed, ${count('FAIL')} failed, ${count('skipped')} skipped**`, '');
  out.push('| Result | File | Test | Time |', '|---|---|---|---|');
  for (const r of rows) out.push(`| ${r.result} | ${cell(r.file)} | ${cell(r.name)} | ${r.seconds.toFixed(1)}s |`);
  out.push('');
}

const ledger = read('requests.jsonl');
if (ledger !== null) {
  const files = ledger.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
  const total = { requests: 0, ok: 0, aborted: 0, google: {}, network: {} };
  for (const f of files) {
    total.requests += f.requests;
    total.ok += f.ok;
    total.aborted += f.aborted;
    for (const [k, v] of Object.entries(f.refusedByGoogle)) total.google[k] = (total.google[k] ?? 0) + v;
    for (const [k, v] of Object.entries(f.refusedByNetwork)) total.network[k] = (total.network[k] ?? 0) + v;
  }
  const list = (counts) => Object.entries(counts).map(([k, v]) => `${v} × ${k}`).join(', ') || 'none';
  out.push('### Requests sent with the real key', '');
  out.push(`- Sent: ${total.requests}, answered OK: ${total.ok}`);
  out.push(`- Refused by Google (HTTP status): ${list(total.google)}`);
  out.push(`- Refused by the network (no HTTP response): ${list(total.network)}`);
  if (total.aborted > 0) out.push(`- Ended by the caller's own cancel or timeout: ${total.aborted}`);
  out.push('');
}

const diagnostic = read('pipeline-diagnostic.txt');
if (diagnostic !== null) {
  out.push('### Pipeline diagnostic', '', '```', diagnostic.trim(), '```', '');
}

const findings = read('transcripts/findings.txt');
if (findings !== null) {
  out.push('### Transcript findings', '', '```', findings.trim(), '```', '');
}

process.stdout.write(`${out.join('\n')}\n`);
