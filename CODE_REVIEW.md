# Code Review — The Bench

**Reviewer:** opencode/glm-5.1  
**Date:** 2026-05-01  
**Scope:** Full codebase audit against AGENTS.md contract  

---

## Summary

The codebase has made solid progress since FINISHING_PLAN.md was written. M1 (transcript), M2 (motions), M3 (evidence), and M5 (verdict/sentencing) are functionally implemented in the store and UI. However, several contract violations, logic bugs, type safety gaps, and architectural inconsistencies remain. The most urgent issues are: **dual stage tracking** (gameStage vs game_state.current_stage), **missing ResolvedCase type**, **no session case counter**, and **verdict reputation logic that contradicts the contract**.

---

## CRITICAL

### C1. Dual Stage Tracking — Inconsistent Source of Truth
- **File:** `src/store/game-store.ts` (lines 21, 290, 339) + `src/App.tsx` (line 49)
- **Problem:** Two parallel stage systems exist: `gameStage` (top-level store field) and `currentCase.game_state.current_stage` (nested in CourtCase). They are updated independently and can diverge. `App.tsx:49` routes based on `currentCase.game_state.current_stage`, but `submitVerdict` and `submitSentence` also set `gameStage` at the top level. No single canonical source of truth.
- **Fix:** Pick one. The AGENTS.md contract defines `gameStage` at the `GameSession` level (line 65). The `game_state.current_stage` field in `CourtCase` is the AI/case-level field. They should be kept in sync — every mutation that changes one should change the other. Better: derive `gameStage` from `currentCase.game_state.current_stage` when a case is active, and use `gameStage` only for `landing`/`gameover`/`outcome` (case-independent states).
- **Impact:** Player can get stuck if stages diverge. This is the root cause of the "game gets stuck after arraignment" bug if `gameStage` says one thing and `current_stage` says another.

### C2. Missing `ResolvedCase` Type — Store Violates Contract
- **File:** `src/types/game.ts`, `src/store/game-store.ts:18`
- **Problem:** AGENTS.md (line 63) defines `caseHistory: ResolvedCase[]`. The codebase uses `caseHistory: CourtCase[]` instead. `ResolvedCase` is never defined. A resolved case should have a different shape than an active case (e.g., guaranteed `outcome`, `verdict_rulings`, `sentence_ruling`).
- **Fix:** Define `ResolvedCase` interface in `game.ts` with required `outcome`, `verdict_rulings`, `sentence_ruling`. Add Zod schema. Update `caseHistory` type in store. Use type narrowing: `resolveCurrentCase` should return `ResolvedCase`, not just spread `CourtCase`.

### C3. Missing `sessionCaseCount` — No Case Count Tracking
- **File:** `src/store/game-store.ts`
- **Problem:** AGENTS.md (line 66) requires `sessionCaseCount: number` (0-5). It's not in the store at all. Without it, M6 cannot implement the "5 cases max per session" rule or "opt-out after any case."
- **Fix:** Add `sessionCaseCount: number` (default 0) to store state. Increment in `resolveCurrentCase`. Reset on new session. Persist in `partialize`. Use in M6 for session termination.

### C4. Verdict Reputation Logic Contradicts Contract
- **File:** `src/store/game-store.ts:264-268`
- **Problem:** The verdict reputation logic always rewards "Guilty" and always penalizes "Not Guilty," regardless of evidence strength. AGENTS.md (§9.1) says correct/wrong depends on whether the verdict "matches facts." The current code treats Guilty as universally correct, which means a judge who lets a clearly innocent person go free loses 10-15 reputation — punishing the player for a just ruling.
- **Fix:** Verdict reputation must be evidence-aware. Either: (a) AI generates a "correct_verdict" per charge (in live mode), or (b) use admitted evidence strength ratios to determine if Guilty/Not Guilty is the "correct" ruling. Demo mode needs deterministic logic. This is a design decision that should be resolved before M6.

### C5. `generateOutcomeWithFallback` Is Synchronous — Breaks AI Call Pattern
- **File:** `src/lib/gemini/service.ts:17-22`
- **Problem:** The function is synchronous but the live mode requires an async Gemini call. It throws an error instead of providing the live path. This violates the mandatory AI call pattern in AGENTS.md (§4, lines 90-97). Also, `generateOutcome` at line 62 exists as a separate async function but is never called from any component.
- **Fix:** Unify into a single `async function generateOutcome(caseData, isDemoMode, apiKey)` that follows the pattern: demo fallback → Gemini call → Zod parse. Delete the sync wrapper. Wire `generateOutcome` into the sentencing/outcome flow.

### C6. `CourtCaseSchema` Omits `arraignment_ruling` — Zod Strips It
- **File:** `src/lib/gemini/schemas.ts:82-100`
- **Problem:** `CourtCaseSchema` does not include `arraignment_ruling`. Per AGENTS.md rule (§4, line 55): "if you add a field to a type, you MUST add it to the Zod schema." The field exists in the TS type (`game.ts:78`) but not in the Zod schema. If you ever re-validate store state through the schema, the ruling gets stripped.
- **Fix:** Add `arraignment_ruling: ArraignmentRulingSchema.optional()` to `CourtCaseSchema`. Define `ArraignmentRulingSchema` (it doesn't exist yet).

### C7. `ArraignmentRulingSchema` Missing from Zod
- **File:** `src/lib/gemini/schemas.ts`
- **Problem:** `ArraignmentRuling` is a key type (used in store, in demo data) but has no Zod schema. This means AI-generated arraignment rulings cannot be validated.
- **Fix:** Add `ArraignmentRulingSchema` mirroring the TS interface, including `bailType` enum validation.

---

## WARNING

### W1. `updateReputation` Allows Exceeding 100 — No Cap
- **File:** `src/store/game-store.ts:377-379`
- **Problem:** `updateReputation` caps at 0 but has no upper cap. A caller could push reputation above 100. Test at line 207 proves this: `updateReputation(20)` from 90 gives 110. Other store actions (`ruleMotion`, `ruleEvidence`, etc.) correctly cap at 100.
- **Fix:** Add `Math.min(100, ...)` to `updateReputation`, consistent with all other reputation mutations.

### W2. Evidence Can Be Re-Ruled After Stage Advance
- **File:** `src/store/game-store.ts:182-239`
- **Problem:** Test line 387-394 proves you can re-rule already-ruled evidence. This means a player could rule evidence "Admitted," advance to Verdict, then go back and change it to "Suppressed." The store allows it, and `CaseFilePanel` shows "Rule" only for Pending items, but there's no store-level guard.
- **Fix:** Add a guard in `ruleEvidence`: if `evidenceItem.admissibility_status !== 'Pending'`, return early (no-op). Or at minimum, if the stage has already advanced past Evidence, prevent re-ruling.

### W3. Motion Tray Shows During Evidence and Verdict Stages
- **File:** `src/components/game/JudicialLayout.tsx:94`
- **Problem:** The `MotionTray` is always rendered in the bottom panel of the resizable layout, even during Evidence, Verdict, and Sentencing stages. During Evidence stage the motions are all ruled upon; during Verdict/Sentencing the motions tray takes up space with no actionable content.
- **Fix:** Conditionally render the bottom panel: show `MotionTray` during Motions stage, show evidence summary during Evidence stage, hide it entirely during Verdict/Sentencing (which use full-screen views anyway).

### W4. `gameStage` Not Updated on Motion/Evidence Stage Advance
- **File:** `src/store/game-store.ts:125-180, 182-239`
- **Problem:** `ruleMotion` and `ruleEvidence` update `currentCase.game_state.current_stage` but never update the top-level `gameStage`. This means `useGameStore().gameStage` remains stale (e.g., stays `'motions'` even after all motions are ruled and stage advances to `Evidence`). App.tsx routing uses `currentCase.game_state.current_stage`, so it works, but any consumer of `gameStage` gets wrong values.
- **Fix:** After auto-advancing stage in `ruleMotion` and `ruleEvidence`, also set `gameStage` to match. Example: `setGameStage('evidence')` when all motions ruled.

### W5. Demo Cases Have Evidence Pre-Admitted
- **File:** `src/data/demo-cases.ts:42, 48, 161, 169`
- **Problem:** Demo case 1 has evidence E-001 and E-002 with `admissibility_status: "Admitted"`. Demo case 2 has E-001 and E-002 as `"Admitted"`. Only E-003/E-004 are `"Pending"`. This means when a demo player reaches the Evidence stage, they only need to rule on 1-2 items instead of all evidence. This isn't necessarily wrong, but it means the evidence stage is abnormally short in demo mode.
- **Fix:** Either reset all demo evidence to `"Pending"` for a fuller experience, or document this as intentional so the demo flow is understood.

### W6. `SentencingForm` Slider Can Be 0 on Mount
- **File:** `src/components/game/SentencingForm.tsx:17, 48`
- **Problem:** `months` state initializes to `0`, then `initializedMonths` falls back to `minMonths` only when months is 0 (line 48). But if the user drags the slider to a value and then it re-renders, `initializedMonths` uses the slider value. The guard `initializedMonths >= minMonths` on line 58 means a form that hasn't been touched passes validation with `minMonths`... but the underlying `months` state is `0`. If `handleSubmit` is called before the slider is touched, `submitSentence({ months: 0, ... })` is sent (line 61 uses `initializedMonths`, not `months` — actually this is correct). But if `months` is ever read directly, it's wrong.
- **Fix:** Initialize `months` state to `minMonths`: `const [months, setMonths] = useState(minMonths)`. But `minMonths` isn't known at component top. Use `useEffect` to set default, or compute from currents.

### W7. `generateNewCase` Prompt Missing `severity` on Charges
- **File:** `src/lib/gemini/service.ts:36`
- **Problem:** The Gemini prompt for case generation does not ask for `severity` field on charges. The `ChargeSchema` has `severity` as optional, and the store uses `charge.severity || 'Med'` as a fallback (line 261). This means AI-generated cases may not have severity, causing verdict reputation to always use "Med" defaults.
- **Fix:** Add `"severity": "Low" | "Med" | "High"` to the charge schema in the prompt, with instruction to provide mixed values.

### W8. `ArraignmentRuling.bailType` Is Optional — Store Assumes It
- **File:** `src/types/game.ts:94`, `src/store/game-store.ts:83-88`
- **Problem:** `bailType` is `bailType?: "ROR" | "Cash" | "Remand"` (optional). But `submitArraignmentRuling` at line 83 does `ruling.bailType === "ROR"` — if `bailType` is undefined, this fails silently (treated as wrong type). The ArraignmentControls form always sets it, so this works in practice, but a test or API could submit a ruling without bailType.
- **Fix:** Make `bailType` required in `ArraignmentRuling`. It's always set by the UI and is semantically required for a ruling.

### W9. `gameover` Stage Value Mismatch
- **File:** `src/store/game-store.ts:286, 335, 339`
- **Problem:** `submitVerdict` sets `currentCase.game_state.current_stage = 'gameover'` and `gameStage = 'gameover'`. But `game_state.current_stage` is typed as `string` in both the TS type and Zod schema (not an enum). The valid stages for `current_stage` are like "Arraignment", "Pre-Trial", "Motions", "Evidence", "Verdict", "Sentencing", "Outcome" — courtroom stages. "gameover" is a session-level state, not a courtroom stage. Setting it on `current_stage` is a category error.
- **Fix:** When reputation hits 0, set `gameStage = 'gameover'` but leave `current_stage` at whatever courtroom stage it was at. The `gameStage` enum already includes `'gameover'`.

---

## SUGGESTION

### S1. Duplicate Reputation Logic — ArraignmentControls Mirrors Store
- **File:** `src/components/game/ArraignmentControls.tsx:42-53` vs `src/store/game-store.ts:80-91`
- **Problem:** The reputation calculation logic for arraignment is duplicated between the component (for toast display) and the store (for actual mutation). If the store logic changes, the toast will show wrong values.
- **Fix:** Have `submitArraignmentRuling` return the reputation delta, or expose a `getLastReputationChange()` selector, or compute it from `playerReputation` diff in a `useEffect`.

### S2. Duplicate Reputation Calculation — EvidenceRulingDialog
- **File:** `src/components/game/EvidenceRulingDialog.tsx:72-77` vs `src/store/game-store.ts:196-202`
- **Problem:** Same issue — `calculateImpact` in the dialog duplicates the store's evidence reputation logic.
- **Fix:** Same as S1. Centralize the reputation calculation and expose it.

### S3. Duplicate `generateOutcome` Functions
- **File:** `src/lib/gemini/service.ts:5-15, 17-22, 62-92`
- **Problem:** Three functions exist for outcome generation: `generateDemoOutcome`, `generateOutcomeWithFallback`, and `generateOutcome`. The sync wrapper throws. The demo function is fine. The async one is never called.
- **Fix:** Consolidate into one async function with demo fallback per the mandatory pattern.

### S4. `TranscriptEntry` Zod Schema Is Inline
- **File:** `src/lib/gemini/schemas.ts:89-95`
- **Problem:** The transcript entry schema is defined inline as `z.object({...})` inside `CourtCaseSchema` instead of as a named export. This makes it unreusable and untestable.
- **Fix:** Extract as `export const TranscriptEntrySchema = z.object({...})` and reference it in `CourtCaseSchema`.

### S5. App.css Is Vite Boilerplate — Should Be Cleaned
- **File:** `src/App.css`
- **Problem:** Contains Vite boilerplate (`.logo`, `@keyframes logo-spin`, `.read-the-docs`). The `#root { max-width: 1280px }` constraint breaks `JudicialLayout`'s full-screen needs. AGENTS.md notes this in §7 ("App.css max-width rule will be removed in M6").
- **Fix:** Remove the `#root` max-width/padding/text-align rules and all leftover Vite boilerplate.

### S6. `setCaseStage` Accepts `string` — Too Permissive
- **File:** `src/store/game-store.ts:33, 353-375`
- **Problem:** `setCaseStage(stage: string)` accepts any string. `setGameStage` uses the union type. `setCaseStage` should use the same constrained type.
- **Fix:** Type `setCaseStage` parameter as the union of valid courtroom stages.

### S7. No `ArraignmentRulingSchema` for Zod
- **File:** `src/lib/gemini/schemas.ts`
- **Problem:** Listed in C7 (critical), but even as a suggestion: the `TranscriptEntrySchema` should also be a named export for reuse. And `ArraignmentRuling` needs a Zod schema for any AI-generated arraignment to validate.

### S8. No Component Tests
- **Problem:** Zero component tests exist. All 35 tests are store actions + Zod schemas. Given the complexity of `JudicialLayout` stage routing, `EvidenceRulingDialog`, `MotionReviewDialog`, and `VerdictForm`, regressions are likely.
- **Fix:** Add at minimum integration tests for: (1) Arraignment flow → stage transitions, (2) Motion ruling → evidence stage, (3) Verdict → sentencing → outcome. Use React Testing Library.

### S9. `generateOutcome` Leaks Case Data to AI Prompt
- **File:** `src/lib/gemini/service.ts:69`
- **Problem:** `Case Data: ${JSON.stringify(caseData)}` serializes the entire CourtCase (including internal `merit` flags on motions) into the AI prompt. This leaks game-internal data (like which motions have `merit: true/false`) to the AI, which could echo it back.
- **Fix:** Sanitize the prompt input. Send only case metadata, public-facing evidence, verdict, and sentence — not internal game flags like `merit`.

### S10. No Error Boundary
- **Problem:** FINISHING_PLAN.md notes this (item 5). A bad Gemini response or Zod parse failure can crash the entire app. No React error boundary exists.
- **Fix:** Add an error boundary component wrapping the main content. Catch Zod errors and display a "bad case data" recovery UI.

### S11. `is_mistrial` and `defense_attorney_aggression` Are Never Used
- **File:** `src/types/game.ts:62-68`
- **Problem:** `is_mistrial` is never set to `true` anywhere. `defense_attorney_aggression` and `prosecutor_competence` are set in demo data but never read by any logic. These are dead fields that add complexity.
- **Fix:** Either implement the reputation-difficulty loop (§9 of FINISHING_PLAN: "lower reputation increases the frequency of attorney challenges") or remove these fields from the contract to avoid confusion.

### S12. No `resetForNewCase` / `startNextCase` Action
- **File:** `src/store/game-store.ts`
- **Problem:** There's no store action to prepare for a new case within the same session. `resolveCurrentCase` clears `currentCase` and pushes to `caseHistory`, but doesn't reset stage to `'landing'` or `'arraignment'` for the next case. M6 will need this.
- **Fix:** Add `startNextCase(): void` that sets `gameStage: 'landing'`, increments `sessionCaseCount`, and clears `currentCase` for the next case load.

---

## M6 READINESS CHECKLIST

Before M6 (Next Case Flow + Game Over) can be implemented, these prerequisites must be in place:

| # | Prerequisite | Status | Blocking Issue |
|---|---|---|---|
| 1 | `sessionCaseCount` in store | **MISSING** | C3 — no case counter |
| 2 | `ResolvedCase` type defined | **MISSING** | C2 — `caseHistory` uses `CourtCase[]` |
| 3 | `startNextCase` / `resetForNewCase` action | **MISSING** | S12 — no way to transition to next case |
| 4 | Dual stage tracking resolved | **BROKEN** | C1 — `gameStage` and `current_stage` can diverge |
| 5 | `generateOutcome` called after sentencing | **NOT WIRED** | C5 — async outcome generation never called |
| 6 | `gameover` detection works | **PARTIAL** | W9 — sets wrong field, but `gameStage` is correct |
| 7 | Session score formula implemented | **MISSING** | AGENTS.md §9.2 defines formula, no code exists |
| 8 | `caseHistory` has guaranteed `outcome` | **MISSING** | C2 — `outcome` is optional on `CourtCase` |
| 9 | "Adjudicate Next Case?" opt-out UI | **MISSING** | No such component or store action |
| 10 | App.css max-width removed | **PENDING** | S5 — blocks full-screen M6 layout |
| 11 | GameOver view component | **MISSING** | No `GameOverView` exists |
| 12 | OutcomeCard / summary component | **MISSING** | No `CaseOutcomeCard` exists |

---

## TYPE SAFETY SUMMARY

| Issue | File | Severity |
|---|---|---|
| No `ResolvedCase` type | `game.ts`, `game-store.ts` | CRITICAL |
| `ArraignmentRulingSchema` missing from Zod | `schemas.ts` | CRITICAL |
| `CourtCaseSchema` missing `arraignment_ruling` | `schemas.ts` | CRITICAL |
| `bailType` is optional when it shouldn't be | `game.ts:94` | WARNING |
| `setCaseStage` accepts unconstrained `string` | `game-store.ts:33` | SUGGESTION |
| `as CourtCase` / `as CaseOutcome` after `Schema.parse` | `service.ts:55,87` | SUGGESTION |
| `game_state.current_stage` is untyped `string` | `game.ts:62` | SUGGESTION |
| No `TranscriptEntrySchema` named export | `schemas.ts` | SUGGESTION |

**Note on `as CourtCase` after `.parse()`:** The Zod `.parse()` return type is `z.infer<typeof CourtCaseSchema>` which is structurally identical to `CourtCase`. The `as` cast is safe but redundant. If schemas and types stay in sync, the cast can be removed by typing the return as `z.infer<typeof CourtCaseSchema>` or keeping the type alias aligned.

---

## TEST COVERAGE SUMMARY

| Area | Tests | Coverage | Gaps |
|---|---|---|---|
| Store: arraignment | 3 | Good | Missing: negative bail amount edge case |
| Store: motions | 4 | Good | Missing: `Modified` ruling reputation calc |
| Store: evidence | 9 | Good | Missing: invalid `ruling` param guard |
| Store: verdict | 4 | Good | Missing: mixed verdicts (some Guilty, some Not) |
| Store: sentencing | 3 | Good | Missing: sentence above max range |
| Store: `resolveCurrentCase` | 1 | OK | Missing: resolves without outcome |
| Store: `updateReputation` | 2 | **FAILING** | Test expects 110 (no cap) — should cap at 100 |
| Zod schemas | 3 | Minimal | Missing: `ArraignmentRulingSchema`, `MotionSchema` standalone, invalid enums |
| Components | 0 | **NONE** | Critical gap for M6 |
| Service layer | 0 | **NONE** | `generateOutcome` never tested |
| Session lifecycle | 0 | **NONE** | Multi-case flow untested |

**Critical test bug:** `game-store.test.ts:206-207` asserts `updateReputation(20)` from 90 gives 110. This contradicts the contract (reputation is 0-100). The test passes because the store has no upper cap (W1), but both the test and the store are wrong per the contract.

---

## ARCHITECTURE COMPLIANCE (vs AGENTS.md)

| Contract Rule | Status |
|---|---|
| Single source of truth: `game.ts` | PARTIAL — `ResolvedCase` missing |
| Zod schemas match types | **VIOLATED** — `arraignment_ruling` missing, `ArraignmentRulingSchema` missing |
| AI call pattern (demo fallback → Gemini → Zod) | **VIOLATED** — `generateOutcomeWithFallback` is sync, throws for live mode |
| Every AI call needs `isDemoMode` fallback | **VIOLATED** — `generateOutcome` has no demo path |
| `sessionCaseCount` in `GameSession` | **MISSING** |
| `caseHistory: ResolvedCase[]` | **MISSING** — uses `CourtCase[]` |
| `5 cases max per session` | **NOT IMPLEMENTED** |
| `Opt-out after any case` | **NOT IMPLEMENTED** |
| `Game over if reputation hits 0` | **PARTIAL** — detected in verdict/sentencing but not in motions/evidence |
| Don't modify `src/components/ui/` | **COMPLIED** |
| One feature per branch | Not verifiable from code |
| Every new type needs Zod schema | **VIOLATED** for `ArraignmentRuling` |

---

## PRIORITY FIX ORDER

1. **C1** — Fix dual stage tracking (routing bugs)
2. **C3** — Add `sessionCaseCount` (blocks M6)
3. **C2** — Define `ResolvedCase` (blocks M6)
4. **C4** — Fix verdict reputation logic (wrong behavior)
5. **C6/C7** — Add Zod schemas for `arraignment_ruling` and `ArraignmentRuling`
6. **C5** — Unify outcome generation (blocks M6)
7. **W1** — Cap `updateReputation` at 100 + fix test
8. **W4** — Sync `gameStage` with auto-stage-advances
9. **W9** — Don't set `gameover` on `current_stage`
10. Everything else (warnings and suggestions)