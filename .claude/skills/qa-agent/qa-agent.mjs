// Live QA playtester for The Bench: drives a real BYOK-generated case
// (through GameService, hitting the real Gemini API) with Playwright, and at
// every beat asks a *second*, independent Gemini call — playing a
// meticulous, technically literate human QA tester — to judge the just-
// revealed content for realism/verbiage/UI issues and (at real decision
// points) to choose what a player would actually click. Built after a jury
// reference slipped into live-generated dialogue that no automated check
// caught (`npm test` is fully mocked; the other live suites check schema
// shape, not prose content). See SKILL.md before running this — it spends
// real API quota on every invocation and is never meant to run in CI.
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

// ---------- Playwright (throwaway prefix, same pattern as run-the-bench) ----------
function loadPlaywright() {
  const prefixes = [process.env.PLAYWRIGHT_PREFIX ?? '/tmp/bench-playwright', null];
  for (const prefix of prefixes) {
    try {
      const req = prefix
        ? createRequire(path.join(prefix, 'node_modules', 'resolve-base.js'))
        : createRequire(import.meta.url);
      return req('playwright');
    } catch { /* try next */ }
  }
  throw new Error('playwright not found — see run-the-bench/SKILL.md Prerequisites (same throwaway install works here)');
}
const { chromium } = loadPlaywright();

// ---------- .env (repo-root, gitignored — same file src/lib/llm/__tests__/live/liveEnv.ts reads) ----------
function loadApiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  let text;
  try {
    text = readFileSync(resolve(process.cwd(), '.env'), 'utf-8');
  } catch {
    return null;
  }
  for (const line of text.split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match && match[1] === 'GEMINI_API_KEY') return match[2];
  }
  return null;
}

const API_KEY = loadApiKey();
if (!API_KEY) {
  console.error('GEMINI_API_KEY not found — add it to a repo-root .env (see src/lib/llm/__tests__/live/liveEnv.ts) or export it.');
  process.exit(1);
}

// ---------- Minimal standalone Gemini client ----------
// Deliberately not importing src/lib/llm/geminiClient.ts — this is a plain
// .mjs script with no build step, so it can't import a .ts module. Mirrors
// geminiClient.ts's request shape (native fetch, JSON structured output,
// capped retry on 429/5xx) but adds multimodal parts for screenshots, which
// the app's own client has no need for.
const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 500;

function isRetryableStatus(status) {
  return status === 429 || status >= 500;
}
async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}
async function fetchWithRetry(url, init) {
  let lastError;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1));
    try {
      const response = await fetch(url, init);
      if (response.ok) return response;
      if (!isRetryableStatus(response.status) || attempt === MAX_ATTEMPTS - 1) {
        const body = await response.text().catch(() => '');
        throw new Error(`Gemini request failed with status ${response.status}: ${body}`);
      }
      lastError = new Error(`Gemini request failed with status ${response.status}`);
    } catch (err) {
      lastError = err;
      if (attempt === MAX_ATTEMPTS - 1) throw lastError;
    }
  }
  throw lastError;
}

async function listModels(apiKey) {
  const url = `${API_ROOT}/models?key=${encodeURIComponent(apiKey)}`;
  const response = await fetchWithRetry(url, { method: 'GET' });
  const data = await response.json();
  return data.models ?? [];
}

// Non-text/specialist families this tool never wants, matching
// modelSelection.ts's exclusion list.
const EXCLUDED_NAME_PATTERN =
  /pro|ultra|embedding|vision|aqa|imagen|veo|image|tts|robotics|lyria|computer-use|antigravity|deep-research|omni|nano-banana|customtools/i;
const FALLBACK_MODEL = 'gemini-flash-latest';

function stripModelsPrefix(name) {
  return name.startsWith('models/') ? name.slice('models/'.length) : name;
}
// Judgment quality matters more than cost for the QA role (unlike
// GameService's cost-optimized selection), so plain flash is preferred over
// flash-lite here — the tiers below are the reverse of modelSelection.ts's.
function tier(name) {
  if (/flash-lite/i.test(name)) return 1;
  if (/flash/i.test(name)) return 0;
  return 2;
}
function stability(name) {
  if (/-latest$/i.test(name)) return 0;
  if (/preview|-\d{2}-\d{4}$/i.test(name)) return 2;
  if (/-\d+$/.test(name)) return 2;
  return 1;
}
function compareRank(a, b) {
  return tier(a) - tier(b) || stability(a) - stability(b);
}

async function selectQaModel(apiKey) {
  try {
    const models = await listModels(apiKey);
    const candidates = models
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent') ?? false)
      .map((m) => stripModelsPrefix(m.name))
      .filter((name) => !EXCLUDED_NAME_PATTERN.test(name));
    if (candidates.length === 0) return FALLBACK_MODEL;
    candidates.sort(compareRank);
    return candidates[0] ?? FALLBACK_MODEL;
  } catch {
    return FALLBACK_MODEL;
  }
}

async function callGeminiJson(apiKey, model, { systemInstruction, parts, responseSchema }) {
  const url = `${API_ROOT}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts }],
      generationConfig: { responseMimeType: 'application/json', responseSchema },
    }),
  });
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (text === undefined) throw new Error('Gemini response contained no candidate text');
  return text;
}

// ---------- Findings & judgment schemas ----------
const FindingSchema = z.object({
  severity: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  category: z.enum(['REALISM', 'VERBIAGE', 'UI_UX']),
  quote: z.string(),
  note: z.string(),
});
const ReviewOnlySchema = z.object({ findings: z.array(FindingSchema) });
const ReviewAndDecideSchema = z.object({
  findings: z.array(FindingSchema),
  chosenIndex: z.number().int(),
  reasoning: z.string(),
});
const SentencingSchema = z.object({
  findings: z.array(FindingSchema),
  amounts: z.array(z.number().int()),
  reasoning: z.string(),
});

const FINDING_GEMINI_SCHEMA = {
  type: 'object',
  properties: {
    severity: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
    category: { type: 'string', enum: ['REALISM', 'VERBIAGE', 'UI_UX'] },
    quote: { type: 'string' },
    note: { type: 'string' },
  },
  required: ['severity', 'category', 'quote', 'note'],
};
const REVIEW_ONLY_GEMINI_SCHEMA = {
  type: 'object',
  properties: { findings: { type: 'array', items: FINDING_GEMINI_SCHEMA } },
  required: ['findings'],
};
const REVIEW_AND_DECIDE_GEMINI_SCHEMA = {
  type: 'object',
  properties: {
    findings: { type: 'array', items: FINDING_GEMINI_SCHEMA },
    chosenIndex: { type: 'integer' },
    reasoning: { type: 'string' },
  },
  required: ['findings', 'chosenIndex', 'reasoning'],
};
const SENTENCING_GEMINI_SCHEMA = {
  type: 'object',
  properties: {
    findings: { type: 'array', items: FINDING_GEMINI_SCHEMA },
    amounts: { type: 'array', items: { type: 'integer' } },
    reasoning: { type: 'string' },
  },
  required: ['findings', 'amounts', 'reasoning'],
};

const PERSONA = `You are a meticulous, technically literate human QA tester playing "The Bench" for the first time — a California courtroom simulation where the PLAYER is the judge.

Critical fact about this game: it is ALWAYS a bench trial. The judge (the player) alone rules on every objection and decides every verdict. There is NEVER a jury. Any dialogue that references a jury, jurors, or asks for a jury trial is a HIGH severity REALISM finding.

Also flag, when genuinely present:
- REALISM: anachronisms, internal contradictions (facts that don't match earlier details), courtroom procedure that wouldn't make sense in a bench trial, tonal breaks.
- VERBIAGE: awkward phrasing, redundant text, confusing button/label text, typos.
- UI_UX: anything wrong or confusing visible in the attached screenshot — layout glitches, unreadable or overlapping text, misalignment, unclear affordances.

Only report real issues — don't invent nitpicks about ordinary courtroom formality or stylistic flourish. Quote the exact offending text in "quote" (empty string if the finding is purely visual/UI). Keep "note" to one or two sentences on why it's a problem. If nothing is wrong, return an empty findings array — don't manufacture findings to have something to say.`;

async function judgeContent(model, { promptText, screenshot, mode }) {
  const schema =
    mode === 'decide' ? REVIEW_AND_DECIDE_GEMINI_SCHEMA
    : mode === 'sentencing' ? SENTENCING_GEMINI_SCHEMA
    : REVIEW_ONLY_GEMINI_SCHEMA;
  const zodSchema =
    mode === 'decide' ? ReviewAndDecideSchema
    : mode === 'sentencing' ? SentencingSchema
    : ReviewOnlySchema;

  const imagePart = { inlineData: { mimeType: 'image/png', data: screenshot.toString('base64') } };

  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = attempt === 0
      ? promptText
      : `${promptText}\n\nYour previous response failed validation: ${lastError}. Return corrected JSON only.`;
    const raw = await callGeminiJson(API_KEY, model, {
      systemInstruction: PERSONA,
      parts: [{ text }, imagePart],
      responseSchema: schema,
    });
    try {
      return zodSchema.parse(JSON.parse(raw));
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(`QA judgment call failed validation twice in a row: ${lastError}`);
}

// ---------- Prompt builders ----------
function reviewOnlyPrompt(delta) {
  return `Here is the newly revealed courtroom record since your last look (read it as a player would, in order):\n\n${delta}\n\nReview it per your instructions and return your findings.`;
}
function decidePrompt(delta, options) {
  const optionsText = options.map((o, i) => `${i}. [${o.choice ?? 'ACTION'}] "${o.text}"`).join('\n');
  return `Here is the newly revealed courtroom record since your last look:\n\n${delta}\n\nThe court must now rule. Available options (0-indexed):\n${optionsText}\n\nReview the record for findings, then choose the option a real judge in this position would choose. Return chosenIndex and brief reasoning (as the judge's own reasoning, not meta-commentary about testing).`;
}
function sentencingPrompt(delta, ranges) {
  const rangesText = ranges.map((r, i) => `${i}. ${r.label}: integer between ${r.min} and ${r.max}`).join('\n');
  return `Here is the newly revealed record leading into sentencing:\n\n${delta}\n\nImpose a sentence. Return one integer amount per line item, in this order:\n${rangesText}\n\nReview for findings, then return "amounts" (same order as above) and brief "reasoning" for the sentence as the judge would explain it to themself.`;
}

// ---------- Report ----------
function buildReport({ startedAt, model, caseTitle, findings, actionLog, transcript, outcome }) {
  const bySeverity = { HIGH: [], MEDIUM: [], LOW: [] };
  for (const f of findings) bySeverity[f.severity].push(f);

  const findingsTable = ['HIGH', 'MEDIUM', 'LOW']
    .flatMap((sev) => bySeverity[sev])
    .map((f) => `| ${f.severity} | ${f.category} | beat ${f.beat} | ${f.quote.replace(/\|/g, '\\|')} | ${f.note.replace(/\|/g, '\\|')} |`)
    .join('\n');

  const actionText = actionLog
    .map((a) => {
      if (a.type === 'ADVANCE') return `Beat ${a.beat}: advanced ("${a.clicked}").`;
      if (a.type === 'DECISION') return `Beat ${a.beat}: chose "${a.chosen}"${a.fallback ? ' (fallback — judgment call was invalid)' : ''} — ${a.reasoning}`;
      if (a.type === 'SENTENCING') return `Beat ${a.beat}: imposed [${a.amounts.map((v) => v ?? 'default').join(', ')}] — ${a.reasoning}`;
      return `Beat ${a.beat}: ${a.type}`;
    })
    .join('\n');

  return `# QA Agent Report

**Run started:** ${startedAt.toISOString()}
**QA judgment model:** ${model}
**Case:** ${caseTitle}
**Outcome:** ${outcome}

## Findings (${findings.length})

${findings.length === 0 ? '_None._' : `| Severity | Category | Beat | Quote | Note |\n|---|---|---|---|---|\n${findingsTable}`}

## Action log

${actionLog.length === 0 ? '_None._' : actionText}

## Full transcript

\`\`\`
${transcript}
\`\`\`
`;
}

// ---------- Driver ----------
const BASE = process.env.BASE_URL ?? 'http://localhost:5173/the-bench/';
const REPORT_DIR = process.env.QA_REPORT_DIR ?? '/tmp/bench-qa-report';
const SHOTS_DIR = process.env.QA_SHOTS_DIR ?? path.join(REPORT_DIR, 'screenshots');
const MAX_ITERATIONS = Number(process.env.QA_MAX_ITERATIONS ?? 150);
const STUCK_TIMEOUT_MS = Number(process.env.QA_STUCK_TIMEOUT_MS ?? 60_000);
fs.mkdirSync(SHOTS_DIR, { recursive: true });

async function gotoWithRetry(page, url, attempts = 20) {
  for (let i = 0; i < attempts; i++) {
    try { await page.goto(url, { timeout: 3000 }); return; }
    catch { await new Promise((r) => setTimeout(r, 500)); }
  }
  throw new Error(`dev server not reachable at ${url} — is \`npm run dev\` running?`);
}

// Waits for BYOK case generation (six-plus sequential Gemini calls, any of
// which can retry-with-feedback on a validation failure, plus
// finalizeCasePayload's own bounded repair round) to either land in the
// courtroom or fail into ErrorScreen ("Mistrial"). A first live smoke test
// timed out at 180s on a run that hit retries — generation alone can
// legitimately take several minutes in the worst case, so this defaults much
// longer than that single observed failure.
async function waitForGenerationToSettle(page, timeoutMs = Number(process.env.QA_GENERATION_TIMEOUT_MS ?? 480_000)) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if ((await page.locator('[data-action-bar] button').count()) > 0) return 'READY';
    if ((await page.locator('text=Mistrial').count()) > 0) return 'ERROR';
    await page.waitForTimeout(1000);
  }
  return 'TIMEOUT';
}

(async () => {
  const model = await selectQaModel(API_KEY);
  console.log(`QA judgment model: ${model}`);

  const browser = await chromium.launch(
    process.env.PW_EXECUTABLE_PATH ? { executablePath: process.env.PW_EXECUTABLE_PATH } : {},
  );
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  // WelcomeScreen/SentencingControl swallow generation/aftermath failures
  // into a bare setPhase('ERROR_STATE') with no console.error, so this can't
  // recover the underlying GeminiError — but it's cheap insurance against
  // anything else (a render crash, a rejected promise Chromium logs on its
  // own) that would otherwise vanish silently.
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => consoleErrors.push(`[pageerror] ${err.message}`));

  const findings = [];
  const actionLog = [];
  let lastRowCount = 0;
  let outcome = 'IN_PROGRESS';
  const startedAt = new Date();

  function recordFindings(list, beat) {
    for (const f of list) findings.push({ ...f, beat });
  }

  try {
    await gotoWithRetry(page, BASE);
    await page.locator('input[type="password"]').fill(API_KEY);
    await page.getByRole('button', { name: 'Submit Key' }).click();
    await page.waitForSelector('text=Key accepted.', { timeout: 10_000 });
    await page.getByRole('button', { name: 'Continue', exact: true }).click();

    const genResult = await waitForGenerationToSettle(page);
    if (genResult !== 'READY') {
      const consoleNote = consoleErrors.length > 0 ? ` — console: ${consoleErrors.join(' | ')}` : ' — no console errors captured (the app swallows generation failures without logging)';
      outcome = (genResult === 'ERROR' ? 'FAIL: case generation reached ERROR_STATE (Mistrial)' : 'FAIL: case generation timed out') + consoleNote;
      await page.screenshot({ path: path.join(SHOTS_DIR, 'generation-failure.png'), fullPage: true });
    } else {
      let beat = 0;
      let stuckSinceMs = null;
      while (beat < MAX_ITERATIONS) {
        beat++;

        if ((await page.getByRole('button', { name: 'New Case' }).count()) > 0) {
          const rows = await page.locator('main li[data-entry-kind]').allInnerTexts();
          const delta = rows.slice(lastRowCount).join('\n\n');
          const screenshot = await page.screenshot({ type: 'png' });
          const result = await judgeContent(model, { promptText: reviewOnlyPrompt(delta), screenshot, mode: 'review' });
          recordFindings(result.findings, beat);
          outcome = 'PASS: case completed';
          break;
        }

        const actionBar = page.locator('[data-action-bar]');
        const choiceButtons = actionBar.locator('button[data-choice]');
        const choiceCount = await choiceButtons.count();
        const sentenceInputs = actionBar.locator('input[type="number"]');
        const sentenceCount = await sentenceInputs.count();
        const plainButtons = actionBar.locator('button:not([data-choice])');
        const plainCount = await plainButtons.count();

        if (choiceCount === 0 && sentenceCount === 0 && plainCount === 0) {
          // ActionBar legitimately renders nothing for a stretch after
          // Impose Sentence: handleSubmit's setPhase('END_STATE') only fires
          // once generateAftermath() (a real, possibly slow Gemini call)
          // resolves. A short poll-count cutoff mistook that wait for a
          // stuck game on a live run — this is time-based instead, generous
          // enough to outlast a slow aftermath call.
          if (stuckSinceMs === null) stuckSinceMs = Date.now();
          if (Date.now() - stuckSinceMs > STUCK_TIMEOUT_MS) {
            const phaseLabel = await page.locator('header p').last().innerText().catch(() => 'unknown');
            outcome = `FAIL: stuck at beat ${beat} (phase: ${phaseLabel}) — no actionable control found in the action bar after ${STUCK_TIMEOUT_MS / 1000}s`;
            await page.screenshot({ path: path.join(SHOTS_DIR, 'stuck.png'), fullPage: true });
            break;
          }
          await page.waitForTimeout(250);
          beat--; // this poll didn't consume a real beat
          continue;
        }
        stuckSinceMs = null;

        // Ledger rows (li[data-entry-kind], one per LedgerEntryRow) diffed by
        // count, not a raw innerText().slice(lastLength) — a flat-string
        // slice is fragile to innerText()'s whitespace/newline normalization
        // shifting slightly once more content is appended, which was
        // clipping the first few characters of the newly-revealed text on a
        // live run (Gemini then dutifully — and wrongly — flagged those as
        // "truncated text" VERBIAGE findings).
        const rows = await page.locator('main li[data-entry-kind]').allInnerTexts();
        const delta = rows.slice(lastRowCount).join('\n\n');
        const screenshot = await page.screenshot({ type: 'png' });
        await page.screenshot({ path: path.join(SHOTS_DIR, `beat-${String(beat).padStart(3, '0')}.png`) });

        if (choiceCount >= 2) {
          const options = [];
          for (let i = 0; i < choiceCount; i++) {
            options.push({
              choice: await choiceButtons.nth(i).getAttribute('data-choice'),
              text: (await choiceButtons.nth(i).innerText()).trim(),
            });
          }
          const result = await judgeContent(model, { promptText: decidePrompt(delta, options), screenshot, mode: 'decide' });
          recordFindings(result.findings, beat);
          let idx = result.chosenIndex;
          let fallback = false;
          if (!Number.isInteger(idx) || idx < 0 || idx >= choiceCount) { idx = 0; fallback = true; }
          actionLog.push({ beat, type: 'DECISION', chosen: options[idx].text, reasoning: result.reasoning, fallback });
          await choiceButtons.nth(idx).click();
        } else if (sentenceCount >= 1) {
          const ranges = [];
          for (let i = 0; i < sentenceCount; i++) {
            const el = sentenceInputs.nth(i);
            const id = await el.getAttribute('id');
            const label = id
              ? await actionBar.locator(`label[for="${id}"]`).innerText().catch(() => `sentence line ${i}`)
              : `sentence line ${i}`;
            ranges.push({
              min: Number(await el.getAttribute('min')),
              max: Number(await el.getAttribute('max')),
              label,
            });
          }
          const result = await judgeContent(model, { promptText: sentencingPrompt(delta, ranges), screenshot, mode: 'sentencing' });
          recordFindings(result.findings, beat);
          const amounts = ranges.map((r, i) => {
            const amt = result.amounts[i];
            return Number.isInteger(amt) && amt >= r.min && amt <= r.max ? amt : r.min;
          });
          // SentencePicker scrolls (`max-h-72 overflow-y-auto`) — a line item
          // past the fold isn't Playwright-"stable"/visible until scrolled
          // to, so scrollIntoViewIfNeeded first. If a fill still fails for
          // any reason, fall back to leaving that item at its seeded default
          // rather than aborting the whole run — same fallback spirit as an
          // invalid Gemini-returned amount.
          const filled = [];
          for (let i = 0; i < sentenceCount; i++) {
            const input = sentenceInputs.nth(i);
            try {
              await input.scrollIntoViewIfNeeded();
              await input.fill(String(amounts[i]), { timeout: 10_000 });
              filled.push(amounts[i]);
            } catch {
              filled.push(null); // left at whatever was already seeded
            }
          }
          actionLog.push({ beat, type: 'SENTENCING', amounts: filled, reasoning: result.reasoning });
          await actionBar.getByRole('button', { name: /Impose Sentence|Adjourn/ }).click();
        } else {
          const texts = [];
          for (let i = 0; i < plainCount; i++) texts.push((await plainButtons.nth(i).innerText()).trim());
          const candidateIdx = texts.findIndex((t) => t !== 'Skip to Next Decision');
          const clickIdx = candidateIdx === -1 ? 0 : candidateIdx;
          const result = await judgeContent(model, { promptText: reviewOnlyPrompt(delta), screenshot, mode: 'review' });
          recordFindings(result.findings, beat);
          actionLog.push({ beat, type: 'ADVANCE', clicked: texts[clickIdx] });
          await plainButtons.nth(clickIdx).click();
        }

        lastRowCount = rows.length;
      }
      if (outcome === 'IN_PROGRESS') {
        outcome = `FAIL: exceeded ${MAX_ITERATIONS} beats without reaching case closure`;
      }
    }
  } catch (err) {
    outcome = `FAIL: unhandled error — ${err instanceof Error ? err.message : String(err)}`;
    await page.screenshot({ path: path.join(SHOTS_DIR, 'unhandled-error.png'), fullPage: true }).catch(() => {});
  }

  if (outcome.startsWith('PASS') && consoleErrors.length > 0) {
    outcome += ` (console warnings/errors during the run: ${consoleErrors.join(' | ')})`;
  }

  const caseTitle = await page.locator('header p').first().innerText().catch(() => 'unknown');
  const transcript = await page.locator('main').innerText().catch(() => '(transcript unavailable)');
  await browser.close();

  for (const f of findings) {
    console.log(`${f.severity}  [${f.category}] beat ${f.beat} — ${f.note}${f.quote ? ` ("${f.quote}")` : ''}`);
  }
  console.log(`\n${outcome}`);

  const reportPath = path.join(REPORT_DIR, `report-${startedAt.toISOString().replace(/[:.]/g, '-')}.md`);
  fs.writeFileSync(reportPath, buildReport({ startedAt, model, caseTitle, findings, actionLog, transcript, outcome }));
  console.log(`Report: ${reportPath}`);
  console.log(`Screenshots: ${SHOTS_DIR}`);

  const hardFail = outcome.startsWith('FAIL') || findings.some((f) => f.severity === 'HIGH');
  process.exit(hardFail ? 1 : 0);
})();
