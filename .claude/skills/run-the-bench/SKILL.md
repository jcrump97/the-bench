---
name: run-the-bench
description: Run, screenshot, and verify The Bench in a headless browser — start the Vite dev server and drive the demo case end-to-end (both plea and trial branches) with the committed Playwright driver. Use for "run the app", "start the dev server", "screenshot the app", "verify the UI", or smoke-testing a UI change.
---

# Run The Bench

Static Vite + React SPA (no backend). The agent path is a committed
Playwright driver that plays the demo docket through both branches
headlessly, asserts against demo data, and screenshots every stage. All
paths below are relative to the repo root.

The game is **beat-by-beat**: the court record reveals one statement at a
time behind Continue-style buttons ("Call the Case" / "Continue" / "Proceed
to Trial"), and the action bar pauses at each decision (plea ruling, one
exhibit ruling at a time, one charge verdict at a time, sentencing). The
driver's `advanceTo()` helper clicks through statement beats until a target
control appears — reuse it if you extend the driver.

## Prerequisites (agent path)

Playwright is deliberately NOT a project dependency (stack is locked — see
CLAUDE.md). Install it in a throwaway prefix; the browser download is a
no-op when `~/.cache/ms-playwright` already has a matching build:

```bash
npm i --prefix /tmp/bench-playwright playwright
npx --prefix /tmp/bench-playwright playwright install chromium-headless-shell
```

## Run (agent path)

```bash
npm run dev &   # serves http://localhost:5173/the-bench/ (base path matters)
node .claude/skills/run-the-bench/driver.mjs
```

The driver exits 0 only if every check passes and the console stayed clean.
Screenshots land in `/tmp/bench-verify-shots/` (override with `SHOTS_DIR`);
look at them — a blank frame means the app didn't render. Other knobs:
`BASE_URL` (default `http://localhost:5173/the-bench/`), `PLAYWRIGHT_PREFIX`
(default `/tmp/bench-playwright`).

What it drives: five runs across the four docket cases —
1. **Webb** accepted plea at 1280px (beat reveal, dossier + charge modals,
   allocution beat, plea-accepted ending)
2. **Webb** forced trial at 375px (4 per-exhibit rulings incl. a derived
   waiver line, witness/cross/closing beats, convicted ending)
3. **Boone** (WEAK → no offer): trial-only path, voiced suppression
   objection, adjournment on full acquittal
4. **Reyes** (STRONG → offer rejected): rejected-offer beats, the
   Skip-to-Next-Decision affordance, convicted ending
5. **Vaughn** (multi-charge): one verdict beat per charge, SPLIT ending

Each ending is asserted by a phrase unique to that case's aftermath variant,
which is what proves the outcome-conditioned branching end to end.

**The assertions pin the demo docket** (names, 1–3 year Webb range, per-case
evidence counts, beat headings and speaker order, aftermath variant
phrases). If a case in `src/lib/demoCases/`, the courtroom script in
`src/lib/courtroomScript.ts`, or the action-bar/welcome UI changes
intentionally, update `driver.mjs` to match.

## Run (human path)

```bash
npm run dev   # open http://localhost:5173/the-bench/ in a browser, Ctrl-C to stop
```

Useless headless — the game is click-driven with no URL routing.

## Test / lint / build

```bash
npx vitest run   # unit tests (fast, no browser)
npm run lint && npm run build
```

A pre-commit hook runs `lint` + `build` (tsc -b) on every commit and blocks
on failure — don't be surprised when `git commit` takes a few seconds and
prints a Vite build.

## Gotchas

- **The base path is `/the-bench/`** (GitHub Pages). `http://localhost:5173/`
  without it 404s. The driver's default `BASE_URL` includes it.
- **ESM can't resolve the throwaway Playwright via `NODE_PATH`** — the
  driver uses `createRequire` against `$PLAYWRIGHT_PREFIX/node_modules`
  instead. Don't convert it to a bare `import 'playwright'`.
- **Playwright version ↔ browser build must match.** `playwright@1.61.x`
  wants browser build 1228; if the cached build mismatches after a
  playwright upgrade, rerun the `playwright install chromium-headless-shell`
  line.
- **Custom CSS must live in `@layer base`** (`src/index.css`). Unlayered
  rules beat every Tailwind utility under cascade layers — an unlayered
  `button { color: inherit }` once silently killed `text-(--bg)` on accent
  buttons. The driver has a computed-style regression check for this.
- The dossier/charge modals open from buttons in the left panel; on the
  375px viewport the panels start closed (the driver only uses modals on
  the desktop run).

## Troubleshooting

- `dev server not reachable at …` from the driver → `npm run dev` isn't
  running, or you're on a non-default port (Vite picks 5174+ if 5173 is
  busy — check its startup line and set `BASE_URL`).
- `playwright not found — run the Prerequisites step` → the throwaway
  install is missing; rerun the two Prerequisites commands or point
  `PLAYWRIGHT_PREFIX` at an existing install.
- `Executable doesn't exist … chromium_headless_shell-…` → browser cache
  and package version drifted; rerun the `playwright install` line.
