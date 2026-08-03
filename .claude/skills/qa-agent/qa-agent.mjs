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

// A grader's severity ratings need to be comparable between runs — the API's
// default temperature of 1.0 makes the same beat flip between "no findings"
// and "HIGH severity" on a re-run for no reason tied to the content itself.
const QA_TEMPERATURE = Number(process.env.QA_TEMPERATURE ?? 0.2);
// An unbounded findings array can run long enough to truncate the JSON
// mid-object, which fails validation for a reason that has nothing to do
// with the judgment itself. Bound it generously instead.
const QA_MAX_OUTPUT_TOKENS = Number(process.env.QA_MAX_OUTPUT_TOKENS ?? 2048);

// Gemini's "thinking" knob is split by model family: 2.5-series models take a
// numeric thinkingBudget, Gemini 3 models take a thinkingLevel enum, and
// sending both fields in the same request returns HTTP 400. selectQaModel
// resolves the model name at runtime — nothing here is hardcoded — so which
// field (if either) applies has to be derived from that resolved name rather
// than assumed. This skill prefers the plain `flash` tier (see selectQaModel
// below), where thinking is otherwise on by default with an unbounded
// dynamic budget; capping it keeps judgment latency and cost predictable.
function resolveThinkingConfig(model) {
  if (/gemini-2\.5/.test(model)) return { thinkingConfig: { thinkingBudget: 512 } };
  if (/gemini-3/.test(model)) return { thinkingConfig: { thinkingLevel: 'low' } };
  return {};
}

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
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema,
        temperature: QA_TEMPERATURE,
        maxOutputTokens: QA_MAX_OUTPUT_TOKENS,
        ...resolveThinkingConfig(model),
      },
    }),
  });
  const data = await response.json();

  // A blocked prompt never reaches generation, so there are no candidates at
  // all — check it before looking for text that cannot exist. Mirrors the
  // app's own geminiClient.ts: without this, a SAFETY block reads as "no
  // candidate text", burns a retry, and degrades — never naming the real cause.
  const blockReason = data.promptFeedback?.blockReason;
  if (blockReason !== undefined) {
    throw new Error(`Gemini blocked the prompt (${blockReason})`);
  }

  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;

  // Order matters: a MAX_TOKENS candidate can carry partial text, and handing
  // that back as if it were complete is how a truncation gets misreported as
  // malformed JSON. Name the real cause instead — same fix as the app's client.
  if (candidate?.finishReason === 'MAX_TOKENS') {
    throw new Error(
      `Gemini stopped at the output token limit (${QA_MAX_OUTPUT_TOKENS}); the JSON is truncated, not malformed`,
    );
  }
  if (candidate?.finishReason === 'SAFETY' || candidate?.finishReason === 'PROHIBITED_CONTENT') {
    throw new Error(`Gemini stopped generating for ${candidate.finishReason}`);
  }
  if (text === undefined) {
    const detail = candidate?.finishReason === undefined ? '' : ` (finishReason: ${candidate.finishReason})`;
    throw new Error(`Gemini response contained no candidate text${detail}`);
  }
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

Critical fact about this game: it is ALWAYS a bench trial. The judge (the player) alone rules on every objection and decides every verdict. Every party addresses the court directly — "Your Honor", "the Court". Dialogue that hands the decision to a jury, that addresses jurors, or that asks for a jury trial is a HIGH severity REALISM finding.

Each turn you are given THE RECORD SO FAR — everything you have already read — followed by the newly revealed lines. Check the new lines against the established record: names, ages, dates, locations, amounts, exhibit and witness names, and who said what. A fact in the new lines that contradicts the earlier record is the single most valuable finding you can report.

Report findings in these categories:
- REALISM: contradictions with the earlier record, anachronisms, courtroom procedure that would not happen in a bench trial, tonal breaks.
- VERBIAGE: awkward phrasing, redundant text, confusing button or label text, typos.
- UI_UX: problems visible in the attached screenshot — layout glitches, unreadable or overlapping text, misalignment, unclear affordances.

Report a finding when you can quote the specific offending text in "quote", or — for a purely visual issue — name the specific element in "note" and leave "quote" an empty string. Keep "note" to one or two sentences on why it is a problem. Ordinary courtroom formality and stylistic flourish are correct for this game and belong in no finding. An empty findings array is the expected, correct answer for a beat that reads well.`;

// How much of the already-read record to carry into each judgment call.
const MEMORY_CHARS = Number(process.env.QA_MEMORY_CHARS ?? 12_000);

// The tester used to see only the delta since its last look, with no memory of
// any earlier beat — while PERSONA asked it to flag "facts that don't match
// earlier details". That finding class was structurally impossible to produce:
// there was nothing to compare against. This rebuilds the context on every
// call: the record already read, plus the rulings this tester has already made.
//
// Past the budget, keep the head and the tail rather than truncating. Act 1
// carries the durable facts a contradiction is measured against (the case
// call, the charges, the People's statement of facts, the discovery
// disclosures); the tail carries what just happened.
function buildCaseMemory(priorRows, actionLog) {
  if (priorRows.length === 0) {
    return 'THE RECORD SO FAR: nothing yet — this is the opening of the case.';
  }

  let record = priorRows.join('\n\n');
  if (record.length > MEMORY_CHARS) {
    const head = Math.floor(MEMORY_CHARS * 0.6);
    const tail = MEMORY_CHARS - head;
    record = `${record.slice(0, head)}\n\n[... middle of the record omitted for length ...]\n\n${record.slice(-tail)}`;
  }

  const rulings = actionLog
    .filter((a) => a.type === 'DECISION' || a.type === 'SENTENCING')
    .map((a) =>
      a.type === 'DECISION'
        ? `- Beat ${a.beat}: you ruled "${a.chosen}".`
        : `- Beat ${a.beat}: you imposed [${a.amounts.map((v) => v ?? 'default').join(', ')}].`,
    )
    .join('\n');

  return [
    'THE RECORD SO FAR (already reviewed — check the new lines against these facts):',
    record,
    rulings.length > 0 ? `RULINGS YOU HAVE ALREADY MADE:\n${rulings}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

async function judgeContent(model, { memory, promptText, screenshot, mode }) {
  const schema =
    mode === 'decide' ? REVIEW_AND_DECIDE_GEMINI_SCHEMA
    : mode === 'sentencing' ? SENTENCING_GEMINI_SCHEMA
    : REVIEW_ONLY_GEMINI_SCHEMA;
  const zodSchema =
    mode === 'decide' ? ReviewAndDecideSchema
    : mode === 'sentencing' ? SentencingSchema
    : ReviewOnlySchema;

  // Screenshots are throttled upstream (see QA_SHOT_EVERY) — most beats now
  // call this with no image at all, so the image part is only included when
  // one was actually captured for this beat.
  const imagePart = screenshot
    ? { inlineData: { mimeType: 'image/png', data: screenshot.toString('base64') } }
    : null;

  const composed = `${memory}\n\n---\n\n${promptText}`;

  let lastError = null;
  let lastRaw = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    // Include the actual response that failed, not just the Zod error — the
    // error message alone ("expected number, received string") gives the
    // model nothing to anchor the fix to; the raw text lets it see exactly
    // which field it got wrong.
    const text = attempt === 0
      ? composed
      : `${composed}\n\nYour previous response failed validation: ${lastError}\n\nYour previous response was:\n${lastRaw}\n\nReturn corrected JSON only.`;
    const parts = imagePart ? [{ text }, imagePart] : [{ text }];
    const raw = await callGeminiJson(API_KEY, model, {
      systemInstruction: PERSONA,
      parts,
      responseSchema: schema,
    });
    lastRaw = raw;
    try {
      return zodSchema.parse(JSON.parse(raw));
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  // A live run's whole point is surviving a 10-20 minute playthrough — one
  // beat's judgment call failing validation twice shouldn't discard the rest
  // of it. Degrade to a neutral, mode-appropriate result and let the run
  // continue; the downstream fallback logic (out-of-range chosenIndex ->
  // first option, missing amounts -> each line's floor) already exists to
  // absorb exactly this shape of result, so this leans on it rather than
  // duplicating it. Mark the returned result as degraded so the report does
  // not present a defaulted beat as a clean one.
  console.warn(`QA judgment call failed validation twice in a row (mode=${mode}): ${lastError}. Defaulting to a neutral result so the run continues.`);
  if (mode === 'decide') {
    return { findings: [], chosenIndex: 0, reasoning: 'QA judgment call failed validation twice; defaulted to the first option.', degraded: true };
  }
  if (mode === 'sentencing') {
    return { findings: [], amounts: [], reasoning: 'QA judgment call failed validation twice; defaulted to the statutory floor.', degraded: true };
  }
  return { findings: [], degraded: true };
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
      if (a.type === 'ADVANCE') return `Beat ${a.beat}: advanced ("${a.clicked}")${a.degraded ? ' (degraded — judgment call failed validation twice)' : ''}.`;
      if (a.type === 'DECISION') return `Beat ${a.beat}: chose "${a.chosen}"${a.fallback ? ' (fallback — judgment call was invalid)' : ''}${a.degraded ? ' (degraded — judgment call failed validation twice)' : ''} — ${a.reasoning}`;
      if (a.type === 'SENTENCING') return `Beat ${a.beat}: imposed [${a.amounts.map((v) => v ?? 'default').join(', ')}]${a.degraded ? ' (degraded — judgment call failed validation twice)' : ''} — ${a.reasoning}`;
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
// Screenshots dominate per-beat token cost, and most plain statement-advance
// beats look pixel-identical to the one before — nothing in the layout
// changed, so there's nothing new for the model to see. Decision/sentencing
// beats and the first judged beat of the run always get one regardless of
// this cadence; this only throttles the plain-advance beats in between. Every
// beat still gets a screenshot written to disk — this only limits what the
// *model* sees.
const QA_SHOT_EVERY = Number(process.env.QA_SHOT_EVERY ?? 5);
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
//
// On failure, scrapes the ErrorScreen's technical-details <details> rather
// than relying on console capture alone. The app stores the full
// `[StageName] ...` error in lastGenerationError and renders it in the DOM
// (src/components/screens/ErrorScreen.tsx), so reading it straight from the
// page is more reliable than timing-dependent console-event capture — and is
// exactly the stage-level diagnostic that tells you which of the seven
// response schemas actually failed.
async function waitForGenerationToSettle(page, timeoutMs = Number(process.env.QA_GENERATION_TIMEOUT_MS ?? 480_000)) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if ((await page.locator('[data-action-bar] button').count()) > 0) return { status: 'READY', technicalDetails: '' };
    if ((await page.locator('text=Mistrial').count()) > 0) {
      // The ErrorScreen renders the stage and message in a collapsed <details>.
      // Best-effort — if the selector misses, the console-errors fallback below
      // still carries something.
      let technicalDetails = '';
      try {
        const detailsText = await page.locator('details').innerText();
        if (detailsText) technicalDetails = detailsText.trim();
      } catch { /* details not present or not rendered */ }
      return { status: 'ERROR', technicalDetails };
    }
    await page.waitForTimeout(1000);
  }
  return { status: 'TIMEOUT', technicalDetails: '' };
}

(async () => {
  const model = await selectQaModel(API_KEY);
  console.log(`QA judgment model: ${model}`);

  const proxyServer = process.env.HTTPS_PROXY || process.env.https_proxy;
  const browser = await chromium.launch({
    ...(process.env.PW_EXECUTABLE_PATH ? { executablePath: process.env.PW_EXECUTABLE_PATH } : {}),
    // Chromium doesn't read HTTPS_PROXY from its environment the way Node's
    // fetch does — it needs the proxy passed as an explicit launch option,
    // or in-page requests (BYOK's Gemini calls) bypass the proxy entirely
    // and fail outright on a network that requires it.
    ...(proxyServer ? { proxy: { server: proxyServer } } : {}),
  });
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
  // Tracks whether any beat has been sent to the judgment model yet — the
  // very first judged beat always gets a screenshot (nothing to diff it
  // against, so err toward showing the model the starting state), regardless
  // of QA_SHOT_EVERY.
  let hasJudgedFirstBeat = false;

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
    if (genResult.status !== 'READY') {
      const techNote = genResult.technicalDetails
        ? ` — ErrorScreen technical details: ${genResult.technicalDetails}`
        : '';
      const consoleNote = consoleErrors.length > 0
        ? ` — console: ${consoleErrors.join(' | ')}`
        : ' — no console errors captured';
      outcome =
        (genResult.status === 'ERROR'
          ? 'FAIL: case generation reached ERROR_STATE (Mistrial)'
          : 'FAIL: case generation timed out') + techNote + consoleNote;
      await page.screenshot({ path: path.join(SHOTS_DIR, 'generation-failure.png'), fullPage: true });
    } else {
      let beat = 0;
      let stuckSinceMs = null;
      while (beat < MAX_ITERATIONS) {
        beat++;

        // A mid-game ERROR_STATE (Mistrial) can happen after the aftermath
        // call fails — the main loop only checked for "New Case" and
        // action-bar controls, so a Mistrial here (no action bar, no "New
        // Case" button) would run the stuck timer to exhaustion and report
        // a useless "no actionable control" FAIL instead of naming the
        // actual generation failure. The ErrorScreen renders the stage and
        // message in a <details>, so scrape it — same logic as
        // waitForGenerationToSettle's ERROR branch.
        if ((await page.locator('text=Mistrial').count()) > 0) {
          let technicalDetails = '';
          try {
            const detailsText = await page.locator('details').innerText();
            if (detailsText) technicalDetails = detailsText.trim();
          } catch { /* details not present */ }
          const consoleNote = consoleErrors.length > 0 ? ` — console: ${consoleErrors.join(' | ')}` : '';
          outcome = `FAIL: reached ERROR_STATE (Mistrial) at beat ${beat}${technicalDetails ? ` — ErrorScreen: ${technicalDetails}` : ''}${consoleNote}`;
          await page.screenshot({ path: path.join(SHOTS_DIR, 'midgame-mistrial.png'), fullPage: true });
          break;
        }

        if ((await page.getByRole('button', { name: 'New Case' }).count()) > 0) {
          const rows = await page.locator('main li[data-entry-kind]').allInnerTexts();
          const delta = rows.slice(lastRowCount).join('\n\n');
          // The final aftermath review always gets a screenshot — it's the
          // one review-mode call the shot-cadence throttle never applies to.
          const screenshot = await page.screenshot({ type: 'png' });
          const memory = buildCaseMemory(rows.slice(0, lastRowCount), actionLog);
          const result = await judgeContent(model, { memory, promptText: reviewOnlyPrompt(delta), screenshot, mode: 'review' });
          recordFindings(result.findings, beat);
          hasJudgedFirstBeat = true;
          if (result.degraded) {
            recordFindings([{ severity: 'LOW', category: 'VERBIAGE', quote: '', note: 'QA judgment call failed validation twice; the final review was defaulted, not judged.' }], beat);
          }
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
        // Captured once and reused for both purposes: the human-facing
        // screenshot record on disk gets every beat regardless of judgment
        // policy, and the same buffer is handed to the model only when the
        // attach policy below says so — this used to be two separate
        // page.screenshot() calls, doubling render cost for no reason.
        const screenshotBuffer = await page.screenshot({ type: 'png' });
        fs.writeFileSync(path.join(SHOTS_DIR, `beat-${String(beat).padStart(3, '0')}.png`), screenshotBuffer);
        const memory = buildCaseMemory(rows.slice(0, lastRowCount), actionLog);
        const isFirstJudgedBeat = !hasJudgedFirstBeat;

        if (choiceCount >= 2) {
          const options = [];
          for (let i = 0; i < choiceCount; i++) {
            options.push({
              choice: await choiceButtons.nth(i).getAttribute('data-choice'),
              text: (await choiceButtons.nth(i).innerText()).trim(),
            });
          }
          // Decision beats always get a screenshot — the whole point of the
          // shot-cadence throttle is to skip beats where the layout can't
          // have meaningfully changed, and a decision beat is exactly the
          // opposite of that (a fresh action bar, often new case-file panels).
          const result = await judgeContent(model, { memory, promptText: decidePrompt(delta, options), screenshot: screenshotBuffer, mode: 'decide' });
          recordFindings(result.findings, beat);
          hasJudgedFirstBeat = true;
          let idx = result.chosenIndex;
          let fallback = false;
          if (!Number.isInteger(idx) || idx < 0 || idx >= choiceCount) { idx = 0; fallback = true; }
          if (result.degraded) {
            recordFindings([{ severity: 'LOW', category: 'VERBIAGE', quote: '', note: 'QA judgment call failed validation twice; the beat was defaulted, not judged.' }], beat);
          }
          actionLog.push({ beat, type: 'DECISION', chosen: options[idx].text, reasoning: result.reasoning, fallback, degraded: result.degraded === true });
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
          // Sentencing is a decision beat too — always attach.
          const result = await judgeContent(model, { memory, promptText: sentencingPrompt(delta, ranges), screenshot: screenshotBuffer, mode: 'sentencing' });
          recordFindings(result.findings, beat);
          hasJudgedFirstBeat = true;
          if (result.degraded) {
            recordFindings([{ severity: 'LOW', category: 'VERBIAGE', quote: '', note: 'QA judgment call failed validation twice; the sentence was defaulted, not judged.' }], beat);
          }
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
          actionLog.push({ beat, type: 'SENTENCING', amounts: filled, reasoning: result.reasoning, degraded: result.degraded === true });
          // A live run found this button can render clipped by the viewport
          // (Gemini's own vision finding independently flagged the same
          // symptom) — scroll it into view first rather than trusting it's
          // already actionable, same treatment the sentence inputs get above.
          const submitButton = actionBar.getByRole('button', { name: /Impose Sentence|Adjourn/ });
          await submitButton.scrollIntoViewIfNeeded();
          await submitButton.click();
          // handleSubmit() kicks off a real generateAftermath() Gemini call
          // and only unmounts this form (setPhase to END_STATE or, on
          // failure, ERROR_STATE) once it resolves — the button stays in
          // the DOM (disabled) for however long that takes. Looping back
          // immediately re-detects this same, already-submitted sentencing
          // UI as a fresh actionable state (the number inputs are never
          // disabled), causing a redundant second fill+click that later
          // hangs waiting on a button that vanishes mid-wait once the first
          // call finally resolves. Wait for it to actually go before moving
          // on to the next beat.
          await submitButton
            .waitFor({ state: 'detached', timeout: Number(process.env.QA_GENERATION_TIMEOUT_MS ?? 480_000) })
            .catch(() => {});
        } else {
          const texts = [];
          for (let i = 0; i < plainCount; i++) texts.push((await plainButtons.nth(i).innerText()).trim());
          const candidateIdx = texts.findIndex((t) => t !== 'Skip to Next Decision');
          const clickIdx = candidateIdx === -1 ? 0 : candidateIdx;
          // A plain statement-advance beat's layout is identical to the last
          // one — no new panel, no new action bar shape — so most of these
          // are judged on text alone. Still send the image on the very first
          // judged beat (nothing to compare the starting state against) and
          // every QA_SHOT_EVERY'th beat thereafter, as a periodic visual
          // sanity check between the guaranteed looks at decision beats.
          const attachScreenshot = isFirstJudgedBeat || beat % QA_SHOT_EVERY === 0;
          const result = await judgeContent(model, {
            memory,
            promptText: reviewOnlyPrompt(delta),
            screenshot: attachScreenshot ? screenshotBuffer : null,
            mode: 'review',
          });
          recordFindings(result.findings, beat);
          hasJudgedFirstBeat = true;
          if (result.degraded) {
            recordFindings([{ severity: 'LOW', category: 'VERBIAGE', quote: '', note: 'QA judgment call failed validation twice; this review was defaulted, not judged.' }], beat);
          }
          actionLog.push({ beat, type: 'ADVANCE', clicked: texts[clickIdx], degraded: result.degraded === true });
          const clicked = plainButtons.nth(clickIdx);
          const isSubmit = /Impose Sentence|Adjourn/.test(texts[clickIdx]);
          await clicked.click();
          // On a full acquittal, SentencingControl's only control is this
          // plain "Adjourn" button — same handleSubmit()/generateAftermath()
          // path as the sentence-input branch above, and the same
          // stays-mounted-while-disabled problem: looping back immediately
          // re-detects the still-present (now-disabled) button as a fresh
          // actionable state and clicks it again. Wait for it to actually go.
          if (isSubmit) {
            await clicked
              .waitFor({ state: 'detached', timeout: Number(process.env.QA_GENERATION_TIMEOUT_MS ?? 480_000) })
              .catch(() => {});
          }
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
