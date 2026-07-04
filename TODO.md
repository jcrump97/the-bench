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
- [ ] **Polish pass** (`fix:` commit) — responsive/focus-visible/touch-target
      sweep. Known item from verification: the "Play Demo Case" button label
      (dark `--bg` text on `--accent`) reads low-contrast; check it against
      WCAG AA and consider a darker text token or lighter accent.
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
- [ ] **Demo case narrative rewrite** — the current demo case (Marcus Webb,
      embezzlement via trust-account transfers) is procedurally correct but
      dramatically inert: every description reads like an audit memo, and
      playing it feels like checking checkboxes. Rewrite the narrative layer
      (case summary, environment, character backstories, evidence/witness
      descriptions, plea rationales, aftermath) so the case has stakes,
      texture, and a human story — sympathetic pressures on the defendant,
      a victim with a face, evidence that raises real judgment calls rather
      than obvious admits. Structure/IDs/scoring can stay; this is prose only.
      This is also the bar for the future LLM generation pipeline: prompts
      must be engineered for vivid, morally textured cases, not schema-filler.
      **Design principle: the game must feel alive — the player is a judge
      weighing people, not a form-processor.**
- [x] Deferred tech-debt item — done: `OBJECTION_RISK_DISCOUNT` and
      `BIAS_WEIGHT` are closed Records keyed off the schema types
      (`CasePayload` indexed access), and the silent `??` fallback weights
      are removed.
