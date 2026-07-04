// Headless playthrough driver for The Bench demo case.
// Usage (see SKILL.md): needs a running dev server and a playwright install
// reachable via $PLAYWRIGHT_PREFIX (default /tmp/bench-playwright).
//
// Drives BOTH demo branches end-to-end (accepted plea at 1280px, forced
// trial at 375px), asserts the UI against the hardcoded demo case, and
// screenshots every stage. Assertions pin demo-case data (Marcus Webb,
// 1–3 year range, 4 evidence items, ledger speaker order) — if the demo
// case changes, update them here.
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';

function loadPlaywright() {
  const prefixes = [
    process.env.PLAYWRIGHT_PREFIX ?? '/tmp/bench-playwright',
    // Fall back to normal resolution in case playwright is installed nearby.
    null,
  ];
  for (const prefix of prefixes) {
    try {
      const req = prefix
        ? createRequire(path.join(prefix, 'node_modules', 'resolve-base.js'))
        : createRequire(import.meta.url);
      return req('playwright');
    } catch { /* try next */ }
  }
  throw new Error('playwright not found — run the Prerequisites step in SKILL.md');
}

const { chromium } = loadPlaywright();
const BASE = process.env.BASE_URL ?? 'http://localhost:5173/the-bench/';
const SHOTS = process.env.SHOTS_DIR ?? '/tmp/bench-verify-shots';
fs.mkdirSync(SHOTS, { recursive: true });

const consoleErrors = [];
let failures = 0;

function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
}

async function newPage(browser, viewport) {
  const page = await browser.newPage({ viewport });
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => consoleErrors.push(`[pageerror] ${err.message}`));
  return page;
}

async function gotoWithRetry(page, url, attempts = 20) {
  for (let i = 0; i < attempts; i++) {
    try { await page.goto(url, { timeout: 3000 }); return; }
    catch { await new Promise((r) => setTimeout(r, 500)); }
  }
  throw new Error(`dev server not reachable at ${url} — is \`npm run dev\` running?`);
}

async function ledgerSpeakers(page) {
  return page.locator('li p.uppercase').allInnerTexts();
}

const browser = await chromium.launch();

// ---------- Run 1: accepted-plea path, desktop ----------
{
  const page = await newPage(browser, { width: 1280, height: 900 });
  await gotoWithRetry(page, BASE);
  await page.getByRole('button', { name: 'Play Demo Case' }).click();
  await page.waitForSelector('text=Case Called');

  const act1 = await ledgerSpeakers(page);
  check('Act1: ledger speakers clerk/people/defense',
    JSON.stringify(act1) === JSON.stringify(['CLERK OF THE COURT', 'THE PEOPLE', 'DEFENSE COUNSEL']),
    JSON.stringify(act1));
  check('Act1: accent button label wears --bg (cascade-layer regression guard)',
    await page.getByRole('button', { name: 'Accept Plea' })
      .evaluate((el) => getComputedStyle(el).color) === 'rgb(22, 23, 29)');
  await page.screenshot({ path: path.join(SHOTS, '01-act1-ledger.png'), fullPage: true });

  // Defendant dossier → OceanTraitsMeter
  await page.getByRole('button', { name: /Marcus Webb/ }).first().click();
  await page.waitForSelector('text=Personality (OCEAN)');
  check('Dossier: 5 meter bars render', await page.locator('[role="meter"]').count() === 5);
  check('Dossier: neuroticism meter aria-valuenow=9',
    await page.locator('[role="meter"][aria-label="Neuroticism"]').getAttribute('aria-valuenow') === '9');
  await page.screenshot({ path: path.join(SHOTS, '02-dossier-meter.png') });
  await page.keyboard.press('Escape');

  // Charge modal → per-charge sentencing range
  await page.getByRole('button', { name: /Grand Theft/ }).first().click();
  await page.waitForSelector('text=Sentencing Range');
  check('Charge modal: 1-year floor shown', await page.locator('text=1 year in prison').count() >= 1);
  check('Charge modal: 3-year ceiling shown', await page.locator('text=3 years in prison').count() >= 1);
  await page.screenshot({ path: path.join(SHOTS, '03-charge-modal.png') });
  await page.keyboard.press('Escape');

  // Accept plea → sentence → END
  await page.getByRole('button', { name: 'Accept Plea' }).click();
  await page.waitForSelector('text=Sentencing — Plea Accepted');
  const seeded = Number(await page.locator('input[type="number"]').inputValue());
  check('Plea sentencing: seeded within statutory range', seeded >= 1 && seeded <= 3, `value=${seeded}`);
  await page.getByRole('button', { name: 'Impose Sentence' }).click();
  await page.waitForSelector('text=Aftermath');
  const end = await ledgerSpeakers(page);
  check('End(plea): full speaker sequence ends COURT,COURT,PRESS',
    JSON.stringify(end.slice(-3)) === JSON.stringify(['THE COURT', 'THE COURT', 'PRESS']),
    JSON.stringify(end));
  await page.screenshot({ path: path.join(SHOTS, '04-endstate-plea.png'), fullPage: true });
  await page.close();
}

// ---------- Run 2: forced-trial path, mobile ----------
{
  const page = await newPage(browser, { width: 375, height: 812 });
  await gotoWithRetry(page, BASE);
  await page.getByRole('button', { name: 'Play Demo Case' }).click();
  await page.waitForSelector('text=Case Called');

  await page.getByRole('button', { name: 'Reject & Force Trial' }).click();
  await page.waitForSelector('text=Admit');
  const count = await page.locator('button:has-text("Admit")').count();
  check('Act2: 4 evidence rulings offered', count === 4, `got ${count}`);
  for (let i = 0; i < count; i++) {
    if (i === count - 1) await page.locator('button:has-text("Exclude")').nth(i).click();
    else await page.locator('button:has-text("Admit")').nth(i).click();
  }
  await page.getByRole('button', { name: 'Continue to Trial Verdict' }).click();
  await page.waitForSelector('text=Admitted-evidence weight');
  await page.screenshot({ path: path.join(SHOTS, '05-act3-trial-mobile.png') });

  await page.getByRole('button', { name: 'Guilty', exact: true }).click();
  await page.getByRole('button', { name: 'Enter Verdict & Impose Sentence' }).click();
  await page.waitForSelector('text=Aftermath');
  const speakers = await ledgerSpeakers(page);
  check('End(trial): decision + 4 rulings + verdict + sentence are THE COURT',
    speakers.filter((s) => s === 'THE COURT').length === 7, JSON.stringify(speakers));
  await page.screenshot({ path: path.join(SHOTS, '06-endstate-trial-mobile.png'), fullPage: true });
  await page.close();
}

await browser.close();

const realErrors = consoleErrors.filter((e) => !e.includes('Download the React DevTools'));
check('Console clean across both runs', realErrors.length === 0, realErrors.slice(0, 5).join(' | '));

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
console.log(`Screenshots: ${SHOTS}`);
process.exit(failures === 0 ? 0 : 1);
