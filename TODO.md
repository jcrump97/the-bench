# TODO

Status of the "First UI Layer" plan (side panels, popups, ledger, action bar).
Phases 0–4 are **done and verified**: the demo case is fully playable end-to-end
(WELCOME → Play Demo → Act 1 → [Act 2] → Act 3 → END_STATE) on both the
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
- [x] **Polish pass** — done. Measured contrast: the "Play Demo Case" button
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
- [ ] **README update & review — do LAST, after all other items.** Review
      README.md against the current codebase and update it, particularly the
      Mermaid architecture charts (per-charge sentencing ranges +
      `deriveSentencingExposure`, three Zustand slices, implemented UI layer).
      **Keep the original written introduction untouched.**

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
- [ ] Aftermath narrative source — `useLedgerEntries` hardcodes
      `demoAftermathNarrative` at END_STATE (demo is the only playable path
      today). When GameService's Aftermath call exists, the narrative must come
      from state instead.
- [ ] Tier 2 testing checkpoint — `@testing-library/react` + jsdom (per-file
      `@vitest-environment jsdom`), now that the shell is stable. Needs
      dependency approval.
- [ ] Tier 3 testing checkpoint — `@playwright/test` E2E + `toHaveScreenshot()`
      baselines, now that the gameplay loop is functionally complete. Needs
      dependency approval.
- [ ] Loading/pipeline-progress UI for the real (non-demo) generation flow.
- [ ] `PleaOfferForm`'s `NO_OFFER` and `REJECTED_BY_DEFENSE` branches are not
      exercisable with the current demo case (it always scores MODERATE →
      PENDING_JUDICIAL_REVIEW). Either add a second "weak case" dev fixture or
      cover them with Tier 2 component tests against a mocked PleaPosture.
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
