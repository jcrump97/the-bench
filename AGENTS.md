# AGENTS.md

OpenCode-specific companion to [`CLAUDE.md`](./CLAUDE.md). Read `CLAUDE.md` first for architecture, vision, and layer rules.

## Commands

```bash
npm run dev        # Vite dev server — open http://localhost:5173/the-bench/
npm run build      # tsc -b && vite build (enforces @ts-expect-error gates)
npm run lint       # ESLint across src
npm test           # vitest run (node env; fast, no browser)
npm run test:watch # vitest in watch mode
npm run preview    # serve dist/ locally
```

**Before marking any task complete, run `npm run lint`, `npm test`, and `npm run build`.**

- `build` type-checks but does **not** run Vitest.
- `preview` requires `build` first.

## Repo Quirks

- **No backend.** Static SPA deployed to GitHub Pages. Never add Express, Next.js API routes, serverless functions, or proxies.
- **Locked stack.** Do not add dependencies without explicit approval. Current stack: Vite, React 19, TypeScript strict, Zustand, Zod, Tailwind CSS v4, lucide-react.
- **Base path is `/the-bench/`** (Vite config). Dev server root 404s; use `http://localhost:5173/the-bench/`.
- **Pre-commit hook** runs `npm run lint && npm run build`. Commits block on failure and print staged stat summary first.
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

Unit tests live in `src/lib/__tests__/` and `src/schemas/__tests__/`.

- Run a single test file: `npx vitest run src/lib/__tests__/pleaAssessment.test.ts`
- Run a single test: `npx vitest run -t "test name pattern"`

No integration test server required; tests are pure node.

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

The driver asserts against the hardcoded demo case (`src/lib/demoCase.ts`) and screenshots every stage. If demo data or UI changes intentionally, update `driver.mjs` to match.

## Architecture Reminders

- Three Zustand stores (`useGameStore`, `useSecurityStore`, `useUIStore`). Never use Redux or Context for global state.
- `ValidationLayer` (Zod) gates every inbound payload — LLM responses, demo case, and `FinalResult`.
- `GameService` is the **only** caller of the Gemini API.
- `localStorage` persists only immutable `FinalResult` snapshots post-game. Never store active game state or the API key there.

## Where to Look

- Schemas & types: `src/schemas/gameSchemas.ts`
- State machine & phase rules: `src/store/useGameStore.ts`
- Security vault: `src/store/useSecurityStore.ts`
- Demo case: `src/lib/demoCase.ts`
- Deterministic derivations (plea, sentencing, modifiers): `src/lib/pleaAssessment.ts`, `src/lib/sentencingExposure.ts`
- App shell / phase router: `src/App.tsx`
