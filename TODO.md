# TODO

## ACTIVE: Beat-by-beat courtroom loop redesign (2026-07-16)

The static form-dump loop is being replaced by a click-to-advance courtroom
where the case unfolds one statement at a time. Full plan:
`~/.claude/plans/ok-let-s-try-that-lively-koala.md`. Core design: one derived
script (`src/lib/courtroomScript.ts`, prefix-stable, no-spoilers truncation at
the first unresolved decision) revealed by a `beatCursor` in `useUIStore`;
decisions still commit through the game store's validated actions.

- [x] **Commit 1 (`a62469c`)** — schema extensions (`prosecutionArgument`/
      `defenseObjection` on Evidence keyed to objectionRisk, `direct`/
      `crossExamination` on Witness, `closingArguments` on Case, `allocution`
      on PleaNarrative w/ defineDemoCase pairing rule) + all four demo cases
      re-authored with voiced beats.
- [x] **Commit 2 (`fbd13d8`)** — `buildCourtroomScript` beat projection
      (STATEMENT/DECISION union) + tests incl. prefix-stability playthroughs
      of the whole docket. buildLedger untouched.
- [x] **Commit 3 (`f503c6d`)** — incremental `chargeVerdicts[]` +
      `addChargeVerdict` (upsert, ACT_3-gated); `addMotionRuling` phase-gated.
- [x] **Commit 4** — beat-by-beat UI: `beatCursor` in useUIStore (advance /
      forward-only setBeatCursor / reset), `useCourtroomScript` hook, Ledger
      reveal + auto-scroll + `beat-in` animation (reduced-motion guarded),
      ActionBar switches on pendingBeat (Continue w/ skip-to-next-decision,
      PleaRuling, MotionRuling, ChargeVerdict, Sentencing controls); the four
      old act forms + buildLedger + useLedgerEntries deleted; cursor resets
      wired into WelcomeScreen and ResultActions. NOT yet verified in-browser
      (that's Commit 5's driver rewrite).
- [x] **Commit 5 (`d426293`)** — run-the-bench driver rewritten for the beat
      flow (advanceTo helper, per-exhibit/per-charge interactions, skip
      exercised on Reyes, allocution/waiver/testimony assertions). Verified:
      ALL CHECKS PASSED, clean console, desktop + mobile.
- [x] **Commit 6** — docs synced (CLAUDE.md courtroom-script section +
      beatCursor + schema additions; README beat-loop status + chart).
- [ ] **Push** — after final review: run tests on all commits, check unstaged
      changes, quality review, push (user instruction 2026-07-16).

---

Status of the "First UI Layer" plan (side panels, popups, ledger, action bar).
Phases 0–4 are **done and verified**: the full demo docket is playable end-to-end
(WELCOME → select a case → Act 1 → [Act 2] → Act 3 → END_STATE) on both the
accepted-plea and forced-trial branches, at desktop (1280px) and mobile (375px)
widths, with clean consoles. Verified via headless-Chromium playthroughs against
`npm run dev` (Playwright installed in /tmp, not a project dependency).

## Remaining plan items (Phase 5 — polish & docs)

- [x] **OceanTraitsMeter** — done: five meter-style bars (accent fill,
      same-ramp track, `role="meter"`, direct-labeled values) in
      `src/components/common/OceanTraitsMeter.tsx`.
- [x] **CLAUDE.md docs** — done: `useUIStore` documented as the third isolated
      slice; `activePleaNarrative` documented under the state machine; stale
      `App.tsx` scaffold note refreshed.
- [x] **Polish pass** — done. Headless playthrough later found the REAL cause
      of the "low-contrast button label" report: the element resets in
      `index.css` were unlayered, so they beat every Tailwind utility —
      `button { color: inherit }` was defeating `text-(--bg)` on accent
      buttons (~1.5:1 rendered). Resets now live in `@layer base`; utilities
      win; verified in-browser at 6.77:1.
      Original token math: the "Play Demo Case" pair
      (`--bg` on `--accent`) is 6.77:1 — passes WCAG AA, no change needed.
      Real finding: `--text-muted` was 3.15:1 on `--bg-elevated`; bumped
      `#6b7280` → `#8790a0` (≥4.5:1 on all three surfaces). Also added the
      missing `min-h-11` touch target on CaseFilePanel's Scene button and
      removed `focus:outline-none` from the two inputs so the global keyboard
      `:focus-visible` outline is no longer suppressed.
- [x] **Sentencing guidelines in ChargeDetailModal** — done. Ranges moved to
      per-charge (`ChargeSchema.mandatoryMinimums`/`maximumPenalties` are the
      source of truth; case-level exposure is derived deterministically by
      `deriveSentencingExposure` in `src/lib/sentencingExposure.ts`), and the
      modal now shows each charge's lawful range via `SentenceList`.
- [x] **Ledger speaker attribution** — done (user note 2026-07-03: the ledger
      should be narrated by the parties, not an omniscient voice). Every
      `LedgerEntry` now carries a `speaker` (`CLERK`/`PROSECUTION`/`DEFENSE`/
      `COURT`/`PRESS`); the plea offer and response read as the attorneys'
      own presentations, court entries are the player's rulings, and
      `LedgerEntryRow` displays the attribution.
- [x] **README update & review** — done. Both Mermaid charts updated (UIStore
      as third slice; deterministic-derivations subgraph showing
      `buildPleaPosture`, `deriveSentencingExposure`, and
      `sentencingModifierFromRulings` feeding the acts) and the Status section
      reflects the playable demo + next steps. The original written
      introduction ("Why This Exists") is untouched.

## UI defects (player-perspective responsive sweep, 2026-07-15)

Findings from a subagent-driven Playwright sweep (full docket via
`run-the-bench` driver — all 24 checks passed, console clean — plus a
Webb trial walkthrough screenshotted at 390/820/1440px). Phone and desktop
render correctly; no horizontal overflow or console errors anywhere. One
genuine defect:

- [ ] **Tablet band (~768–1000px) is unplayable past Act 1.** Both side
      panels default open at ≥768px (`useUIStore.ts` —
      `matchMedia('(min-width: 768px)')`) and each open panel is a fixed
      320px column (`md:w-80`, `GameShell.tsx`), so at e.g. 820px the center
      column gets ~180px: ledger text wraps one word per line, "Accept Plea"
      overflows its button, and the Act 3 submit button is pushed below the
      viewport with no scrollbar (action bar is `shrink-0` in a non-scrolling
      column). Fix: move the panels-open-by-default breakpoint to 1024px —
      `min-width: 1024px` in `useUIStore.ts` and the matching `md:` → `lg:`
      classes in `GameShell.tsx`/`PanelBackdrop.tsx` — so 768–1023px uses the
      drawer pattern that already works on phones. Optionally add a `min-w`
      floor on the center column as a guard. Verify by re-running the sweep
      at 820x1180: all Act 1–3 controls reachable, no per-word text wrap.
      **Tier: lower-tier** (contained to the three layout files; the fix is
      specified above).

## Presentation & pacing (first-time-player review, 2026-07-12)

Finding from a screenshot-by-screenshot playthrough: every phase renders its
full state in one frame — no sequencing, no acknowledgment of the player's
decisions, and the verdict/aftermath entries append **below the fold with no
scroll**, so the ending is invisible unless the player scrolls. It reads as a
case-review tool, not a courtroom. All fixes below are view-layer only
(`useUIStore` + CSS): `buildLedger` stays a pure projection, no schema/store
validation or phase-machine changes, no new dependencies.

- [ ] **Auto-scroll + entrance animation for new ledger entries** — when
      `entries.length` grows, `scrollIntoView` the newest entry with a
      fade/slide-in (respect `prefers-reduced-motion`). Closest to a bug fix:
      makes the verdict and aftermath visible at all.
- [ ] **Sequential ledger reveal** — `revealedEntryCount` in `useUIStore`;
      render `entries.slice(0, revealed)`, advance on click/tap (VN-style,
      respects reading speed) with a "reveal all" skip. Action bar stays
      disabled until the current phase's entries have been "heard." Reveal
      whole entries, not typewriter text.
- [ ] **Stage the finale as its own beat** — after sentencing, stagger the
      verdict → sentence → press Aftermath entries (~600ms), with the
      "Case closed / New Case" bar appearing only after the last one lands.
- [ ] **Per-speaker visual voice in `LedgerEntryRow`** — accent left-border
      keyed on `entry.speaker`, heavier headings for verdict/sentence `kind`s,
      press Aftermath styled as a clipping. Pure CSS on fields that already
      exist.
- [ ] **Act title cards on phase transition** — brief interstitial overlay
      ("Act 2 — Evidentiary Motions · The parties will be heard on
      admissibility"), rendered as UI chrome, not a ledger entry, so the
      ledger stays a pure court record.
- [ ] **Act 2 as per-motion beats** (biggest scope — absorbed into the
      "Courtroom transcript redesign" section below) — one contested evidence
      item center-stage at a time (description from validated case data),
      ruling echoes into the ledger before the next motion appears. Later:
      short prosecution/defense arguments per motion as narrative-only LLM
      color, same pattern as the plea rationale.
- [ ] **Driver escape hatch** — the paced reveal breaks `driver.mjs`'s pinned
      assertions; add an instant-reveal mode (e.g. `?instant=1` query param
      read at `useUIStore` init) so headless runs stay fast and deterministic,
      and update the driver alongside each item above.

## Unified courtroom design (merge of beat loop + dialogue-ledger pilot, 2026-07-18)

Two parallel redesigns of the same problem were reconciled by merge (user
ruling: the beat-loop architecture wins). The local beat-by-beat loop
(`courtroomScript.ts` projection over payload-embedded prose, `beatCursor`
reveal, per-decision ActionBar controls — see the ACTIVE section above) is the
base. The DialogueScript sidecar (schema section 9, `validateDialogueScriptAgainstCase`,
`setActiveDialogueScript`, the authored Webb script) was removed in the merge
resolution rather than left as dead code — its ideas survive as the work items
below, re-implemented natively in the beat-loop architecture. Harvested intact
from the pilot branch: the shared `EvidenceRulingSchema`/`VerdictValueSchema`
enums, the `spokenJudgeLines` + `recordSpokenJudgeLine` store plumbing (voice
record only; game logic never reads it), and the AGENTS.md cross-agent
coordination rules. The retired pilot's prose remains harvestable from git
history (`git show <pilot>:src/lib/demoCases/webb.ts`, merged parent).

Governing invariant (unchanged from both plans): **LLM/authored text provides
color, the deterministic pipeline provides structure.** A dialogue option is
`{ lineText, choice }` with `choice` drawn from the closed decision enums;
variants multiply voice, never the state space.

- [ ] **U1 — choice-keyed reaction beats.** Extend the payload schemas with
      per-choice reaction prose: evidence gains ruling reactions keyed
      `ADMITTED`/`EXCLUDED`, charges gain verdict reactions keyed
      `GUILTY`/`NOT_GUILTY`, the plea narrative gains `ACCEPT`/`REJECT`
      reactions (authored exactly when the posture puts an offer before the
      bench — same pairing rule as `allocution`). `buildCourtroomScript`
      emits the matching reaction after each resolved decision; prefix
      stability holds because reactions append with their decision's
      resolution. Author all four cases (harvest Webb's from the pilot
      script). **Tier: frontier schema/projection, lower-tier authoring for
      Boone/Reyes/Vaughn.**
- [ ] **U2 — voiced judge-line options.** Each decision point carries ≥1
      authored `{ lineText, choice }` option per outcome (choice-coverage
      refinement — port the pilot's `dialogueOption`/coverage-check pattern
      from git history). The decision controls (PleaRuling/MotionRuling/
      ChargeVerdict) present the voiced lines; the handler dispatches the
      structural decision + `recordSpokenJudgeLine` together, and the
      projection speaks the recorded line as the COURT beat (deterministic
      fallback: first option matching the recorded decision). Craft rules
      from the pilot: no scripted COURT lines the player didn't pick;
      option text never states numbers the engine doesn't produce.
      Sentencing stays a structured form. **Tier: frontier.**
- [ ] **U3 — tablet-band fix** — see "UI defects" above (768→1024 breakpoint;
      spec is complete). **Tier: lower-tier.**
- [ ] **U4 — driver + docs sweep.** `driver.mjs` asserts reaction beats and
      clicks voiced options; CLAUDE.md/README/AGENTS.md synced. **Tier:
      lower-tier.**

## Deferred MVP items (from plan §7)

- [ ] `GameService` + the 4-stage LLM generation pipeline
      (StatuteSelection → EnvironmentGen → CharacterGen → EvidenceGen).
      The BYOK path is a dead end by design until this exists — WelcomeScreen
      accepts a key but its Continue button is disabled.
- [ ] `ResultGenerator` + `FinalResult` localStorage persistence. END_STATE
      currently renders only in-memory state via the ledger; nothing survives
      a refresh. Note: `FinalResult.pleaOutcome`/`resolutionPath` can be derived
      entirely from existing state (`pleaDecision === 'ACCEPT'` → `PLEA`;
      otherwise `TRIAL` with `pleaOutcome` read off `pleaPosture.status`).
- [x] Aftermath narrative source — done: the demo docket uses authored
      `aftermathVariants` keyed by outcome, surfaced through the `CaseSource`
      seam (`demoCaseSource`). The BYOK path will call `generateAftermath()`
      on the same `CaseSource` interface; both implementations produce an
      already-validated narrative string before the store reaches `END_STATE`.
- [ ] Tier 2 testing checkpoint — `@testing-library/react` + jsdom (per-file
      `@vitest-environment jsdom`), now that the shell is stable. Needs
      dependency approval.
- [ ] Tier 3 testing checkpoint — `@playwright/test` E2E + `toHaveScreenshot()`
      baselines, now that the gameplay loop is functionally complete. Needs
      dependency approval.
- [ ] Loading/pipeline-progress UI for the real (non-demo) generation flow.
- [x] `PleaOfferForm`'s `NO_OFFER` and `REJECTED_BY_DEFENSE` branches — now
      exercisable via Boone (WEAK → no offer) and Reyes (STRONG → rejected)
      in the demo docket. Covered by the `run-the-bench` headless playthrough.
- [ ] Whether `sentencingModifierFromRulings` + defendant profile should
      algorithmically narrow the selectable sentencing range in
      `TrialVerdictForm`, versus being displayed as judge's context only
      (current behavior, flagged as an interpretation in the plan).
- [ ] `isProven` on `StatuteElement` is permanently `false` by schema contract;
      the Charge Detail modal's "Supported" indicator is a derived UI-only
      convenience, not a real proof-tracking system.
- [x] **Demo case narrative rewrite** — done (prose only; IDs/scores/structure
      and the pinned pipeline outcomes unchanged). The Webb case now has
      stakes and moral friction: a second-chance employer, custody-deadline
      timing, partial repayments, a thin-controls defense angle, victims with
      faces (a widow's escrow, a landscaper's payroll), voiced plea
      rationales, and an outcome-agnostic aftermath.
      **Design principle (still governs the future LLM pipeline prompts): the
      game must feel alive — the player is a judge weighing people, not a
      form-processor.**
- [x] Deferred tech-debt item — done: `OBJECTION_RISK_DISCOUNT` and
      `BIAS_WEIGHT` are closed Records keyed off the schema types
      (`CasePayload` indexed access), and the silent `??` fallback weights
      are removed.
