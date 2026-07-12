# TODO

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
