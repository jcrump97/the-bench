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
      **Progress (2026-07-12, commit `6dfcdd1`):** the sidecar schema exists —
      `DialogueScriptSchema` + beat/line/decision-point schemas in section 9
      of `src/schemas/gameSchemas.ts`, tested in
      `src/schemas/__tests__/dialogueScript{,.types}.test.ts`. The execution
      model is now fully designed — see **"Projection model — execution
      spec"** below. Work proceeds by spec items P1–P7.
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

### Projection model — execution spec (designed 2026-07-12)

**How to use this section:** each work item P1–P7 is written to be executable
by a fresh agent session (Claude Code or opencode) with no other context than
this file plus the code it names. Items are dependency-ordered. Each carries a
**Tier** tag for cost efficiency: `lower-tier` items have tight specs and
should go to Sonnet-class models or opencode; `frontier` items need design
judgment or narrative craft. When finishing an item, check it off here with a
commit hash, and note anything the next item's agent must know.

**Design decisions (settled — do not re-litigate):**

1. **The script is a hydration-time sidecar, like the plea narrative.**
   `DemoCaseBundle` gains optional `dialogueScript?: DialogueScript`;
   `useGameStore` gains `activeDialogueScript: DialogueScript | null` with a
   setter mirroring `setActivePleaNarrative` (WELCOME-gated,
   `DialogueScriptSchema.safeParse`, any violation → ERROR_STATE). Cross-payload
   checks the schema can't see live in a pure
   `validateDialogueScriptAgainstCase(script, payload, posture)` in
   `src/lib/`: motion `evidenceId`s are set-equal to `payload.evidence` ids;
   verdict `chargeId`s set-equal to `payload.charges` ids; every WITNESS
   `characterId` exists in `payload.witnesses`; `script.plea !== null` iff
   computed posture is `PENDING_JUDICIAL_REVIEW` (Boone's declination and
   Reyes's rejected offer are narrated in `openingBeat`, not a plea dialogue).
   Called both at demo module load (`defineDemoCase`) and by the store setter
   (which requires `activeCase` already hydrated; call order is
   `setActiveCase` → `setActiveDialogueScript`).
2. **The chosen line gets its own record; game logic never reads it.**
   Structural stores (`pleaDecision`, `motionRulings`, `verdict`) stay the
   sole inputs to derivations. New store field
   `spokenJudgeLines: Record<string, string>` maps a decision-point id
   (`'plea'` | `` `motion-${evidenceId}` `` | `` `verdict-${chargeId}` ``) to
   the chosen `lineText`, written by the same ActionBar handler that
   dispatches the structural decision. The projection falls back
   deterministically (first option whose `choice` matches the recorded
   structural decision) when a key is absent, so display totality never
   depends on the voice record.
3. **New projection beside the old one, not a rewrite of it.**
   `buildTranscript(input): TranscriptEntry[]` in `src/lib/buildTranscript.ts`
   with `TranscriptEntry = { id, order, phase, speaker: TranscriptSpeaker,
   characterId: string | null, text, kind }` — one entry per *utterance*.
   Beat lines get ids `` `${beatId}-${lineIndex}` `` (beat ids are
   script-unique by schema, so these are stable React keys). `buildLedger`
   is untouched; `GameShell` renders the transcript UI when
   `activeDialogueScript !== null`, the legacy ledger otherwise. Legacy path
   is deleted in P7 once all four cases carry scripts.
4. **Assembly order is a pure function of (case, script, decisions, phase):**
   openingBeat → [plea: promptBeat → chosen COURT line → `reactionBeats[pleaDecision]`]
   → on the trial path, motions unroll **in script order**: motion *i*'s
   promptBeat is emitted iff every motion before it is ruled; a ruled motion
   also emits its chosen line + reaction beat → verdicts unroll the same way
   (gated on phase ≥ ACT_3_VERDICT, trial path only) → sentencing
   pronouncement (synthetic COURT lines from `formatSentence`; the sentencing
   *form* stays structured per design item 5) → aftermath as PRESS entry at
   END_STATE. Accepted plea ⇒ motion and verdict dialogues are simply never
   emitted (no orphaned beats by construction).
5. **The projection is append-only as state accrues.** Every store mutation
   the sequential UI can produce only appends transcript entries (earlier
   sections depend only on earlier decisions, which are never revised).
   Sequential reveal (`revealedEntryCount`) relies on this invariant — assert
   it in tests.
6. **Reveal pauses at decision points without touching the phase machine.**
   The projection naturally ends at the next undecided promptBeat; the
   ActionBar's dialogue-choice buttons enable only when
   `revealedEntryCount === transcript.length`. Phase transitions stay in the
   existing ActionBar handlers; `useUIStore` gains reveal state only.
   `?instant=1` (read once at `useUIStore` init) reveals everything
   immediately — the driver escape hatch.

**Work items:**

- [x] **P1 — store + cross-validation plumbing.** Done in `1f31893`. Note
      for P2/P4 agents: `setActiveDialogueScript` requires `activeCase` *and*
      `activePleaNarrative` already hydrated (it recomputes the posture for
      the plea-presence check), so hydration order is case → narrative →
      script. Implement design items 1–2:
      `activeDialogueScript` + `setActiveDialogueScript`,
      `spokenJudgeLines` + `recordSpokenJudgeLine` (Zod-validate: key
      matches the three id shapes, text 1–300), and
      `src/lib/validateDialogueScriptAgainstCase.ts` with unit tests
      mirroring the store-gating tests in `src/store/__tests__/`.
      **Tier: lower-tier** (spec above is complete; copy existing setter
      patterns).
- [ ] **P2 — `buildTranscript` projection + tests.** Implement design items
      3–5 exactly. Tests must cover: plea-accept path (no motion/verdict
      beats), trial path sequential unrolling, fallback line selection,
      append-only invariant across a simulated full playthrough, WITNESS
      characterId passthrough. **Tier: lower-tier implementation, frontier
      line-by-line review** (this is the load-bearing module).
- [x] **P3 — Webb pilot `DialogueScript`.** Done in `133b92f`. Note for
      P4/P6 agents: the script establishes two craft rules — no scripted
      COURT lines (the judge speaks only player-chosen options plus the
      deterministic sentencing pronouncement), and option text never states
      numbers the engine doesn't produce. Author the full script (opening,
      plea prompt/reactions with ≥2 voiced options per outcome, four motions
      with prompt/reaction beats incl. witness testimony beats, verdict,
      both branches) in `src/lib/demoCases/webb.ts`; wire
      `dialogueScript` through `DemoCaseBundle`/`defineDemoCase` (cross-validate
      at load). Prose must keep Webb's authored stakes (second-chance
      employer, custody timing, victims with faces). **Tier: frontier**
      (narrative craft + first exercise of the whole schema).
- [ ] **P4 — transcript UI.** `Transcript`/`TranscriptLineRow` components
      (speaker-attributed utterances, WITNESS lines resolve `characterId` to
      the witness name from `activeCase`), dialogue-choice ActionBar variant
      rendering the active decision point's options and dispatching
      structural decision + `recordSpokenJudgeLine` together; `GameShell`
      branches per design item 3. **Tier: lower-tier** (per-speaker CSS voice
      from the pacing section folds in here).
- [ ] **P5 — reveal, auto-scroll, driver.** `revealedEntryCount` +
      advance-on-click + reveal-all in `useUIStore`; auto-scroll newest
      entry (respect `prefers-reduced-motion`); `?instant=1`; update
      `driver.mjs` Webb runs to click dialogue options under instant mode
      while the other three cases keep the legacy path. **Tier: lower-tier.**
- [ ] **P6 — port Boone / Reyes / Vaughn scripts.** Follow the Webb pattern;
      Boone/Reyes narrate their plea posture in `openingBeat` (`plea: null`);
      Vaughn gets one verdict dialogue per charge. **Tier: lower-tier
      drafting, frontier voice review.**
- [ ] **P7 — retire the legacy ledger.** Remove `buildLedger`,
      `useLedgerEntries`, `Ledger`/`LedgerEntryRow`, the form-style plea and
      motion/verdict controls the dialogue UI replaced, and the `GameShell`
      branch; make `dialogueScript` required on `DemoCaseBundle`; final
      driver assertion sweep. **Tier: lower-tier.**

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
