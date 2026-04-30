# Finishing Plan — The Bench

## Current State Summary

### What Works (End-to-End)

| Feature | Status | Details |
|---|---|---|
| **Case generation via Gemini** | Working | `service.ts:generateNewCase()` sends prompt, parses JSON with Zod validation |
| **Demo mode** | Working | 2 hand-crafted cases in `demo-cases.ts`, random selection, no API key needed |
| **API key entry** | Working | `ApiKeyForm.tsx` persists to localStorage via Zustand |
| **Arraignment flow** | Working | View defendant, evidence, charges → set bond type/amount/conditions/reasoning → submit ruling |
| **Reputation system (basic)** | Working | Hardcoded logic in `submitArraignmentRuling()`: +/- reputation based on flight risk vs. bail decision |
| **Stage transition** | Working | Arraignment → Pre-Trial stage change on ruling submission |
| **JudicialLayout shell** | Visible | Resizable 3-panel layout (Defendant, Transcript, Case File) renders when stage != "Arraignment" |
| **State persistence** | Working | Zustand + localStorage for apiKey, currentCase, caseHistory, reputation, gameStage |
| **Tests** | Partial | Schema validation tests + game-store tests; no component tests |
| **CI/CD** | Working | GitHub Actions deploys to GitHub Pages on push to master |

### What's Broken / Incomplete

| Area | Problem |
|---|---|
| **TranscriptArea** | Renders `MOCK_TRANSCRIPT` — 5 hardcoded lines. Never reads from `currentCase.transcript`. |
| **MotionTray** | Renders `MOCK_MOTIONS` — 2 hardcoded motions. Never reads from `currentCase.motions`. |
| **MotionReviewDialog** | Grant/Deny buttons just close the dialog. No state mutation, no reasoning capture, no outcome. |
| **CaseFilePanel** | Evidence tab shows items but has no "rule on admissibility" action. Witnesses tab is read-only. |
| **DefendantPanel** | Read-only display. No interaction after arraignment. |
| **Post-arraignment game loop** | After arraignment, the player lands on `JudicialLayout` with no actionable UI — the game is effectively stuck. There is no trial, no verdict, no sentencing, and no way to advance or resolve the case. |
| **Reputation display** | No visible reputation indicator in the JudicialLayout header. `playerReputation` exists in store but is never shown. |
| **"Call to Order" (next case)** | No UI to start a new case after one is resolved. The `gameStage` "scoring" state is defined but never reached. |
| **Appeals system** | Not implemented. Defined in the game design doc but no code exists. |
| **Mistrial** | `is_mistrial` field exists in `GameState` but is never set or checked. |
| **Session scoring** | `gameStage: 'scoring'` is defined but no scoring view or component exists. |
| **Case history** | `caseHistory` accumulates resolved cases but there's no UI to browse them. |

### Game Loop Gap Analysis

The intended game loop (from `.agent/rules/The Bench.md`) is:

```
Arraignment/Bond → Pre-Trial/Plea Hearing → Discovery Hearing → 
Jury Selection (if not bench trial) → Trial → Sentencing Hearing
```

**What actually happens:**
```
Arraignment/Bond → Pre-Trial (stuck — JudicialLayout renders but has no interactive content)
```

The entire second half of the game — pre-trial motions, evidence admissibility rulings, trial proceedings, verdict, and sentencing — is missing. The JudicialLayout is a static display with mock data.

---

## Prioritized Feature List

### MUST-HAVE (game is unplayable without these)

#### M1. Real Transcript System
**Problem:** TranscriptArea renders `MOCK_TRANSCRIPT`. The actual `currentCase.transcript` is never displayed.  
**What to build:**  
- Replace `MOCK_TRANSCRIPT` with data from `useGameStore().currentCase.transcript`
- System entries should auto-generate when stages change (e.g., "Court is now in session for Pre-Trial")
- Format entries by type (testimony, ruling, procedure) with distinct styling
- Auto-scroll to bottom on new entries

**Files to change:**
- `src/components/game/TranscriptArea.tsx` — primary rewrite
- `src/store/game-store.ts` — add `addTranscriptEntry` calls in stage transitions

**Complexity:** Low (2-3 hours)

---

#### M2. Real Motion System
**Problem:** MotionTray renders `MOCK_MOTIONS`. MotionReviewDialog doesn't mutate state.  
**What to build:**  
- Replace `MOCK_MOTIONS` with `currentCase.motions` from the store
- Wire MotionReviewDialog to actually update motion status (Granted/Denied/Modified)
- Add `updateMotion` action to game-store: set status, set `final_ruling_text`
- Add reputation impact to motion rulings (wrong rulings lose reputation)
- Generate motions procedurally via Gemini or from a motion pool (for demo mode)
- Add "Modified" ruling path where judge edits `proposed_order_text`

**Files to change:**
- `src/components/game/MotionTray.tsx` — read from store, remove MOCK
- `src/components/game/MotionReviewDialog.tsx` — wire submit to store
- `src/store/game-store.ts` — add `updateMotion`, `addMotion` actions
- `src/lib/gemini/service.ts` — add `generateMotions()` Gemini call
- `src/lib/gemini/schemas.ts` — add MotionSchema (already partially defined in types)
- `src/data/demo-cases.ts` — add motions to demo cases

**Complexity:** Medium (4-6 hours)

---

#### M3. Evidence Admissibility Rulings
**Problem:** Evidence with `admissibility_status: "Pending"` is shown but can't be ruled on.  
**What to build:**  
- Add "Rule" button on each Pending evidence item in CaseFilePanel
- Open a dialog to hear prosecution/defense arguments (already in data model)
- Judge selects "Admit" or "Suppress" with reasoning
- Update `currentCase.evidence[i].admissibility_status` in store
- Reputation impact for wrong rulings (e.g., suppressing clearly admissible evidence)
- Suppressed evidence becomes unavailable for verdict calculation

**Files to change:**
- `src/components/game/CaseFilePanel.tsx` — add ruling UI on evidence items
- New: `src/components/game/EvidenceRulingDialog.tsx` — ruling dialog
- `src/store/game-store.ts` — add `updateEvidenceStatus` action
- `src/types/game.ts` — no changes needed (types already support this)

**Complexity:** Medium (4-6 hours)

---

#### M4. Trial Phase — Verdict & Sentencing
**Problem:** After arraignment, the game has no progression. There is no way to reach a verdict or sentence.  
**What to build:**  
- **Bench Trial selection**: After pre-trial, decide bench vs. jury trial (jury path can be nice-to-have initially)
- **Trial sequence**: Present prosecution case → defense case → closing arguments (via transcript entries and/or AI-generated narrative)
- **Call for Verdict**: Button in JudicialLayout that opens a verdict form
- **Verdict form**: Find Guilty / Not Guilty per charge with reasoning
- **Sentencing form** (if guilty): Select sentence within min/max range, add conditions
- **Outcome generation**: Call `generateOutcome()` (already exists in `service.ts`) or use local logic for demo mode
- **Case resolution**: Call `resolveCurrentCase()` in store, which moves case to history

**Files to change:**
- New: `src/components/game/VerdictDialog.tsx` — verdict + sentencing form
- New: `src/components/game/TrialPhaseView.tsx` — orchestrates the trial flow
- `src/components/game/JudicialLayout.tsx` — add trial phase controls, reputation display
- `src/store/game-store.ts` — add stage transition logic, `renderVerdict` action
- `src/App.tsx` — add case resolution / "next case" flow
- `src/lib/gemini/service.ts` — `generateOutcome()` exists but needs to be called
- `src/lib/gemini/schemas.ts` — `CaseOutcomeSchema` already exists
- `src/data/demo-cases.ts` — add demo outcomes for demo mode

**Complexity:** High (8-12 hours)

---

#### M5. Case Lifecycle / "Next Case" Flow
**Problem:** After resolving a case, there's no way to start the next one or see results.  
**What to build:**  
- After verdict, show a **Case Outcome Summary** card with: verdict, sentence, public reaction, reputation change
- "Adjudicate Next Case" button that generates a new case (Gemini or demo)
- Transition `gameStage` to `'scoring'` → show summary → `'active'` for next case
- If reputation hits 0, show "Career Over" ending
- "Resign" button to voluntarily end the session

**Files to change:**
- New: `src/components/game/CaseOutcomeCard.tsx` — outcome summary
- New: `src/components/game/GameOverView.tsx` — career end / resign
- `src/App.tsx` — add outcome → next case flow
- `src/store/game-store.ts` — add `resetForNewCase` action, game-over detection

**Complexity:** Medium (4-6 hours)

---

#### M6. Reputation Display
**Problem:** `playerReputation` is in the store but never shown to the player.  
**What to build:**  
- Add reputation bar/number to JudicialLayout header
- Visual indicator (color-coded: green → yellow → red)
- Animate reputation changes
- Show reputation in arraignment view too
- Show "Career Over" when reputation = 0

**Files to change:**
- `src/components/game/JudicialLayout.tsx` — add reputation display to header
- `src/components/game/ArraignmentView.tsx` — add reputation display
- New: `src/components/game/ReputationBar.tsx` — reusable reputation indicator

**Complexity:** Low (1-2 hours)

---

### NICE-TO-HAVE (enhances experience but game is functional without)

#### N1. Jury Trial / Voir Dire
**Description:** Let the player choose bench vs. jury trial. Jury path includes voir dire (questioning potential jurors, sustaining/overrlying challenges).  
**Complexity:** High (8-12 hours) — requires jury pool data model, voir dire UI, juror selection, and different verdict mechanics.

#### N2. Appeals System
**Description:** After rulings, there's a chance (higher with lower reputation) that an AI "appeals judge" reviews. Overruled decisions lose reputation. Enough appeals = mistrial.  
**Complexity:** High (6-8 hours) — requires AI prompt for appeal review, appeal probability calculation, appeals UI, mistrial handling.

#### N3. Session Summary Scoring
**Description:** When the player resigns or hits 0 reputation, an AI scorer reviews all cases and produces a detailed breakdown: Efficiency, Legal Compliance, Public Trust, Case Outcome Fairness.  
**Complexity:** Medium (4-6 hours) — requires new Gemini prompt, scoring UI, and aggregated case analysis.

#### N4. Case History Browser
**Description:** View past cases with their outcomes, your rulings, and outcome details.  
**Complexity:** Low (2-3 hours) — `caseHistory` already exists in store, just needs a UI panel.

#### N5. Dark Mode Toggle
**Description:** CSS variables for dark mode already exist in `index.css`. Add a toggle in the header.  
**Complexity:** Low (1-2 hours) — just add a toggle that sets `class="dark"` on `<html>` and persists preference.

#### N6. Pre-Trial / Discovery Hearings as Distinct Stages
**Description:** The design doc calls for separate Pre-Trial/Plea and Discovery stages. Currently, pre-trial is just a label with no distinct gameplay.  
**Complexity:** Medium (4-6 hours) — adds plea bargaining UI, discovery dispute resolution.

#### N7. Narrative Events
**Description:** The design doc mentions media scrutiny, attorney misconduct, and court staff interactions as random events during the case.  
**Complexity:** Medium (3-5 hours) — requires event generation, event UI (toasts or dialog), and reputation effects.

#### N8. Leaderboard / Persistent High Scores
**Description:** Save sessions with scores, allowing players to compare across sessions.  
**Complexity:** Medium (3-4 hours) — requires local storage schema, sorting, and UI.

---

## Implementation Order

The recommended build sequence, based on dependencies:

```
Phase 1 — Make the game playable end-to-end (M6 → M1 → M2 → M3 → M4 → M5)
Phase 2 — Polish and enrichment (N4 → N5 → N6 → N7 → N3 → N1 → N2 → N8)
```

**Rationale:**
1. **M6 (Reputation Display)** first because it's trivial and gives immediate visual feedback
2. **M1 (Transcript)** and **M2 (Motions)** next because they replace mock data with real data in the existing JudicialLayout
3. **M3 (Evidence Admissibility)** builds on the now-real CaseFilePanel
4. **M4 (Trial/Verdict/Sentencing)** is the critical missing piece — without it the game has no ending
5. **M5 (Case Lifecycle)** closes the loop so the player can actually play multiple cases

---

## Detailed File Change Map

| File | Changes Required |
|---|---|
| `src/types/game.ts` | Add `TrialPhase` type, `VerdictRuling` interface, `SentencingRuling` interface, `AppealResult` interface |
| `src/store/game-store.ts` | Add: `updateMotion`, `addMotion`, `updateEvidenceStatus`, `renderVerdict`, `resetForNewCase`, `triggerAppeal`. Modify: `submitArraignmentRuling` should add transcript entries. Add `gameStage` sub-states for trial phases. |
| `src/lib/gemini/schemas.ts` | Add: `MotionSchema`, `VerdictSchema`, `SentencingSchema`, `AppealResultSchema`. Fix: `CourtCaseSchema` is missing `motions` and `arraignment_ruling` fields (present in TS type but not in Zod schema). |
| `src/lib/gemini/service.ts` | Add: `generateMotions()`, `generateAppealResult()`. Modify: `generateOutcome()` to accept richer input (evidence rulings, motion rulings, verdict, sentence). |
| `src/lib/gemini/client.ts` | No changes needed (factory function is clean). |
| `src/data/demo-cases.ts` | Add `motions` arrays to both demo cases. Add demo outcomes for verdict path. |
| `src/App.tsx` | Add: case outcome view, "next case" flow, game-over redirect. Fix: Remove max-width constraint from `App.css` that constrains JudicialLayout. |
| `src/components/game/TranscriptArea.tsx` | Full rewrite: read from store, display real entries, auto-scroll, add entry type badges |
| `src/components/game/MotionTray.tsx` | Rewrite: read from store, remove MOCK, show real count, handle empty state |
| `src/components/game/MotionReviewDialog.tsx` | Rewrite: wire Grant/Deny/Modify to store, capture reasoning, update motion status |
| `src/components/game/CaseFilePanel.tsx` | Add: "Rule" button on Pending evidence, jury/bench trial toggle |
| `src/components/game/DefendantPanel.tsx` | Minor: show arraignment_ruling status, bond conditions |
| `src/components/game/ArraignmentView.tsx` | Add: reputation display |
| `src/components/game/JudicialLayout.tsx` | Add: reputation bar in header, trial phase controls, "Call for Verdict" button, stage indicator |
| `src/components/game/ArraignmentControls.tsx` | Minor: after submit, auto-add transcript entries |
| New files | `EvidenceRulingDialog.tsx`, `VerdictDialog.tsx`, `TrialPhaseView.tsx`, `CaseOutcomeCard.tsx`, `ReputationBar.tsx`, `GameOverView.tsx` |
| `src/App.css` | Remove or replace Vite boilerplate (max-width, logo styles). JudicialLayout needs full-screen. |
| `src/index.css` | Already has dark mode variables. No changes needed for N5. |
| `tailwind.config.js` | No changes needed. |
| `README.md` | Update roadmap checkboxes as features are completed. |

---

## Critical Bugs / Issues Found

1. **CourtCaseSchema missing fields**: `schemas.ts:CourtCaseSchema` does not include `motions` or `arraignment_ruling`. If Gemini returns these fields, Zod strips them. If the app sets them (via `submitArraignmentRuling`), they persist in Zustand but won't validate if re-parsed through the schema.
2. **App.css max-width constraint**: `#root { max-width: 1280px; margin: 0 auto; padding: 2rem; }` constrains the JudicialLayout which needs full-screen. This CSS is leftover Vite boilerplate.
3. **Demo mode doesn't generate motions**: Demo cases have empty `motions: []` arrays. When the motion tray is switched to real data, demo mode will show an empty tray.
4. **`generateOutcome` is never called**: The function exists in `service.ts` but no component or store action invokes it.
5. **No error boundary**: A bad Gemini response crashes the app. There's no React error boundary to catch and recover.
6. **Reputation never decreases after arraignment**: The only reputation change happens in `submitArraignmentRuling`. There's no mechanism for reputation loss from bad rulings during trial.
7. **`addTranscriptEntry` is defined but never called**: The store action exists but nothing writes transcript entries during gameplay.

---

## Estimated Total Effort

| Phase | Features | Estimated Hours |
|---|---|---|
| Phase 1 (Must-Have) | M6, M1, M2, M3, M4, M5 | 23-35 hours |
| Phase 2 (Nice-to-Have) | N4, N5, N6, N7, N3, N1, N2, N8 | 28-46 hours |
| **Total** | | **51-81 hours** |

---

## Architecture Notes for Developers

### State Management Pattern
All game state flows through `useGameStore` (Zustand). Components read via selectors and call actions to mutate. The store is the single source of truth. Any new feature should:
1. Add types to `src/types/game.ts`
2. Add Zod schemas to `src/lib/gemini/schemas.ts` (keep in sync with types!)
3. Add store actions to `src/store/game-store.ts`
4. Add Gemini service calls to `src/lib/gemini/service.ts` if AI generation is needed
5. Add demo data to `src/data/demo-cases.ts` for offline play
6. Build UI components in `src/components/game/`

### AI Integration Pattern
- User provides their own Gemini API key (stored in localStorage)
- Demo mode skips all AI calls (`isDemoMode` flag in store)
- Every AI call should have a demo-mode fallback (hardcoded data)
- Zod validates every AI response before it enters the store
- The Gemini model is `gemini-2.0-flash` (configured in `client.ts`)

### Component Pattern
- shadcn/ui components in `src/components/ui/` (don't modify these)
- Game components in `src/components/game/` (these are the app-specific ones)
- Use `cn()` from `src/lib/utils.ts` for conditional classnames
- Use `useToast()` for user feedback on actions
- Follow the existing prop-drilling + store hook pattern

### Key Design Principle from Game Doc
> "A lower reputation will increase the frequency of attorney challenges and the rate of appeals being granted. Every time a decision is overruled, the player's reputation lowers and their score drops. Too many appeals within the same case causes a mistrial."

This is the core tension loop that makes the game interesting. Every feature added should reinforce the relationship between: **judicial decisions → reputation → difficulty escalation**.