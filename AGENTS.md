# AGENTS.md

OpenCode-specific companion to [`CLAUDE.md`](./CLAUDE.md). Read `CLAUDE.md` first for architecture, vision, and layer rules.

## Cross-Agent Coordination

This repo is worked by both Claude Code and OpenCode; the repo itself is the only shared memory.

- **`TODO.md` is the plan-of-record.** Plans, design decisions, and progress notes (with commit hashes) live there — never only in a chat session. Before starting work, read it; before ending a session with work in flight, note the stopping point and next step there.
- **Keep this file in sync with `CLAUDE.md`.** When a change lands that touches CLAUDE.md, check AGENTS.md in the same commit.
- **Commit messages are the handoff log.** Conventional Commits, one concern per commit — the last commit is often the only record of where the previous session stopped.

## Commands

```bash
npm run dev        # Vite dev server — open http://localhost:5173/the-bench/
npm run build      # tsc -b && vite build (enforces @ts-expect-error gates)
npm run lint       # ESLint across src
npm test           # vitest run (node env; fast, no browser)
npm run test:watch # vitest in watch mode
npm run test:e2e   # Playwright driver over the full demo docket (needs a server — see UI Smoke Test)
npm run test:live  # live Gemini API tests — needs GEMINI_API_KEY, costs real calls, never in CI
npm run preview    # serve dist/ locally
```

**Before marking any task complete, run `npm run lint`, `npm test`, and `npm run build`.**

- `build` type-checks but does **not** run Vitest.
- `preview` requires `build` first.
- Those three plus `test:e2e` are the four gates `.github/workflows/verify.yml` runs on every PR. `deploy.yml` calls the same workflow, so `main` deploys only the artifact the E2E passed against. Running them locally is how you find out before CI does, not a substitute for it.
- `test:live` and the `qa-agent` skill are **never** in CI: both spend real Gemini quota and are non-deterministic. `GEMINI_API_KEY` must never become a CI secret.

## Repo Quirks

- **No backend.** Static SPA deployed to GitHub Pages. Never add Express, Next.js API routes, serverless functions, or proxies.
- **Locked stack.** Do not add dependencies without explicit approval. Current stack: Vite, React 19, TypeScript strict, Zustand, Zod, Tailwind CSS v4, lucide-react.
- **Base path is `/the-bench/`** (Vite config). Dev server root 404s; use `http://localhost:5173/the-bench/`.
- **CI is the enforcement, not a local hook.** `verify.yml` runs lint, unit tests, build and E2E on every PR and on `main`. A pre-commit hook running `lint && build` may exist in a given working copy, but nothing under `.githooks`/`husky` is tracked and `core.hooksPath` is unset, so it does **not** survive `git clone` — never rely on it as the gate.
- **Node 22**, pinned by `.nvmrc` and `engines` (eslint 10 needs `^20.19.0` at minimum; CI uses `node-version-file`).
- **Conventional Commits only:** `feat:`, `fix:`, `chore:`, `docs:` — one concern per commit.

## TypeScript

Project references split:

- `tsconfig.app.json` → `src/` (browser)
- `tsconfig.node.json` → `vite.config.ts` (node)

Strict flags that matter:

- `exactOptionalPropertyTypes: true`
- `noUncheckedIndexedAccess: true`
- `verbatimModuleSyntax: true`
- `noUnusedLocals: true` / `noUnusedParameters: true`

## Testing

Unit tests live in `src/lib/__tests__/`, `src/schemas/__tests__/`, and `src/lib/llm/__tests__/`.

- Run a single test file: `npx vitest run src/lib/__tests__/pleaAssessment.test.ts`
- Run a single test: `npx vitest run -t "test name pattern"`

No integration test server required; tests are pure node. `src/lib/llm/__tests__/` stubs `fetch`, so the default suite never calls the Gemini API.

`src/lib/llm/__tests__/live/` **does** call it, behind a separate `vitest.live.config.ts` and `npm run test:live`. It is excluded from the default run by `vite.config.ts`'s `test.exclude` whether or not a key is present, and `describe.skipIf` skips it cleanly when `GEMINI_API_KEY` is absent (repo-root `.env`, gitignored, or the shell env). It includes `pipelineDiagnostic.live.test.ts`, which runs `generateCase()` N times and writes a ranked stage × issue failure table to a file — the measurement instrument, not a pass/fail gate, so it asserts nothing about its own results.

**Probe any `responseSchema` or `generationConfig` change against the live API before shipping it, and re-measure straight after.** `minItems` on an array whose items nest a nullable object, and `thinkingBudget: 0`, have each taken this pipeline to a bare 400 on entirely plausible-sounding reasoning. See CLAUDE.md's pipeline section for both.

## UI Smoke Test

For UI changes, use the committed skill at `.claude/skills/run-the-bench/`.

```bash
# one-time throwaway Playwright install (not a project dependency)
npm i --prefix /tmp/bench-playwright playwright
npx --prefix /tmp/bench-playwright playwright install chromium-headless-shell

# run
npm run dev &
node .claude/skills/run-the-bench/driver.mjs
```

The driver plays the full demo docket — six runs across all five cases in `src/lib/demoCases/` (Webb plea + trial, Boone, Reyes, Vaughn's split verdict, Navarro's guided tutorial) — asserting demo data and screenshotting every stage. If a demo case or the ledger/action-bar/welcome UI changes intentionally, update `driver.mjs` to match. `npm run test:e2e` is the same driver; point it at `npm run dev`, or at `npm run preview` with `BASE_URL=http://localhost:4173/the-bench/` to test the production bundle the way CI does.

It is free and deterministic, and it reads **fixed demo data**. The separate `qa-agent` skill (`.claude/skills/qa-agent/`) is neither: it drives a real BYOK-generated case and has a second, independent Gemini call judge every beat for realism and UI problems the way a human tester would. That is the only check that reads what the live pipeline actually *writes* — but it spends real quota twice over and is manual-only, like `test:live`. Do not confuse the two, and never wire `qa-agent` into `npm test`/lint/build/CI.

## Architecture Reminders

- Three Zustand stores (`useGameStore`, `useSecurityStore`, `useUIStore`). Never use Redux or Context for global state.
- `ValidationLayer` (Zod) gates every inbound payload — LLM responses, demo case, and `FinalResult`.
- `GameService` is the **only** caller of the Gemini API. It orchestrates seven LLM stages — StatuteSelection → EnvironmentGen → CharacterGen → InterrogationGen (conditional) → EvidenceGen → VerdictVoice → PleaNarrative, with `finalizeCasePayload` assembling in between — and derives the interrogation profile, prosecution band, plea offer terms and defense posture *deterministically* between calls.
- **LLM provides color, deterministic code provides structure.** Plea structure, sentencing exposure, and the Act 2 → Act 3 modifier are pure functions of validated data. If you are about to let a model decide something structural, you are about to break the core mandate.
- `localStorage` persists only immutable `FinalResult` snapshots post-game. Never store active game state or the API key there.

## Where to Look

- Schemas & types: `src/schemas/gameSchemas.ts`
- State machine & phase rules: `src/store/useGameStore.ts`
- Security vault: `src/store/useSecurityStore.ts`; view state: `src/store/useUIStore.ts`
- Demo docket (five cases + registry): `src/lib/demoCases/`
- Case source seam (demo vs. LLM pipeline — both implemented): `src/lib/caseSource.ts`
- LLM generation pipeline: `src/lib/llm/` — `gameService.ts` (orchestration), `stages.ts` (one function per stage + its Gemini `responseSchema`), `geminiClient.ts` (transport), `modelSelection.ts` (runtime model discovery), `reconcileCase.ts` (deterministic cross-stage id repair)
- Deterministic derivations (plea, sentencing, modifiers): `src/lib/pleaAssessment.ts`, `src/lib/sentencingExposure.ts`, `src/lib/sentenceBounds.ts`
- Courtroom script projection (beats + decisions): `src/lib/courtroomScript.ts`
- App shell / phase router: `src/App.tsx` → `AppShell`
