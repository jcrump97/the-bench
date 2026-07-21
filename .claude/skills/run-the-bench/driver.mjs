// Headless playthrough driver for The Bench demo docket (beat-by-beat loop).
// Usage (see SKILL.md): needs a running dev server and a playwright install
// reachable via $PLAYWRIGHT_PREFIX (default /tmp/bench-playwright).
//
// The game is click-to-advance: statements reveal one beat at a time via
// Continue-style buttons, and the action bar pauses at each decision. The
// driver's workhorse is advanceTo(), which clicks through statement beats
// until a target control appears.
//
// Drives all four docket cases end-to-end across five runs:
//   1. Webb, accepted plea, desktop  — modals, beat reveal, allocution, plea ending
//   2. Webb, forced trial, mobile    — per-exhibit motions, testimony, convicted ending
//   3. Boone (WEAK/no offer)         — trial-only path, adjournment on acquittal
//   4. Reyes (STRONG/offer rejected) — skip-to-next-decision, convicted ending
//   5. Vaughn (multi-charge)         — per-charge verdict beats, split ending
// Assertions pin demo-case data (names, ranges, beat headings, speaker order,
// aftermath variant phrases) — if a case in src/lib/demoCases/ or the beat
// UI changes intentionally, update them here.
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

// Read the structural speaker of each revealed beat from its data-speaker
// attribute — the enum (CLERK/PROSECUTION/…/WITNESS/COURT/PRESS), not the
// visible name the transcript leads with. Witness rows show the witness's own
// name but stay data-speaker="WITNESS".
async function ledgerSpeakers(page) {
  return page.locator('li[data-speaker]').evaluateAll((els) => els.map((el) => el.dataset.speaker));
}

// The continue-flavored buttons a statement beat can present, in the order
// they should win when more than one is on screen.
const ADVANCE_BUTTONS = ['Call the Case', 'Proceed to Trial', 'Continue'];

// Decision controls now present voiced judge lines (authored prose), so the
// driver selects them by their structural choice, not their text.
const choiceButton = (page, choice) => page.locator(`button[data-choice="${choice}"]`).first();

// Click through statement beats until `target` (a locator) is visible.
// Fails the run (and returns false) if the script never presents it.
async function advanceTo(page, target, label, max = 80) {
  for (let i = 0; i < max; i++) {
    if ((await target.count()) > 0 && (await target.first().isVisible())) return true;
    let clicked = false;
    for (const name of ADVANCE_BUTTONS) {
      const btn = page.getByRole('button', { name, exact: true });
      if ((await btn.count()) > 0) {
        await btn.first().click();
        clicked = true;
        break;
      }
    }
    if (!clicked) await page.waitForTimeout(150);
  }
  check(`${label}: reachable by advancing beats`, false, 'advanceTo exhausted');
  return false;
}

// Enter a case from the Welcome docket by its "People v. …" title, then call
// the case (the first beat).
async function openDocketCase(page, titlePattern) {
  await page.getByRole('button', { name: titlePattern }).click();
  await page.getByRole('button', { name: 'Call the Case', exact: true }).click();
  await page.waitForSelector('text=Case Called');
}

// Act 2: each exhibit is offered and argued, then ruled on individually.
// excludeLast=true excludes the final exhibit, otherwise everything is admitted.
async function ruleAllMotions(page, expectedCount, label, { excludeLast = false } = {}) {
  for (let i = 0; i < expectedCount; i++) {
    const admit = choiceButton(page, 'ADMITTED');
    if (!(await advanceTo(page, admit, `${label} exhibit ${i + 1}`))) return;
    if (i === 0) {
      check(`${label}: exhibit counter shows 1 of ${expectedCount}`,
        (await page.locator(`text=Exhibit 1 of ${expectedCount}`).count()) === 1);
    }
    if (excludeLast && i === expectedCount - 1) {
      await choiceButton(page, 'EXCLUDED').click();
    } else {
      await admit.click();
    }
  }
}

// Act 3: verdicts are called one charge at a time.
async function callCharge(page, verdict, label) {
  const btn = choiceButton(page, verdict);
  if (await advanceTo(page, btn, label)) await btn.click();
}

// Sentencing (or adjournment), then advance through the sentence and
// aftermath beats to the case-closed actions.
async function finishCase(page, label, buttonName = 'Impose Sentence') {
  const btn = page.getByRole('button', { name: buttonName });
  if (await advanceTo(page, btn, `${label} ${buttonName}`)) await btn.click();
  await advanceTo(page, page.getByRole('button', { name: 'New Case' }), `${label} case closed`);
}

// PW_EXECUTABLE_PATH lets an environment with a pre-installed browser (a
// different build than this Playwright would download) point the driver at it
// instead. Unset, Playwright resolves its own bundled browser as usual.
const browser = await chromium.launch(
  process.env.PW_EXECUTABLE_PATH ? { executablePath: process.env.PW_EXECUTABLE_PATH } : {},
);

// ---------- Run 1: Webb, accepted-plea path, desktop ----------
{
  const page = await newPage(browser, { width: 1280, height: 900 });
  await gotoWithRetry(page, BASE);
  const docketEntries = await page.locator('button:has-text("People v.")').count();
  check('Welcome: 4 docket entries listed', docketEntries === 4, `got ${docketEntries}`);
  await page.screenshot({ path: path.join(SHOTS, '00-welcome-docket.png'), fullPage: true });

  await page.getByRole('button', { name: /People v\. Marcus Webb/ }).click();
  check('Webb: record starts empty, court seated',
    (await page.locator('text=The courtroom is seated').count()) === 1);
  check('Webb: accent button label wears --bg (cascade-layer regression guard)',
    await page.getByRole('button', { name: 'Call the Case' })
      .evaluate((el) => getComputedStyle(el).color) === 'rgb(22, 23, 29)');
  await page.getByRole('button', { name: 'Call the Case', exact: true }).click();
  await page.waitForSelector('text=Case Called');

  // Advance to the plea ruling and verify the Act 1 beats arrived in order.
  await advanceTo(page, choiceButton(page, 'ACCEPT'), 'Webb plea ruling');
  const act1 = await ledgerSpeakers(page);
  check('Webb Act1: beats are clerk, clerk (charge read), people, defense',
    JSON.stringify(act1) === JSON.stringify(['CLERK', 'CLERK', 'PROSECUTION', 'DEFENSE']),
    JSON.stringify(act1));
  check('Webb Act1: charge read as Count 1',
    (await page.locator('text=Count 1: Grand Theft').count()) === 1);
  await page.screenshot({ path: path.join(SHOTS, '01-act1-plea-ruling.png'), fullPage: true });

  // Defendant dossier → OceanTraitsMeter
  await page.getByRole('button', { name: /Marcus Webb/ }).first().click();
  await page.waitForSelector('text=Personality (OCEAN)');
  check('Webb dossier: 5 meter bars render', (await page.locator('[role="meter"]').count()) === 5);
  check('Webb dossier: neuroticism meter aria-valuenow=9',
    (await page.locator('[role="meter"][aria-label="Neuroticism"]').getAttribute('aria-valuenow')) === '9');
  await page.screenshot({ path: path.join(SHOTS, '02-dossier-meter.png') });
  await page.keyboard.press('Escape');

  // Charge modal → per-charge sentencing range
  await page.getByRole('button', { name: /Grand Theft/ }).first().click();
  await page.waitForSelector('text=Sentencing Range');
  check('Webb charge modal: 1-year floor shown', (await page.locator('text=1 year in prison').count()) >= 1);
  check('Webb charge modal: 3-year ceiling shown', (await page.locator('text=3 years in prison').count()) >= 1);
  await page.screenshot({ path: path.join(SHOTS, '03-charge-modal.png') });
  await page.keyboard.press('Escape');

  // Accept plea (voiced from the bench) → plea reaction → allocution → sentence → END
  await choiceButton(page, 'ACCEPT').click();
  await advanceTo(page, page.getByRole('button', { name: 'Impose Sentence' }), 'Webb plea sentencing');
  check('Webb plea path: allocution beat revealed before sentencing',
    (await page.locator('li[data-entry-kind="ALLOCUTION"]', { hasText: 'Marcus Webb' }).count()) === 1);
  const seeded = Number(await page.locator('input[type="number"]').inputValue());
  check('Webb plea sentencing: seeded within statutory range', seeded >= 1 && seeded <= 3, `value=${seeded}`);
  await page.getByRole('button', { name: 'Impose Sentence' }).click();
  await advanceTo(page, page.getByRole('button', { name: 'New Case' }), 'Webb plea case closed');
  const end = await ledgerSpeakers(page);
  check('Webb end(plea): record ends COURT (sentence), PRESS (aftermath)',
    JSON.stringify(end.slice(-2)) === JSON.stringify(['COURT', 'PRESS']),
    JSON.stringify(end));
  check('Webb end(plea): plea-accepted aftermath variant shown',
    (await page.locator('text=never had to board a plane').count()) === 1);
  await page.screenshot({ path: path.join(SHOTS, '04-endstate-plea.png'), fullPage: true });
  await page.close();
}

// ---------- Run 2: Webb, forced-trial path, mobile ----------
{
  const page = await newPage(browser, { width: 375, height: 812 });
  await gotoWithRetry(page, BASE);
  await openDocketCase(page, /People v\. Marcus Webb/);

  await advanceTo(page, choiceButton(page, 'REJECT'), 'Webb plea ruling');
  await choiceButton(page, 'REJECT').click();
  await ruleAllMotions(page, 4, 'Webb Act2', { excludeLast: true });
  check('Webb Act2: LOW-risk exhibit drew the derived waiver line',
    (await page.locator('text=No objection from the defense.').count()) === 1);
  check('Webb Act2: rulings carry the structural outcome in the heading',
    (await page.locator('text=Ruling of the Court —').count()) === 4);
  check('Webb Act2: the courtroom reacted to at least one ruling',
    (await page.locator('li[data-entry-kind="MOTION_REACTION"]').count()) >= 1);
  await page.screenshot({ path: path.join(SHOTS, '05-act2-ruling-mobile.png') });

  await callCharge(page, 'GUILTY', 'Webb verdict');
  check('Webb Act3: witness testimony beats played, led by the witness\'s name',
    (await page.locator('li[data-entry-kind="TESTIMONY_DIRECT"]', { hasText: 'Detective Ray Alvarez' }).count()) === 1);
  check('Webb Act3: cross-examination beat played',
    (await page.locator('li[data-entry-kind="TESTIMONY_CROSS"]', { hasText: 'Dana Whitfield' }).count()) === 1);
  check('Webb Act3: closing arguments played',
    (await page.locator('text=Closing Argument — The People').count()) === 1);
  await finishCase(page, 'Webb trial');
  const speakers = await ledgerSpeakers(page);
  check('Webb end(trial): witness beats attributed to WITNESS',
    speakers.filter((s) => s === 'WITNESS').length === 6, JSON.stringify(speakers));
  check('Webb end(trial): trial order + 4 rulings + verdict + sentence are THE COURT',
    speakers.filter((s) => s === 'COURT').length === 7, JSON.stringify(speakers));
  check('Webb end(trial): convicted aftermath variant shown',
    (await page.locator('text=came back in under a day').count()) === 1);
  await page.screenshot({ path: path.join(SHOTS, '06-endstate-trial-mobile.png'), fullPage: true });
  await page.close();
}

// ---------- Run 3: Boone (WEAK → no offer), acquittal, desktop ----------
{
  const page = await newPage(browser, { width: 1280, height: 900 });
  await gotoWithRetry(page, BASE);
  await openDocketCase(page, /People v\. Curtis Boone/);

  await advanceTo(page, page.getByRole('button', { name: 'Order Trial' }), 'Boone trial order');
  check('Boone Act1: declination beat in the record',
    (await page.locator('text=The People Decline to Offer a Plea').count()) === 1);
  check('Boone Act1: no plea-acceptance option exists',
    (await page.locator('button[data-choice="ACCEPT"]').count()) === 0);
  await page.screenshot({ path: path.join(SHOTS, '07-boone-no-offer.png'), fullPage: true });
  await page.getByRole('button', { name: 'Order Trial' }).click();

  await ruleAllMotions(page, 4, 'Boone Act2');
  check('Boone Act2: suppression objection voiced in-character',
    (await page.locator('text=multiple-choice question with one answer in bold').count()) === 1);
  await callCharge(page, 'NOT_GUILTY', 'Boone verdict');
  await finishCase(page, 'Boone acquittal', 'Adjourn');
  check('Boone end: acquittal aftermath variant shown',
    (await page.locator('text=the quiet scandal').count()) === 1);
  await page.screenshot({ path: path.join(SHOTS, '08-boone-acquittal.png'), fullPage: true });
  await page.close();
}

// ---------- Run 4: Reyes (STRONG → offer rejected), conviction, desktop ----------
{
  const page = await newPage(browser, { width: 1280, height: 900 });
  await gotoWithRetry(page, BASE);
  await openDocketCase(page, /People v\. Dominic Reyes/);

  await advanceTo(page, page.getByRole('button', { name: 'Order Trial' }), 'Reyes trial order');
  check('Reyes Act1: defense rejection beat in the record',
    (await page.locator('text=Defense Rejects the Offer').count()) === 1);
  check('Reyes Act1: rejected offer terms in the record',
    (await page.locator('text=Pleads to:').count()) >= 1);
  await page.screenshot({ path: path.join(SHOTS, '09-reyes-rejected-offer.png'), fullPage: true });
  await page.getByRole('button', { name: 'Order Trial' }).click();

  await ruleAllMotions(page, 4, 'Reyes Act2');

  // Exercise the replay affordance: skip the testimony stretch in one click.
  const skip = page.getByRole('button', { name: 'Skip to Next Decision' });
  await advanceTo(page, skip, 'Reyes skip affordance');
  await skip.click();
  check('Reyes skip: landed on the first verdict decision',
    await choiceButton(page, 'GUILTY').isVisible());
  check('Reyes skip: skipped testimony still entered the record',
    (await page.locator('li[data-entry-kind="TESTIMONY_CROSS"]', { hasText: 'Elena Reyes' }).count()) === 1);
  await page.screenshot({ path: path.join(SHOTS, '10-reyes-after-skip.png'), fullPage: true });

  await callCharge(page, 'GUILTY', 'Reyes verdict');
  await finishCase(page, 'Reyes trial');
  check('Reyes end: convicted aftermath variant shown',
    (await page.locator('text=photo off the wall').count()) === 1);
  await page.screenshot({ path: path.join(SHOTS, '11-reyes-conviction.png'), fullPage: true });
  await page.close();
}

// ---------- Run 5: Vaughn (multi-charge), split verdict, desktop ----------
{
  const page = await newPage(browser, { width: 1280, height: 900 });
  await gotoWithRetry(page, BASE);
  await openDocketCase(page, /People v\. Teresa Vaughn/);

  await advanceTo(page, choiceButton(page, 'REJECT'), 'Vaughn plea ruling');
  await choiceButton(page, 'REJECT').click();
  await ruleAllMotions(page, 5, 'Vaughn Act2');

  await callCharge(page, 'GUILTY', 'Vaughn count 1');
  check('Vaughn Act3: per-charge verdict counter reached count 2',
    (await advanceTo(page, page.locator('text=Count 2 of 2'), 'Vaughn count 2 counter')));
  await page.screenshot({ path: path.join(SHOTS, '12-vaughn-count-2.png'), fullPage: true });
  await callCharge(page, 'NOT_GUILTY', 'Vaughn count 2');
  await finishCase(page, 'Vaughn split');
  check('Vaughn end: both verdict beats in the record',
    (await page.locator('text=Verdict of the Court').count()) === 2);
  check('Vaughn end: split-verdict aftermath variant shown',
    (await page.locator('text=down the center line').count()) === 1);
  await page.screenshot({ path: path.join(SHOTS, '13-vaughn-split-endstate.png'), fullPage: true });
  await page.close();
}

await browser.close();

const realErrors = consoleErrors.filter((e) => !e.includes('Download the React DevTools'));
check('Console clean across all runs', realErrors.length === 0, realErrors.slice(0, 5).join(' | '));

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
console.log(`Screenshots: ${SHOTS}`);
process.exit(failures === 0 ? 0 : 1);
