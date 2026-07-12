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

## Courtroom transcript redesign (dialogue ledger — design plan, 2026-07-12)

**This section is the shared plan of record for this redesign — kept in
TODO.md deliberately so Claude Code and opencode agents work from the same
document.** It extends (and partially supersedes) the "Presentation &
pacing" section above: sequential reveal is a prerequisite, and the Act 2
per-motion-beats item is absorbed into this design.

**Vision (user, 2026-07-12):** the ledger should read as a court
transcript — dialogue between named parties, not summary paragraphs. The
current demo cases narrate "the thought process of all parties"; instead,
parties should *speak*. Player decision points become dialogue choices: the
player picks the line the judge says from the bench (a mini ruling or
procedural line), and that line enters the transcript. Multiple answer
options per decision should be generatable.

**Governing invariant (do not violate):** a dialogue option is
`{ lineText: string, outcome: <closed structural enum> }`. The outcome set
per decision point is fixed and deterministic (plea: ACCEPT/REJECT;
motion: ADMIT/EXCLUDE; verdict: GUILTY/NOT_GUILTY per charge). Authored
demo text or LLM generation supplies only `lineText` — never a new outcome.
Same pattern as `buildPleaPosture`: LLM provides color, deterministic
pipeline provides structure. Zod-validate generated options and reject any
whose `outcome` isn't in the closed set for that decision point.

- [ ] **1. Utterance-level transcript model** — subdivide today's paragraph
      entries into dialogue lines. Extend `LedgerEntry` (or add a
      `TranscriptLine` shape) with utterance granularity; `buildLedger`
      stays a pure projection. The player's chosen judge-lines append as
      `COURT` entries verbatim, so the transcript records what the judge
      actually said.
- [ ] **2. Dialogue scripts for the four demo cases** — rewrite Webb /
      Boone / Reyes / Vaughn prose (summaries, plea rationales, motion
      context, aftermath) as spoken exchanges. Content rides in a
      narrative-only sidecar validated at hydration (pattern:
      `PleaNarrativeSchema`) — e.g. a `DialogueScriptSchema` — so
      `CaseSchema` structure is untouched. Biggest content lift.
- [ ] **3. Judicial voice options at decision points** — replace form-style
      controls (plea buttons, batch motion rows, verdict toggles) with
      dialogue-choice buttons. Each structural outcome gets ≥1 authored
      line; multiple phrasings per outcome are allowed (this is the
      "generatable options" hook — demo cases author them, the future LLM
      pipeline generates them within the schema). Open sub-question: does
      the chosen *tone* (stern vs. measured phrasing of the same ruling)
      feed the aftermath narrative as color?
- [ ] **4. Beats: player lines that trigger scripted exchanges** — core
      mechanic (upgraded from "optional flavor" per user, see resolutions
      below). A chosen judge line — procedural ("The court will hear the
      People") or a mini ruling — can unroll a multi-line scripted exchange
      across speakers (including `WITNESS`/`DEFENDANT` testimony) before
      the next decision point. Beat selection is deterministic (keyed off
      the closed choice enum); beat content is authored/generated narrative
      validated by the sidecar schema.
- [ ] **5. Sentencing exception** — sentencing (per-charge sentence
      selection from lawful ranges) stays a structured form; a dialogue
      button can't express "2 years + $10,000 fine" honestly. The
      *pronouncement* of the chosen sentence still enters the transcript as
      a COURT line.
- [ ] **6. Reveal + driver integration** — transcript advances line-by-line
      (sequential reveal from the pacing section) and pauses at decision
      points; `driver.mjs` gets the instant-reveal escape hatch and updated
      assertions (utterance-level speaker order will change the pinned
      expectations).

**Resolved with the user (2026-07-12):**
1. **Tone variants are pure voice.** Same outcome, same downstream state;
   aftermath does not key on the chosen phrasing. (Tone-as-input can be
   added later without breaking anything.)
2. **Pilot on Webb first** (both branches), then port Boone/Reyes/Vaughn
   once the transcript model and choice UI settle.
3. **Beats, not single lines — testimony is in scope.** A player's chosen
   line can trigger a *multi-step scripted exchange* (e.g. "The court will
   hear from the witness" → counsel question → witness answer → objection
   → back to the bench) before the next decision point. Immersion is the
   goal. Implications: `LedgerSpeaker` gains `WITNESS`/`DEFENDANT`; the
   dialogue script is a tree of beats keyed by structural choice —
   `{ choice } → [scripted lines...] → next decision point` — where beat
   *selection* is deterministic (keyed off the closed outcome/choice enum)
   and beat *content* is authored (demo) or generated (LLM), validated by
   the same sidecar schema. This is item 4 upgraded from "optional flavor"
   to core mechanic.

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
