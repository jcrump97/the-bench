# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start Vite dev server with HMR
npm run build      # Type-check (tsc -b) then bundle for GitHub Pages
npm run lint       # ESLint across the project
npm run preview    # Serve the dist/ build locally
npm test           # Run the Vitest suite once (hermetic — no network calls)
npm run test:watch # Vitest in watch mode
npm run test:live  # Live Gemini API tests — needs GEMINI_API_KEY, costs real calls
```

Before marking any task complete, run `npm run lint`, `npm test`, and `npm run build`. The app must build and type-check cleanly — it deploys to GitHub Pages as a static bundle. Note that `npm run build` enforces the `@ts-expect-error` type-negative gates but does not execute the Vitest suites; only `npm test` does.

`npm test` never touches the real Gemini API — `src/lib/llm/`'s ordinary suite stubs `fetch`. Live coverage of the actual API lives in `src/lib/llm/__tests__/live/` (a separate `vitest.live.config.ts`, excluded from the default suite via `vite.config.ts`'s `test.exclude` regardless of whether a key is present) and only runs via `npm run test:live`. It reads `GEMINI_API_KEY` from a repo-root `.env` (gitignored, never committed) or the shell environment, and skips cleanly via `describe.skipIf` when no key is available — it never fails a normal `npm test`/CI run for lacking one. A live run once caught a real gap `test`'s mocks couldn't: `selectModel` picked a pinned model build (`gemini-2.0-flash-lite-001`) that `ListModels` still listed as `generateContent`-capable but that had actually been retired — fixed by preferring `-latest` aliases over dated/pinned/preview names in `modelSelection.ts`'s ranking. It also caught Gemini's structured-output mode materializing the optional `interrogation` field as an explicit `null` rather than omitting it — fixed with a `z.preprocess` normalization in `stages.ts` before the real `EvidenceSchema`/`CaseSchema` validate.

UI changes are verified with the committed `run-the-bench` skill (`.claude/skills/run-the-bench/`) — a headless Playwright playthrough of the full demo docket (five cases, both branches, including per-charge verdicts). Playwright is deliberately not a project dependency; the skill installs it in a throwaway prefix.

Neither `run-the-bench` (fixed demo data) nor `test:live` (schema-shape only) reads what the live Gemini pipeline actually *writes* the way a human would — that gap is exactly how a jury reference (this is always a bench trial; the judge alone decides) once slipped into generated dialogue unnoticed. The `qa-agent` skill (`.claude/skills/qa-agent/`) closes it: it drives a real BYOK-generated case with Playwright and, at every beat, asks a second, independent Gemini call — playing a technically literate human QA tester — to judge the content for realism/verbiage/UI issues and to choose its own actions, then writes a Markdown findings report. It spends real API quota twice over (case generation and per-beat judgment) and is manual-only, like `test:live` — never wire it into `npm test`/lint/build/CI.

## Vision

**The Bench** is a single-page California criminal court judge simulation. The player is the judge. A generated case lands on their desk and unfolds **one beat at a time** — a click-to-advance courtroom where every statement is spoken into the record by a party (clerk, counsel, witness, press; never an omniscient narrator) and the action bar pauses at each decision:

1. **Act 1 — Intake, Arraignment & Plea**: The clerk performs procedure only (the case call, the charges); the defense enters the not-guilty plea, the People state the facts (`statementOfFacts` — facts always come from a party), and both sides disclose every exhibit and witness with brief unverified summaries. Only then do the attorneys voice the plea posture. Rule on the deal: accept it and skip to sentencing, or order trial.
2. **Act 2 — Evidentiary Motions**: Each exhibit is offered by the People, objected to (or waived) by the defense, and ruled on individually; a recorded interrogation exhibit is played into the record line by line between its offer and the suppression objection. Rulings carry forward as penalty modifiers.
3. **Act 3 — Verdict & Sentencing**: Witnesses testify (direct and cross), both sides close, verdicts are entered one charge at a time, and sentence is imposed (the defendant allocutes first on the plea path). The sentencing range is shaped by per-charge statutory ranges; Act 2 rulings, criminal history, and a derived probation demeanor note are shown as judge's context — the OCEAN traits themselves are invisible behavior drivers, never display data.

After sentencing, **Aftermath** generates: a Gemini narrative (public reaction, consequences, press coverage) and a persisted `FinalResult` snapshot.

The game is powered by the player's own Gemini API key (BYOK) or a hardcoded demo case that bypasses the LLM entirely. The central engineering challenge is forcing a non-deterministic LLM into a deterministic state machine through strict JSON schemas and Zod validation at every trust boundary.

This is a public portfolio project documenting a career transition into AI Systems Architecture. It is deliberately not "vibe coded" — the human drives all decisions, AI assists execution. The commit history is the documentation of that process.

## Architecture

### Layers

| Layer | Role | Rule |
|---|---|---|
| **UI (React 19)** | Displays state, triggers actions | Never calls `fetch()` or reads the API key back |
| **GameService** | Orchestrates all Gemini calls via native `fetch()`; triggers the generation pipeline and the Aftermath call | Only caller of the Gemini API |
| **ResultGenerator** | Standalone module — assembles the `FinalResult` object from end-of-game state (not yet implemented — designed alongside GameService) | Sends unvalidated result to ValidationLayer; never writes to localStorage directly |
| **DemoCase** | Hardcoded JSON payload for offline/keyless play | Bypasses GameService and LLM entirely; feeds directly into ValidationLayer |
| **ValidationLayer** | Zod parses every LLM response and every `FinalResult` before state hydration | Three outputs: validated data → GameState, any failure → ErrorState, immutable FinalResult → localStorage |
| **Zustand stores** | Source of truth for game, security, and view state | Three isolated slices (see below) |
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

The transition matrix is defined in `ALLOWED_PHASE_TRANSITIONS` in `src/store/useGameStore.ts`. Every call to `setPhase()` is validated against it and then run through `GamePhaseSchema.safeParse()` before mutating state.

Alongside `activeCase`, the store holds `activePleaNarrative` — the LLM's (or demo case's) narrative-only plea input. It is upstream input data, not a derived value: the computed `PleaPosture` stays a pure derivation and is never stored. `setActivePleaNarrative` mirrors case hydration — phase-gated to `WELCOME` and `PleaNarrativeSchema.safeParse`d, with any violation forcing `ERROR_STATE`.

Player decisions accumulate one entry at a time so the court record can show each ruling as it lands: `addMotionRuling` (upsert by `evidenceId`, phase-gated to `ACT_2_MOTIONS`) and `addChargeVerdict` (upsert by `chargeId`, phase-gated to `ACT_3_VERDICT`). There is no atomic `setVerdict`.

The store also keeps `spokenJudgeLines` — the judge's chosen line per decision-point id (`'plea'` | `` `motion-${evidenceId}` `` | `` `verdict-${chargeId}` ``), written by `recordSpokenJudgeLine` from the same handler that dispatches the structural decision. It is a narrative voice record only: game logic never reads it, and the courtroom-script projection falls back deterministically to the first authored option matching the recorded decision when a key is absent.

### Courtroom Script (`src/lib/courtroomScript.ts`)

The single source of courtroom truth. `buildCourtroomScript` is a pure projection of validated state into an ordered screenplay: speaker-attributed `STATEMENT` beats (the transcript) and `DECISION` beats (where the script pauses for the judge). Each `STATEMENT` beat carries a `speaker` (the party role) and an optional `speakerName` — the individual actually speaking (the witness on the stand, the allocuting defendant, either voice on a played interrogation tape) — so the rendered record can lead each utterance with the person, not just the role. Beats that present a case-file item are stamped with a `subject` (`EVIDENCE`/`WITNESS`/`CHARGE` + id): one field powering both the **progressive reveal** (`src/lib/reveal.ts` derives `DISCLOSED`→`PRESENTED` tiers from the revealed prefix; `useRevealState` gates the panels and detail modals, so nothing is browsable before it enters the record) and the transcript's click-through (a subject row opens its detail modal + panel). Two tested invariants: **no spoilers** (emission stops at the first unresolved decision) and **prefix stability** (resolving a decision replaces its marker in place and only appends after it — earlier beats never change). The UI reveals a prefix of this one sequence via `beatCursor`, so the transcript can never disagree with the beats that played. On offer-less plea paths the trial order is resolved by phase (those paths write no `pleaDecision`).

`LedgerEntryRow` renders the record as a spoken transcript, not summary cards: the speaker leads each line (by `speakerName` when present), the editorial heading is demoted to stage direction or dropped where the speaker already carries it (reactions), and a per-speaker accent (the `--speaker-*` tokens) runs down the margin. The court's rulings keep a heading-led panel (the structural outcome stays visible) and the press aftermath renders as a clipping. Each row exposes `data-speaker`/`data-entry-kind` for structural selection (e.g. the `run-the-bench` driver) independent of the visible copy. `TESTIMONY_DIRECT` beats additionally carry `calledByDefense` (derived from `witness.bias`) so the demoted caption can still say which side called the witness once the heading itself is no longer rendered.

Two voiced layers ride on the decisions (both harvested from the retired DialogueScript pilot and re-implemented natively):
- **Judge-line options** — the decision controls present authored `{ choice, lineText }` options (2–6 per decision point, every closed choice covered by schema refinement; variants multiply voice, never the state space). The chosen line is spoken as the `COURT` beat's body and recorded in `spokenJudgeLines`; the structural outcome always also appears deterministically in the beat's heading. Craft rules: the judge speaks only lines the player picked, and option text never states numbers the engine doesn't produce. Sentencing stays a structured form.
- **Reaction beats** — after each resolved decision the courtroom reacts: 1–4 in-character lines selected from closed records keyed by the decision value (`rulingReactions` per exhibit, `verdictReactions` per charge, `pleaReactions` on the plea narrative). Selection is deterministic; content is narrative. `COURT` is not a reaction speaker — the court never reacts to its own ruling.

### Security Store (`useSecurityStore` — BYOKVault)

Isolated Zustand slice holding the user's Gemini API key **in memory only**. Key invariants:
- The key never touches `localStorage`, `sessionStorage`, cookies, or the URL.
- `isAuthenticated()` returns true if any vault passed `BYOKSchema.safeParse()`, or if `isDemo === true`.
- `setVault()` runs `BYOKSchema.safeParse()` and silently nulls the vault on failure.

### UI Store (`useUIStore`)

Third isolated Zustand slice holding **view state only**: the two side-panel open/closed flags, the active detail modal (`ActiveModal` discriminated union), `beatCursor` — how many beats of the courtroom script are revealed (`advanceBeat`, forward-only `setBeatCursor` for skip-to-next-decision, `resetBeatCursor` on case start/reset) — and the one-shot panel-collapse hint (`panelHintActive`/`panelHintPlayed`, in-memory so it fires once per session and nothing new persists). Deliberately unvalidated — nothing in it crosses a trust boundary or is persisted, and a cursor bug can only pace the reveal wrong, never corrupt the record: decisions still commit through the game store's validated actions.

### Schemas (`src/schemas/gameSchemas.ts`)

Single source of truth for all Zod schemas and their inferred TypeScript types. Schema sections:
1. **Security** — `BYOKSchema` (discriminated union: live key vs. demo mode)
2. **Legal infrastructure** — `SentenceSchema` (5 literal variants with correlated unit constraints), the closed decision vocabularies (`PleaDecisionSchema`, `EvidenceRulingSchema`, `VerdictValueSchema`) with the voiced-dialogue machinery keyed off them (`ReactionLineSchema`/`ReactionBeatSchema`, the `judgeLineOption` factory + choice-coverage refinement), `ChargeSchema` (per-charge `mandatoryMinimums`/`maximumPenalties` — the source of truth for sentencing ranges; case-level exposure is derived deterministically by `deriveSentencingExposure` in `src/lib/sentencingExposure.ts` — plus `verdictReactions` and `verdictOptions`), `StatuteElementSchema`
3. **Character entities** — `CharacterSchema` with OCEAN personality traits
4. **Evidence & witnesses** — `EvidenceSchema` (Tier-1 `disclosureSummary` for the discovery beats; voiced `prosecutionArgument` and nullable `defenseObjection` with a refinement tying waiver to LOW `objectionRisk`; `rulingReactions` + `rulingOptions`; the `INTERROGATION` type carries an `InterrogationSchema` transcript block — `outcome`/`challengeGround` are echo fields that `defineDemoCase` validates against `deriveInterrogationProfile` in `src/lib/interrogation.ts`, the pure function mapping OCEAN traits + prior count to what the interview room produced; an `INVOKED_COUNSEL` profile forbids the exhibit entirely, and `describeDemeanor` in `src/lib/demeanorNotes.ts` is the traits' other derived, digit-free surface), `WitnessSchema` (with `directExamination` and nullable `crossExamination`; which side calls the witness derives from `bias`; `statement` doubles as the discovery-beat body)
5. **Environment & case payload** — `EnvironmentSchema`, `CaseSchema` / `CasePayloadSchema` (no `pleaPosture`; carries `statementOfFacts` — the People's spoken statement of the case, while `summary` is a dry allegations-only docket synopsis — and `closingArguments`); `PleaNarrativeSchema` carries the LLM's on-the-record plea rationale strings plus optional `allocution`, `pleaReactions`, and `pleaRulingOptions` (each authored exactly when the posture is `PENDING_JUDICIAL_REVIEW` — `defineDemoCase` enforces the pairings)
6. **State machine** — `GamePhaseSchema`

### Generation Pipeline (`src/lib/llm/` — implemented)

Case generation flows through five sequential LLM calls via GameService, each scoped strictly and passing context forward:

```
StatuteSelection → EnvironmentGen → CharacterGen → InterrogationGen → EvidenceGen → CasePayload (→ ACT_1_INTAKE)
```

Each stage feeds its output as context into the next call. The pipeline produces a single validated `CasePayload` that hydrates the game state at Act 1 entry. The LLM's plea contribution is narrative-only, supplied via `PleaNarrativeSchema` (separate from `CaseSchema`); plea structure is computed deterministically by `buildPleaPosture`. **InterrogationGen** receives the deterministic profile from `deriveInterrogationProfile` (what the interview produced, on which ground the defense attacks it) and writes a transcript dramatizing exactly that structure, echoing `outcome`/`challengeGround` back for validation — an `INVOKED_COUNSEL` profile skips the stage (no usable tape exists).

`src/lib/llm/` implements the pipeline behind `createGameService(apiKey): CaseSource`:
- **`geminiClient.ts`** — native-`fetch` wrapper around Gemini's `generateContent`/`models` endpoints; retries on 429/5xx with capped exponential backoff, throws a typed `GeminiError` on exhaustion or 4xx.
- **`modelSelection.ts`** — `selectModel(apiKey)` discovers the cheapest capable model at runtime via `ListModels`, ranking candidates on two independent axes: **tier** (`flash-lite` > `flash` > anything else) and, within a tier, **stability** (a `-latest` alias > a plain versioned name > a preview/dated-snapshot/pinned-numeric-build name) — a live run once picked a retired pinned build (`gemini-2.0-flash-lite-001`) that `ListModels` still listed as `generateContent`-capable ahead of `gemini-flash-lite-latest`, which Google keeps pointing at a working model; ranking by stability as well as tier fixes that. The exclusion filter also drops specialist non-text families (`image`/`tts`/`robotics`/`lyria`/`computer-use`/`antigravity`/`deep-research`/`omni`/etc., alongside `pro`/`ultra`/`embedding`/`vision`) so a model like `gemini-3.1-flash-lite-image` is never picked just because its name contains "flash". Falls back to a hardcoded candidate if discovery fails entirely. No model name is hardcoded as "the" model — Gemini's lineup shifts over time, and this adapts without a code change. `getOrSelectModel` caches the resolved model in a module-scoped map keyed by API key — not instance-scoped on `GameService` — so every `GameService` created for the same key within a session (e.g. `WelcomeScreen`'s `generateCase` and a later, separately-constructed instance for `SentencingControl`'s `generateAftermath`) reuses the one resolved model instead of re-querying `ListModels`.
- **`stages.ts`** — one function per pipeline stage, each pairing a hand-written Gemini `responseSchema` (shapes the output) with the *same* Zod schemas hand-authored demo cases cross (the real validation gate). A shared `generateValidated` helper retries a failed generation with the Zod issues fed back into the prompt as corrective feedback. Every evidence-bearing response is preprocessed to normalize an explicit `null` `interrogation` field to `undefined` before validation — Gemini's structured-output mode materializes an optional field as `null` rather than omitting it, but `EvidenceSchema`'s `interrogation` is optional, not nullable. EvidenceGen's schema also `superRefine`s on whether an `INTERROGATION`-type exhibit is present or absent to match the derived profile's requirement — prompt text alone doesn't guarantee compliance, and a schema-valid response that silently omits (or wrongly includes) the exhibit now feeds a retry instead of passing through unnoticed. `finalizeCasePayload` assembles the full case and, on a cross-stage refinement failure (id uniqueness, `targetElementId` references), runs one bounded repair round (the same null-normalization applied first): the assembled JSON plus the flattened issues go back to Gemini for a full corrected payload.
- **`gameService.ts`** — `createGameService(apiKey): CaseSource` orchestrates the stages in order, deriving `deriveInterrogationProfile` and `assessProsecution(...).band` deterministically between calls (never letting the LLM invent them) and calling `PleaNarrative` last.

`useCaseSource` resolves a `GameService`-backed source for a vaulted non-demo API key; `WelcomeScreen`'s Continue button drives it through the same `generateCase`/`generateAftermath` seam the demo path uses. The default `npm test` suite for `src/lib/llm/` stubs `fetch` and never calls the real Gemini API; `src/lib/llm/__tests__/live/` does call it, gated behind `npm run test:live` (see Commands section above) — both fixes described in this section were found by running that live suite, not the mocked one.

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
- `App.tsx` renders `AppShell`, the phase router. The full demo docket (five cases — a guided tutorial with bundle-side decision explainers plus the four originals — both plea and trial branches, including per-charge verdicts for the multi-charge case) is implemented; the BYOK/LLM path is implemented via `GameService` (`src/lib/llm/`) and wired live.
- Vite base path is `/the-bench/` (required for GitHub Pages routing).
