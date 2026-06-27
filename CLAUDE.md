# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start Vite dev server with HMR
npm run build      # Type-check (tsc -b) then bundle for GitHub Pages
npm run lint       # ESLint across the project
npm run preview    # Serve the dist/ build locally
```

Before marking any task complete, run `npm run lint` and `npm run build`. The app must build and type-check cleanly — it deploys to GitHub Pages as a static bundle.

## Vision

**The Bench** is a single-page California criminal court judge simulation. The player is the judge. A generated case lands on their desk and they make three sequential decisions:

1. **Act 1 — Intake & Plea**: Rule on a plea deal. Accept it and skip to sentencing, or force trial.
2. **Act 2 — Evidentiary Motions**: Rule on admissibility of each piece of evidence. Rulings carry forward as penalty modifiers.
3. **Act 3 — Verdict & Sentencing**: Deliver a verdict and impose sentence. The available sentencing range is shaped by the player's Act 2 rulings and the defendant's generated profile (OCEAN traits and criminal history).

After sentencing, **Aftermath** generates: a Gemini narrative (public reaction, consequences, press coverage) and a persisted `FinalResult` snapshot.

The game is powered by the player's own Gemini API key (BYOK) or a hardcoded demo case that bypasses the LLM entirely. The central engineering challenge is forcing a non-deterministic LLM into a deterministic state machine through strict JSON schemas and Zod validation at every trust boundary.

This is a public portfolio project documenting a career transition into AI Systems Architecture. It is deliberately not "vibe coded" — the human drives all decisions, AI assists execution. The commit history is the documentation of that process.

## Architecture

### Layers

| Layer | Role | Rule |
|---|---|---|
| **UI (React 19)** | Displays state, triggers actions | Never calls `fetch()` or reads the API key back |
| **GameService** | Orchestrates all Gemini calls via native `fetch()`; triggers the generation pipeline and the Aftermath call | Only caller of the Gemini API |
| **ResultGenerator** | Standalone module — assembles the `FinalResult` object from end-of-game state | Sends unvalidated result to ValidationLayer; never writes to localStorage directly |
| **DemoCase** | Hardcoded JSON payload for offline/keyless play | Bypasses GameService and LLM entirely; feeds directly into ValidationLayer |
| **ValidationLayer** | Zod parses every LLM response and every `FinalResult` before state hydration | Three outputs: validated data → GameState, any failure → ErrorState, immutable FinalResult → localStorage |
| **Zustand stores** | Source of truth for game and security state | Two isolated slices (see below) |
| **localStorage** | Persists only immutable `FinalResult` objects post-game | Never stores active state or the API key |

### State Machine (`useGameStore`)

Phases flow in one direction only. Illegal transitions are blocked and immediately forced to `ERROR_STATE`:

```
WELCOME → ACT_1_INTAKE (Intake & Plea)
  ├─ Plea Accepted  → ACT_3_VERDICT (Verdict & Sentencing) — skips Motions
  └─ Trial Forced   → ACT_2_MOTIONS (Evidentiary Motions) → ACT_3_VERDICT (Verdict & Sentencing)
ACT_3_VERDICT → END_STATE (Aftermath)
All phases → ERROR_STATE → WELCOME (reset)
```

The transition matrix is defined in `ALLOWED_PHASE_TRANSITIONS` at `src/store/useGameStore.ts:25`. Every call to `setPhase()` is validated against it and then run through `GamePhaseSchema.safeParse()` before mutating state.

### Security Store (`useSecurityStore` — BYOKVault)

Isolated Zustand slice holding the user's Gemini API key **in memory only**. Key invariants:
- The key never touches `localStorage`, `sessionStorage`, cookies, or the URL.
- `isAuthenticated()` returns true if any vault passed `BYOKSchema.safeParse()`, or if `isDemo === true`.
- `setVault()` runs `BYOKSchema.safeParse()` and silently nulls the vault on failure.

### Schemas (`src/schemas/gameSchemas.ts`)

Single source of truth for all Zod schemas and their inferred TypeScript types. Schema sections:
1. **Security** — `BYOKSchema` (discriminated union: live key vs. demo mode)
2. **Legal infrastructure** — `SentenceSchema` (5 literal variants with correlated unit constraints), `ChargeSchema`, `StatuteElementSchema`
3. **Character entities** — `CharacterSchema` with OCEAN personality traits
4. **Evidence & witnesses** — `EvidenceSchema`, `WitnessSchema`
5. **Environment & case payload** — `EnvironmentSchema`, `CaseSchema` / `CasePayloadSchema` (no `pleaPosture`); `PleaNarrativeSchema` carries the LLM's plea rationale strings
6. **State machine** — `GamePhaseSchema`

### Generation Pipeline (designed — implementation begins with Act 1)

Case generation flows through four sequential LLM calls via GameService, each scoped strictly and passing context forward:

```
StatuteSelection → EnvironmentGen → CharacterGen → EvidenceGen → CasePayload (→ ACT_1_INTAKE)
```

Each stage feeds its output as context into the next call. The pipeline produces a single validated `CasePayload` that hydrates the game state at Act 1 entry. The LLM's plea contribution is narrative-only, supplied via `PleaNarrativeSchema` (separate from `CaseSchema`); plea structure is computed deterministically by `buildPleaPosture`.

## Resolved Design Decisions

The three decisions that previously gated GameService and Act 3 are resolved. All three uphold the core mandate — **LLM provides color, deterministic pipeline provides structure** — and the principle of making illegal states inexpressible.

**Plea posture source of truth — resolved (`b637258`).** `pleaPosture` is removed from `CaseSchema`; the LLM no longer generates plea structure. Its only plea contribution is `PleaNarrativeSchema` (`prosecutionRationale`, optional `defenseRationale`). All structure (status, proposed sentence, charge partition) is computed by `buildPleaPosture` in `src/lib/pleaAssessment.ts`, which is the sole source of truth.

**`buildPleaPosture` input contract — resolved (`82aff10`).** The optional `defenseRationale?: string` (a runtime throw) is replaced by a discriminated `PleaPostureInput` union keyed on `band`. A WEAK input cannot carry a `defenseRationale`; a MODERATE/STRONG input cannot omit it — enforced at compile time. The offer-gate moved to the `band` discriminant and `SENTENCE_DISCOUNT` is now a closed `Record<'MODERATE'|'STRONG', number>`, so adding a future band is a compile error rather than a silent bogus offer.

**`sentencingModifierFromRulings` zero contract — resolved (`6e6f328`).** Calling with an empty `motionRulings` array now throws (the state machine guarantees Act 2 precedes Act 3 on the trial path, so the array is non-empty here). With the off-path case removed, a `0` return has exactly one meaning: the player excluded all evidence — a prosecution shut-out.

Test coverage for all three lives in `src/lib/__tests__/` and `src/schemas/__tests__/` (Vitest); the `PleaPostureInput` contract is additionally gated by `@ts-expect-error` checks enforced at `npm run build`.

---

## Key Constraints

- **No backend.** Static SPA on GitHub Pages. No Express, Next.js API routes, serverless functions, or proxy servers.
- **No Redux or Context for global state.** Zustand only.
- **No new dependencies without explicit approval.** The stack is locked: Vite, React 19, TypeScript strict, Zustand, Zod, Tailwind CSS v4, lucide-react.
- **Commits use Conventional Commits:** `feat:`, `fix:`, `chore:`, `docs:` — one concern per commit.
- **`App.tsx` is currently a Vite scaffold placeholder** — actual game UI has not been built yet.
- Vite base path is `/the-bench/` (required for GitHub Pages routing).
