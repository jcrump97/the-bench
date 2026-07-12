// Headless playthrough driver for The Bench demo docket.
// Usage (see SKILL.md): needs a running dev server and a playwright install
// reachable via $PLAYWRIGHT_PREFIX (default /tmp/bench-playwright).
//
// Drives all four docket cases end-to-end across five runs:
//   1. Webb, accepted plea, desktop  — modals, ledger, plea-accepted ending
//   2. Webb, forced trial, mobile    — motions, guilty verdict, convicted ending
//   3. Boone (WEAK/no offer)         — trial-only path, acquittal ending
//   4. Reyes (STRONG/offer rejected) — rejected-offer terms, convicted ending
//   5. Vaughn (multi-charge)         — per-charge verdicts, split-verdict ending
// Assertions pin demo-case data (names, ranges, evidence counts, ledger
// speaker order, aftermath variant phrases) — if a case in
// src/lib/demoCases/ changes, update them here.
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

// Enter a case from the Welcome docket by its "People v. …" title.
async function openDocketCase(page, titlePattern) {
  await page.getByRole('button', { name: titlePattern }).click();
  await page.waitForSelector('text=Case Called');
}

// Rule on every evidence item in Act 2, then continue to the verdict form.
// excludeLast=true excludes the final item, otherwise everything is admitted.
async function ruleAllMotions(page, expectedCount, label, { excludeLast = false } = {}) {
  await page.waitForSelector('text=Admit');
  const count = await page.locator('button:has-text("Admit")').count();
  check(`${label}: ${expectedCount} evidence rulings offered`, count === expectedCount, `got ${count}`);
  for (let i = 0; i < count; i++) {
    if (excludeLast && i === count - 1) await page.locator('button:has-text("Exclude")').nth(i).click();
    else await page.locator('button:has-text("Admit")').nth(i).click();
  }
  await page.getByRole('button', { name: 'Continue to Trial Verdict' }).click();
  await page.waitForSelector('text=Admitted-evidence weight');
}

const browser = await chromium.launch();

// ---------- Run 1: Webb, accepted-plea path, desktop ----------
{
  const page = await newPage(browser, { width: 1280, height: 900 });
  await gotoWithRetry(page, BASE);
  const docketEntries = await page.locator('button:has-text("People v.")').count();
  check('Welcome: 4 docket entries listed', docketEntries === 4, `got ${docketEntries}`);
  await page.screenshot({ path: path.join(SHOTS, '00-welcome-docket.png'), fullPage: true });
  await openDocketCase(page, /People v\. Marcus Webb/);

  const act1 = await ledgerSpeakers(page);
  check('Webb Act1: ledger speakers clerk/people/defense',
    JSON.stringify(act1) === JSON.stringify(['CLERK OF THE COURT', 'THE PEOPLE', 'DEFENSE COUNSEL']),
    JSON.stringify(act1));
  check('Webb Act1: accent button label wears --bg (cascade-layer regression guard)',
    await page.getByRole('button', { name: 'Accept Plea' })
      .evaluate((el) => getComputedStyle(el).color) === 'rgb(22, 23, 29)');
  await page.screenshot({ path: path.join(SHOTS, '01-act1-ledger.png'), fullPage: true });

  // Defendant dossier → OceanTraitsMeter
  await page.getByRole('button', { name: /Marcus Webb/ }).first().click();
  await page.waitForSelector('text=Personality (OCEAN)');
  check('Webb dossier: 5 meter bars render', await page.locator('[role="meter"]').count() === 5);
  check('Webb dossier: neuroticism meter aria-valuenow=9',
    await page.locator('[role="meter"][aria-label="Neuroticism"]').getAttribute('aria-valuenow') === '9');
  await page.screenshot({ path: path.join(SHOTS, '02-dossier-meter.png') });
  await page.keyboard.press('Escape');

  // Charge modal → per-charge sentencing range
  await page.getByRole('button', { name: /Grand Theft/ }).first().click();
  await page.waitForSelector('text=Sentencing Range');
  check('Webb charge modal: 1-year floor shown', await page.locator('text=1 year in prison').count() >= 1);
  check('Webb charge modal: 3-year ceiling shown', await page.locator('text=3 years in prison').count() >= 1);
  await page.screenshot({ path: path.join(SHOTS, '03-charge-modal.png') });
  await page.keyboard.press('Escape');

  // Accept plea → sentence → END
  await page.getByRole('button', { name: 'Accept Plea' }).click();
  await page.waitForSelector('text=Sentencing — Plea Accepted');
  const seeded = Number(await page.locator('input[type="number"]').inputValue());
  check('Webb plea sentencing: seeded within statutory range', seeded >= 1 && seeded <= 3, `value=${seeded}`);
  await page.getByRole('button', { name: 'Impose Sentence' }).click();
  await page.waitForSelector('text=Aftermath');
  const end = await ledgerSpeakers(page);
  check('Webb end(plea): full speaker sequence ends COURT,COURT,PRESS',
    JSON.stringify(end.slice(-3)) === JSON.stringify(['THE COURT', 'THE COURT', 'PRESS']),
    JSON.stringify(end));
  check('Webb end(plea): plea-accepted aftermath variant shown',
    await page.locator('text=never had to board a plane').count() === 1);
  await page.screenshot({ path: path.join(SHOTS, '04-endstate-plea.png'), fullPage: true });
  await page.close();
}

// ---------- Run 2: Webb, forced-trial path, mobile ----------
{
  const page = await newPage(browser, { width: 375, height: 812 });
  await gotoWithRetry(page, BASE);
  await openDocketCase(page, /People v\. Marcus Webb/);

  await page.getByRole('button', { name: 'Reject & Force Trial' }).click();
  await ruleAllMotions(page, 4, 'Webb Act2', { excludeLast: true });
  await page.screenshot({ path: path.join(SHOTS, '05-act3-trial-mobile.png') });

  await page.getByRole('button', { name: 'Guilty', exact: true }).click();
  await page.getByRole('button', { name: 'Enter Verdict & Impose Sentence' }).click();
  await page.waitForSelector('text=Aftermath');
  const speakers = await ledgerSpeakers(page);
  check('Webb end(trial): decision + 4 rulings + verdict + sentence are THE COURT',
    speakers.filter((s) => s === 'THE COURT').length === 7, JSON.stringify(speakers));
  check('Webb end(trial): convicted aftermath variant shown',
    await page.locator('text=came back in under a day').count() === 1);
  await page.screenshot({ path: path.join(SHOTS, '06-endstate-trial-mobile.png'), fullPage: true });
  await page.close();
}

// ---------- Run 3: Boone (WEAK → no offer), acquittal, desktop ----------
{
  const page = await newPage(browser, { width: 1280, height: 900 });
  await gotoWithRetry(page, BASE);
  await openDocketCase(page, /People v\. Curtis Boone/);

  check('Boone Act1: NO_OFFER state shown',
    await page.locator('text=No Plea Offer Made').count() === 1);
  check('Boone Act1: no Accept Plea action exists',
    await page.getByRole('button', { name: 'Accept Plea' }).count() === 0);
  await page.screenshot({ path: path.join(SHOTS, '07-boone-no-offer.png'), fullPage: true });

  await page.getByRole('button', { name: 'Proceed to Trial' }).click();
  await ruleAllMotions(page, 4, 'Boone Act2');

  await page.getByRole('button', { name: 'Not Guilty', exact: true }).click();
  await page.getByRole('button', { name: 'Enter Verdict', exact: true }).click();
  await page.waitForSelector('text=Aftermath');
  check('Boone end: acquittal aftermath variant shown',
    await page.locator('text=the quiet scandal').count() === 1);
  await page.screenshot({ path: path.join(SHOTS, '08-boone-acquittal.png'), fullPage: true });
  await page.close();
}

// ---------- Run 4: Reyes (STRONG → offer rejected), conviction, desktop ----------
{
  const page = await newPage(browser, { width: 1280, height: 900 });
  await gotoWithRetry(page, BASE);
  await openDocketCase(page, /People v\. Dominic Reyes/);

  check('Reyes Act1: rejected-offer state shown',
    await page.locator('text=Offer Rejected by Defense').count() === 1);
  // Both the ledger entry and the action-bar OfferTerms render the terms.
  check('Reyes Act1: rejected offer terms still displayed',
    await page.locator('text=Pleads to:').count() >= 1);
  await page.screenshot({ path: path.join(SHOTS, '09-reyes-rejected-offer.png'), fullPage: true });

  await page.getByRole('button', { name: 'Proceed to Trial' }).click();
  await ruleAllMotions(page, 4, 'Reyes Act2');

  await page.getByRole('button', { name: 'Guilty', exact: true }).click();
  await page.getByRole('button', { name: 'Enter Verdict & Impose Sentence' }).click();
  await page.waitForSelector('text=Aftermath');
  check('Reyes end: convicted aftermath variant shown',
    await page.locator('text=photo off the wall').count() === 1);
  await page.screenshot({ path: path.join(SHOTS, '10-reyes-conviction.png'), fullPage: true });
  await page.close();
}

// ---------- Run 5: Vaughn (multi-charge), split verdict, desktop ----------
{
  const page = await newPage(browser, { width: 1280, height: 900 });
  await gotoWithRetry(page, BASE);
  await openDocketCase(page, /People v\. Teresa Vaughn/);

  await page.getByRole('button', { name: 'Reject & Force Trial' }).click();
  await ruleAllMotions(page, 5, 'Vaughn Act2');

  const guiltyButtons = page.getByRole('button', { name: 'Guilty', exact: true });
  check('Vaughn Act3: per-charge verdict controls for both counts',
    await guiltyButtons.count() === 2, `got ${await guiltyButtons.count()}`);
  await guiltyButtons.nth(0).click();
  await page.getByRole('button', { name: 'Not Guilty', exact: true }).nth(1).click();
  await page.screenshot({ path: path.join(SHOTS, '11-vaughn-split-verdict-form.png'), fullPage: true });
  await page.getByRole('button', { name: 'Enter Verdict & Impose Sentence' }).click();
  await page.waitForSelector('text=Aftermath');
  check('Vaughn end: split-verdict aftermath variant shown',
    await page.locator('text=down the center line').count() === 1);
  await page.screenshot({ path: path.join(SHOTS, '12-vaughn-split-endstate.png'), fullPage: true });
  await page.close();
}

await browser.close();

const realErrors = consoleErrors.filter((e) => !e.includes('Download the React DevTools'));
check('Console clean across all runs', realErrors.length === 0, realErrors.slice(0, 5).join(' | '));

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
console.log(`Screenshots: ${SHOTS}`);
process.exit(failures === 0 ? 0 : 1);
