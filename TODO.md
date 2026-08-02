# TODO

## BYOK pipeline reliability — systemic mistrials (user report, 2026-08-02 — DONE)

Player-reported: the live Gemini pipeline lands on `ErrorScreen` ("Mistrial")
most of the time. Branch: `fix/pipeline-reliability`, 17 commits
(`docs(todo)` → `docs`). The commit messages are the record; the plan file has
since been overwritten by the cross-stage plan below.

**Root cause is not model flakiness.** Three compounding gaps, each verified
by reading `src/lib/llm/` against `src/schemas/gameSchemas.ts`:

1. **The Zod schemas enforce ~15 constraints Gemini is never told about.** The
   hand-written `GeminiSchema` type (`geminiClient.ts:27-37`) cannot express
   length, range, or pattern, and no prompt states the cross-field refinements
   — judge-line choice coverage, `objectionRisk`/`defenseObjection`, a
   mandatory minimum needing a same-type maximum, the `caseId` pattern. The
   model is graded on a rubric it was never shown.
2. **Gemini materializes every declared property, and `SentenceSchema` is
   strict.** `stages.ts:518-534` already documents this for `interrogation:
   null`; the same thing happens to `conditions: []` on every sentence, which
   `SentenceSchema` rejects as an unrecognized key on PRISON/JAIL/FINE/
   COMMUNITY_SERVICE and as too-small on PROBATION. Guarded only by a prompt
   sentence. A two-charge case with two priors rolls this die ~10 times.
3. **Prompts suppress bad output instead of producing good output**, and the
   inference parameters are half-configured — no `maxOutputTokens`, no
   `finishReason` check, no safety config, and no thinking config on a
   `flash-lite` tier that does not think by default.

Amplified by two structural problems: `generateValidated`'s retry never shows
the model the JSON it produced (so it regenerates blind rather than repairing),
and seven independent stages multiply — 85% each is 32% end to end.

- [x] **C1** — this entry (`docs(todo)`).
- [x] **C2** — observability seam (`generationObserver.ts`) +
      `pipelineDiagnostic.live.test.ts` (N runs, ranked stage × issue table
      written to a file — vitest's reporter swallowed console output).
- [x] **C5** — `minLength`/`maxLength`/`minimum`/`maximum`/`pattern` carried
      into the response schema, ~60 constraints. **The confirmed fix.** The
      two scores that broke are additionally `integer` with the 1-10 scale
      named in a `description`.
- [x] **C5a** — `fix`: dropped the `evidence` `minItems` C5 added. Gemini
      rejects the entire request with a bare 400 `INVALID_ARGUMENT` when
      `minItems` is set on an array whose item schema contains a nullable
      nested object (here, `interrogation`). Took the pipeline 5/5 → 0/5 and
      was caught within one sweep because the change was measured, not
      assumed. `witnesses`/`charges`/`elements`/`maximumPenalties` keep theirs.
- [x] **C7** — retry carries the previous response, so it repairs instead of
      regenerating blind.
- [x] **C7a** — a non-retryable `GeminiError` is rethrown with `[StageName]`
      prefixed. Without it the 400 above showed no stage at all and cost a
      live bisection to locate.
- [x] **C8** — `MAX_TOKENS` and safety blocks surface as typed errors
      (`GeminiError.reason`); explicit `maxOutputTokens`; `safetySettings` at
      `BLOCK_ONLY_HIGH`.
- [x] **C9** — **no thinking config, deliberately.** `thinkingBudget: 0` is
      rejected outright by the model `gemini-flash-lite-latest` resolves to;
      the parameter is split by family (`thinkingBudget` 2.5 /
      `thinkingLevel` 3.x, both together a 400) while `modelSelection` prefers
      version-less `-latest` aliases, so the family can't be derived from the
      resolved name; and there is no measured failure for a budget to buy
      back. Recorded as a comment in `geminiClient.ts` so the next person to
      "optimize" it finds the 400 documented rather than in production.
- [x] **C6** — every `*_SYSTEM` rebuilt on affirmative, exemplified
      instruction (ROLE / TASK / RULES / EXAMPLE).
- [x] **C4** — deterministic id/`targetElementId` reconciliation
      (`reconcileCase.ts`) before `CaseSchema` validates, so the full-case LLM
      repair round is reached only by genuinely narrative failures.
- [x] **C12/C13** — `qa-agent`: case memory (it was asked to find cross-beat
      contradictions while structurally unable to see earlier beats), plus
      bounded per-beat screenshot and inference cost.
- [ ] **C10** — regression tests over the new transport errors, the
      repair-shaped retry, and `reconcileCrossStageIds`.
- [ ] **C14** — docs sync (CLAUDE.md + AGENTS.md together per `AGENTS.md:10`,
      README status, and the stale four-cases/five-runs drift at
      `AGENTS.md:74`/`:88`).

**Dropped, with reasons:**

- **C3** (`stripInapplicableConditions`) — the planned normalizer guarded
  Gemini emitting `conditions: []` on non-PROBATION sentences. Twelve-plus
  live runs never produced one. Gemini materializes fields marked
  `nullable: true` as an explicit `null` (which is how `interrogation` was
  found) but simply *omits* plain non-required fields. Adding speculative
  normalization to a validated trust boundary to fix a problem that does not
  exist is the opposite of what this schema layer is for.
- **C11** (splitting `runEvidenceGen`) — conditional on EvidenceGen still
  dominating the post-fix table. It does not: zero failed attempts. The extra
  API calls and latency would buy nothing.

### Measurements

Before/after end-to-end `generateCase` success across 5 live runs, from the
C2 diagnostic (`/tmp/bench-pipeline-diagnostic.txt`).

| Sweep | Success rate | Failed attempts |
|---|---|---|
| Baseline 2026-08-02 | 5/5 (100%) | EvidenceGen first attempt failed in 3/5 runs on `relevanceScore`/`credibilityScore` `>= 1`; all recovered on retry |
| After C5 + C7 | 5/5 (100%) | **zero** |
| After C6 (prompt rebuild) | 5/5 (100%) | **zero** |

The headline number was already 100% at baseline, so the honest measure of
this work is the *failed-attempt* column: three wasted EvidenceGen attempts
across five runs, now none. That gap is the whole story — every attempt that
failed was one retry closer to the exhaustion the player actually hit.

**The baseline contradicts two of the three hypotheses above — recorded here
rather than quietly dropped.**

- **Hypothesis 2 (`conditions: []`) did not reproduce.** Gemini never emitted a
  stray `conditions` array. The likely reason: it materializes fields marked
  `nullable: true` as an explicit `null` (which is how `interrogation` was
  found), but simply *omits* plain non-required fields like `conditions`.
  `stripInapplicableConditions` therefore lands as cheap insurance against a
  model-behavior change, not as the fix for an observed failure.
- **Hypothesis 1 is confirmed, but narrowly.** The only violation actually
  observed is exactly the missing-numeric-range case: the model emits
  `relevanceScore`/`credibilityScore` on a 0-1 normalized scale because nothing
  in the response schema says the range is 1-10. That makes **C5 the confirmed
  highest-value fix**, and it is promoted ahead of C3/C4.
- **Root cause confirmed by the player's own error text**, which read:

      [generateCase] [EvidenceGen] Failed to produce valid output after 3
      attempt(s): evidence.0.relevanceScore: Invalid input; ...
      witnesses.1.credibilityScore: Invalid input

  Same fields, same stage the diagnostic flagged. Note `Invalid input` rather
  than `Too small`: Zod emits that for a *wrong type* (null, a string, NaN),
  where the diagnostic caught the sibling case of an in-type-but-out-of-range
  0-1 score. One unconstrained field, two ways to get it wrong. It exhausted
  all three attempts because the retry never showed the model its own output
  (C7) — so it regenerated blind and made the same mistake three times.

## Cross-stage context starvation (qa-agent findings, 2026-08-02 — OPEN)

Found by the first `qa-agent` run after it was given case memory. Every
finding is a *content coherence* problem, not a validation failure — none of
these cause a mistrial, and all of them pass every schema. They share one
root cause: **a stage authors voiced content about facts another stage
decides, and is never told them.** Ranked by how visible the damage is.

1. **The verdict names the wrong person.** `runStatuteSelection` is stage 1
   and authors `verdictOptions[].lineText` — the words the judge actually
   speaks when calling the count — but the defendant is not generated until
   stage 3 (`runCharacterGen`). The model has no name, so it invents one. In
   the observed run the court convicted "Arthur Pendelton", who was a
   *prosecution witness*; the defendant was Marcus Vance. This is the
   climax of the game reading as gibberish. Options: author judge lines in a
   later stage, pass the defendant back for a line-only rewrite, or forbid
   naming anyone in `lineText` and let the UI supply the name.
2. **The plea narrative contradicts the plea offer.** `runPleaNarrative`
   receives the payload and the `band`, but not the `PleaPosture`
   `buildPleaPosture` derives — so it does not know the charge partition or
   the proposed sentence. Observed: the People argued for "four years" on
   "second-degree burglary" beside a header offering six years on first
   degree, and defense counsel said the defendant would accept while the
   computed posture was `REJECTED_BY_DEFENSE` (the next beat then read
   "with no plea before the bench").
3. **Closings argue facts not in evidence.** `buildFinalizeContents` passes
   only charge names, the defendant's name, and the environment description
   — not the exhibits or witnesses. Observed: the People's closing rested on
   "DNA on the broken glass" when no DNA exhibit existed, and the statement
   of facts cited surveillance footage that was never disclosed. Flagged as
   a known weakness when the reliability work was planned; the qa-agent has
   now confirmed it empirically.
4. **The interrogation invents its own scene.** `buildInterrogationGenContents`
   passes the defendant's name and the derived profile, not the environment.
   Observed: the detective questioned the defendant about "Elm Street" when
   the scene was 742 Evergreen Terrace.
5. **`directExamination` is written as a Q&A blob.** The field is the
   witness's spoken testimony, but the model returned counsel's questions and
   the witness's answers merged into one string, so the witness appears to
   ask and answer their own examination.

The fix shape for 2-5 is the same and cheap: pass the missing context into
the stage's `build*Contents`. Item 1 is the only structural one — it is a
pipeline *ordering* problem, not a missing-argument problem.

### Plan (approved 2026-08-02) — `~/.claude/plans/peaceful-wandering-wigderson.md`

Two decisions were taken rather than assumed. For item 1, the choice was
between forbidding names in stage-1 text (what the demo cases already do) and
giving the stage the facts; **giving it the facts won**, because a verdict
reaction that can reach for the defendant's circumstances — Webb's "two boys
waiting on a custody schedule" — is the texture the demo docket sets as the
standard. And the wrong-person class gets a **schema backstop**, not just a
prompt, on the same reasoning as `noJury`.

New pipeline order (`VerdictVoice` placed after EvidenceGen for the richest
context; nothing between needs the voiced fields):

```
StatuteSelection(core) → EnvironmentGen → CharacterGen → InterrogationGen
  → EvidenceGen → VerdictVoice → finalizeCasePayload → PleaNarrative
```

The plea circularity turned out to be only apparent, which is what makes
item 2 tractable: `pleadsToChargeIds`, `proposedSentence`, the `assessDefense`
result and therefore `status` are all derived from `caseData` and `band` alone
(`pleaAssessment.ts:193-222`) — the rationales are pure pass-through. So the
offer can be derived *before* the narrative that argues about it.

- [ ] **D1** — this entry.
- [ ] **D2** — `environment` threaded into InterrogationGen (finding 4).
- [ ] **D3** — exhibits and witnesses into the finalize prompt (finding 3).
- [ ] **D4** — examination fields written as testimony, not Q&A (finding 5).
- [ ] **D5** — extract `derivePleaOfferTerms`; `buildPleaPosture` calls it so
      there is one derivation and no drift.
- [ ] **D6** — offer terms and the defense's accept/reject into the plea
      narrative prompt (finding 2).
- [ ] **D7** — `ChargeSchema` split into `ChargeCoreSchema` + a voiced half.
      It is a `strictObject(...).superRefine(...)`, so `.omit()` is
      unavailable; the split shares a shape object and `ChargeSchema` itself
      stays byte-identical in behaviour so demo cases cross the same gate.
- [ ] **D8** — new `VerdictVoice` stage (finding 1). **Probe its response
      schema against the live API before wiring it in** — a `minItems`
      constraint and a `thinkingBudget: 0` have each already broken this
      pipeline on plausible-sounding reasoning.
- [ ] **D9** — `CaseSchema` refinement: the phrase "defendant &lt;Name&gt;" must
      name the defendant (finding 6). All five demo cases must still pass.
- [ ] **D10/D11/D12** — outstanding items from the skeptical review: a
      degraded `qa-agent` review judgment currently reads as a clean beat, the
      repair round re-embeds stale context on its second retry, and
      `reconcileCrossStageIds` has one untested branch.
- [ ] **D13** — docs sync, including the README pipeline diagram and stating
      the `BLOCK_ONLY_HIGH` safety threshold as an accepted decision.

Noted, not actioned: `MAX_ECHOED_RESPONSE_CHARS = 60_000` now applies to every
stage's retry rather than only the repair round it was sized for. Fine at
current payload sizes; revisit if a stage ever produces much larger output.

### Handoff notes (anyone picking this up cold)

Branch `fix/pipeline-reliability`, cut from `main`, nothing pushed. Work items
above are in dependency order; D2/D3/D4 and D10/D11/D12 are independent of
everything else and can be done in any order.

Where each item lives:

| Item | Files |
|---|---|
| D2 | `src/lib/llm/stages.ts` (`runInterrogationGen`, `buildInterrogationGenContents`), `src/lib/llm/gameService.ts` (already holds `environment`) |
| D3 | `src/lib/llm/stages.ts` (`buildFinalizeContents` — `parts` already carries `evidence`/`witnesses`, they are just not put in the prompt) |
| D4 | `src/lib/llm/stages.ts` (`WITNESS_GEMINI_SCHEMA.directExamination` description, `EVIDENCE_GEN_SYSTEM`). Quality bar: `src/lib/demoCases/webb.ts:127` |
| D5/D6 | `src/lib/pleaAssessment.ts:193-222`, `src/lib/llm/stages.ts` (`runPleaNarrative`, `buildPleaNarrativeContents`), `src/lib/llm/gameService.ts:54` |
| D7 | `src/schemas/gameSchemas.ts:161-180` |
| D8 | `src/lib/llm/stages.ts`, `src/lib/llm/gameService.ts` |
| D9 | `src/schemas/gameSchemas.ts:396` (`CaseSchema`'s existing `superRefine`) |
| D10 | `.claude/skills/qa-agent/qa-agent.mjs` (`judgeContent`'s degraded return), `SKILL.md` |
| D11 | `src/lib/llm/stages.ts` (`buildRepairContents`) |
| D12 | `src/lib/llm/__tests__/reconcileCase.test.ts` |

Hard-won constraints, all verified against the live API — **do not "optimize"
past these without probing first** (see also the comment on `generationConfig`
in `geminiClient.ts`):

- `minItems` on an array whose item schema contains a nullable nested object
  makes Gemini reject the whole request with a bare 400. This is why
  `evidence` has no `minItems`.
- `thinkingBudget: 0` is rejected by the model `gemini-flash-lite-latest`
  resolves to; the thinking parameter is split by model family and the family
  cannot be derived from a `-latest` alias. The pipeline sends none.
- Gemini materializes `nullable: true` fields as an explicit `null` but omits
  plain non-required ones.

Verification (`AGENTS.md` has the full command list):

```bash
npm run lint && npm test && npm run build     # per commit; pre-commit hook runs lint+build
npm run test:live                             # 5-run diagnostic; must stay 5/5, zero failed attempts
node .claude/skills/run-the-bench/driver.mjs  # needs `npm run dev` first; six runs, five demo cases
node .claude/skills/qa-agent/qa-agent.mjs     # live playthrough; the only check that reads the prose
```

Baselines to hold: `npm test` is at 293 passing; the live diagnostic is at 5/5
with **zero** failed attempts (report lands at `/tmp/bench-pipeline-diagnostic.txt`,
override with `DIAGNOSTIC_REPORT`/`DIAGNOSTIC_RUNS`).

**Note on qa-agent false positives:** two MEDIUM `UI_UX` findings reported the
court's ruling text as unreadably low contrast. It is the beat-reveal fade-in
caught mid-animation — `beat-021.png` shows the same text at full contrast one
beat later. Worth teaching the tester about the reveal transition before
trusting its UI findings.

## Courtroom realism overhaul (user feedback, 2026-08-01 — DONE)

Nine issues in one push, eight commits (`feat(schema)` → `feat(demo)`),
plan: `~/.claude/plans/here-is-a-draft-cheeky-comet.md`. Player-reported:
transcript read as inner monologue; OCEAN visible; everything browsable
from beat 0; no tutorial; no panel-collapse affordance; the clerk narrated
facts; the offer landed with no arraignment/discovery pacing; transcript
rows weren't clickable — plus, added in plan review, simulated police
interrogations driven by the OCEAN traits.

- [x] `statementOfFacts` + per-evidence `disclosureSummary`; `summary`
      re-authored dry; rationales re-voiced as on-record speech.
- [x] Interrogation system: `deriveInterrogationProfile` (traits + priors →
      outcome + suppression ground, echo-validated by `defineDemoCase`);
      `INTERROGATION` exhibits with transcripts for Webb and Vaughn (both
      neuroticism-9 talkers); tape played beat-by-beat before the
      suppression ruling. Future pipeline stage: InterrogationGen.
- [x] Act 1 restructure: call → charges → arraignment plea → statement of
      facts → discovery disclosures → offer. `subject` stamped on
      presentation beats.
- [x] Progressive reveal (`src/lib/reveal.ts` + `useRevealState`):
      DISCLOSED/PRESENTED tiers gate panels and modals.
- [x] OCEAN hidden everywhere; derived probation demeanor notes
      (`src/lib/demeanorNotes.ts`, digit-free) at sentencing.
- [x] Transcript click-through: subject rows open modal + panel.
- [x] Once-per-session panel-collapse hint (in-memory flag).
- [x] Guided tutorial case (People v. Eli Navarro, MODERATE/offer-pending)
      with bundle-side decision explainers rendered by ActionBar.

Verified per phase and end-to-end: `npm run lint && npm test && npm run
build` + the full six-run `run-the-bench` docket, clean console.

## Mobile sentencing input snapping to floor/ceiling (user bug report, 2026-07-21 — FIXED)

Reported on Android Chrome: adjusting the sentencing amount would only let
the player land on the far min or max of the range, not values in between.
Root cause: `SentencePicker`'s number input clamped the value on every
keystroke and re-rendered with the clamped result; on a numeric keypad,
typing a second digit landed on top of that just-clamped extreme instead of
the number the player meant to build (e.g. typing "1" then "8" toward "18"
in a 1–3 range clamps to 3 after the first extra digit, and every further
digit re-clamps to the same extreme). Fixed by editing against a local
draft string in a new `SentenceAmountField`: only a complete in-range
number propagates live, and blur reconciles the draft to whatever ended up
committed. Verified with a scripted digit-by-digit typing repro (Playwright,
touch-emulated viewport) confirming the draft no longer snaps mid-edit, plus
the full `run-the-bench` docket (unaffected).

## Beat-by-beat courtroom loop redesign (2026-07-16 — DONE)

The static form-dump loop was replaced by a click-to-advance courtroom
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
- [x] **Push** — done 2026-07-18, as the head of the unified-design push
      (see "Unified courtroom design" below): full docket verified headless
      (ALL CHECKS PASSED, clean console) plus a tablet spot-check at
      820x1180 before pushing.

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

- [x] **Tablet band (~768–1000px) is unplayable past Act 1.** Fixed in `2194c8a` (verified at 820x1180: controls reachable, drawers off-canvas). Both side
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

Original finding: every phase rendered its full state in one frame — no
sequencing, no acknowledgment of decisions, ending below the fold. **Mostly
superseded by the beat-by-beat loop** (sections above): auto-scroll +
`beat-in` entrance animation, sequential reveal via `beatCursor` with
skip-to-next-decision, per-exhibit Act 2 beats, and a beat-paced finale all
shipped with it, and the driver advances beat-by-beat via `advanceTo()`
(no `?instant=1` escape hatch ever proved necessary). Still open, both pure
view-layer polish:

- [x] **Per-speaker visual voice in `LedgerEntryRow`** — done, landed with U6
      below (they were paired): a per-speaker accent left-border keyed on
      `entry.speaker` (new `--speaker-*` tokens in `index.css`, chosen apart
      from the status hues), heavier headings for the verdict/sentence outcome
      beats, and the press Aftermath rendered as a clipping.
- [ ] **Act title cards on phase transition** — brief interstitial overlay
      ("Act 2 — Evidentiary Motions · The parties will be heard on
      admissibility"), rendered as UI chrome, not a courtroom beat, so the
      record stays a pure projection. **Tier: lower-tier.**

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

- [x] **U1 (`b46485f`) — choice-keyed reaction beats.** Extend the payload schemas with
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
- [x] **U2 (`6cd1534`) — voiced judge-line options.** Each decision point carries ≥1
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
- [x] **U3 (`2194c8a`) — tablet-band fix** — see "UI defects" above (768→1024 breakpoint;
      spec is complete). **Tier: lower-tier.**
- [x] **U4 — driver + docs sweep.** Done alongside U2 and the docs commit
      (`2318e93`): `driver.mjs` selects options by `data-choice` and asserts
      the new ruling headings + reaction beats; CLAUDE.md/README/AGENTS.md
      synced. **Tier: lower-tier.**
- [x] **U5 — README Mermaid refresh.** Done. The retired `buildLedger`/
      `DialogueScript` were already scrubbed from both diagrams; the remaining
      work was additive. The `buildCourtroomScript` node now names its outputs
      (statement + decision beats, the `spokenJudgeLines` voice record, the
      choice-keyed reaction beats), and a new `View State (useUIStore)` node
      represents the forward-only `beatCursor` reveal between the projection
      and the game phases. Prose note added on the spoken-transcript record.
- [x] **U6 — make the record read as a spoken transcript** (user-reported,
      2026-07-18). Done. `LedgerEntryRow` now renders each beat as courtroom
      speech: the speaker leads the line (witnesses and the allocuting
      defendant by their own name via the new `speakerName` on `StatementBeat`,
      commit `feat(lib)`), the editorial heading is demoted to small stage
      direction or dropped where the speaker already says it (reactions), and a
      per-speaker accent runs down the margin so exchanges flow instead of
      stacking as boxes. Two beats stay set apart: the court's rulings keep a
      heading-led panel (the structural outcome stays visible, heavier for
      verdict/sentence) and the press aftermath renders as a clipping. Rows
      carry `data-speaker`/`data-entry-kind` for structural selection
      independent of the visible copy; the driver was retargeted onto them.
      Verified headless across the full docket (ALL CHECKS PASSED, clean
      console) plus a visual sweep of the plea/trial branches.

## Transcript rendering follow-ups (code review, 2026-07-21)

A `/code-review` pass over the transcript-rendering push (U6 + per-speaker
voice) surfaced six findings. The most severe — losing which side called a
witness once the heading was demoted — is fixed; the rest are recorded here
so they aren't lost.

- [x] **Which side called the witness, dropped from the transcript.** Fixed:
      `calledByDefense` is now a structured field on the `TESTIMONY_DIRECT`
      beat (`StatementBeat.calledByDefense`, set from `witness.bias` in
      `courtroomScript.ts`), and `LedgerEntryRow`'s caption reads it back
      ("Direct examination — called by the defense/prosecution") instead of
      silently losing it to the generic name-led caption.
- [ ] **Blank-name schema gap.** `WitnessSchema.name` and
      `CharacterSchema.firstName`/`lastName` have no `.min(1)`, so a
      schema-valid empty string would render a blank speaker line in
      `LedgerEntryRow` (`entry.speakerName ?? SPEAKER_LABELS[...]` only
      catches null/undefined). Latent today (demo cases are hardcoded
      non-empty); worth a `.min(1)` before the LLM pipeline can produce
      names. **Tier: lower-tier, schema-only.**
- [ ] **Heading semantics lost for screen readers.** ~13 of 18
      `StatementEntryKind`s dropped their `<h3>` for a plain `<p>` caption in
      the utterance-style rewrite, narrowing heading-based screen-reader
      navigation of the record (partially offset by the surrounding
      `<ol aria-label="Court record">` list semantics). Worth revisiting if
      an accessibility pass happens.
- [ ] **`LedgerEntryRow`'s kind-classification isn't exhaustive.**
      `OUTCOME_KINDS`/`HEAVY_KINDS`/`REACTION_KINDS` (Sets) and
      `NAME_LED_CAPTIONS` (`Partial<Record>`) don't cover
      `StatementEntryKind` exhaustively, unlike `SPEAKER_LABELS`/
      `SPEAKER_ACCENT` (full `Record`s) in the same file — a future new beat
      kind would silently fall through to the wrong render branch with no
      compile error. **Tier: lower-tier, would want a design decision on
      how new beat kinds should default (flowing speech seems the safe
      default).**
- [ ] **Duplicated `<li>` wrapper shell across the three render branches** —
      modest cleanup opportunity, not a bug.
- [ ] **`LedgerEntryRow` is unmemoized** — every revealed row re-renders on
      each beat advance. Negligible at the app's actual scale (dozens of
      beats, user-paced clicks); not worth doing unless the record grows
      much longer.
- [ ] **Idea (not yet scoped): call order/emphasis driven by witness
      quality, not just side.** Raised alongside the caption fix — instead
      of (or alongside) `calledByDefense`, derive something like call order,
      or how much weight the transcript gives a witness's testimony, from a
      witness-credibility signal (bias strength / OCEAN traits / a new
      schema field) rather than purely which side called them. Interesting
      but underspecified — no schema field carries "quality" today, and it's
      unclear whether this belongs in the projection (deterministic) or the
      authored case data (LLM color). Needs a design pass before it's
      buildable, not a small follow-up.

## Deferred MVP items (from plan §7)

- [x] `GameService` + the five-stage LLM generation pipeline (2026-08-01 —
      DONE; this bullet previously said "4-stage", omitting InterrogationGen
      as its own stage — CLAUDE.md's diagram was always the correct count of
      five: StatuteSelection → EnvironmentGen → CharacterGen →
      InterrogationGen → EvidenceGen → finalizeCasePayload). New
      `src/lib/llm/` module: `geminiClient.ts` (native-fetch wrapper, retry/
      backoff on 429/5xx), `modelSelection.ts` (runtime discovery of the
      cheapest capable model via ListModels, ranked by tier — flash-lite >
      flash > other — and, within a tier, by stability — a `-latest` alias >
      a plain versioned name > a preview/dated-snapshot/pinned-numeric-build
      name — with a hardcoded fallback when discovery fails entirely),
      `stages.ts` (one function per stage, each backed by a hand-written
      Gemini responseSchema and validated against the same Zod schemas
      hand-authored demo cases cross; validation failures retry with the
      Zod issues fed back as corrective feedback; `finalizeCasePayload` runs
      a bounded repair round when the fully assembled payload fails the
      cross-stage `CaseSchema` refinements), and `gameService.ts`
      (`createGameService(apiKey): CaseSource`, model discovery memoized
      once per session). `useCaseSource`/`WelcomeScreen` wired live — a real
      Gemini key now plays a generated case through the same seam as the
      demo docket; the Continue button is no longer disabled. Fully
      fetch-mocked default test suite (first `fetch`-mocking pattern in the
      repo); `npm test` never hits the real Gemini API.
- [x] **Live Gemini test suite + two reliability fixes it found**
      (2026-08-01 — DONE, follow-up to the bullet above).
      `src/lib/llm/__tests__/live/` calls the real API (gated behind
      `GEMINI_API_KEY`, read from a gitignored repo-root `.env` or the shell
      env via `liveEnv.ts`; skips cleanly via `describe.skipIf` when no key
      is available) through a separate `vitest.live.config.ts` and
      `npm run test:live` — excluded from the default `npm test` run via
      `vite.config.ts`'s `test.exclude` regardless of whether a `.env` key
      is present, so it never costs money or flakes in the normal build
      gate. Running it against the real API caught two gaps the mocked
      suite couldn't: (1) `selectModel` had picked a retired pinned build
      (`gemini-2.0-flash-lite-001`) that `ListModels` still listed as
      `generateContent`-capable but that 404'd on actual use — fixed by the
      tier+stability ranking described above, plus excluding specialist
      non-text model families (`image`/`tts`/`robotics`/etc.) that happen to
      contain "flash" in their name; (2) Gemini's structured-output mode
      returns an explicit `null` for the optional `interrogation` field
      instead of omitting it, which `EvidenceSchema` (optional, not
      nullable) rejected on every ordinary evidence item — fixed with a
      `z.preprocess` null→undefined normalization ahead of both
      `EvidenceSchema` (EvidenceGen) and `CaseSchema` (finalizeCasePayload's
      repair round). Both fixes are also covered by new mocked regression
      tests; `npm run test:live` passes 6/6 against the real API.
- [x] **`qa-agent` skill — Gemini-powered live QA playtester** (2026-08-01 —
      DONE). Neither `run-the-bench` (fixed demo data) nor `test:live`
      (schema-shape assertions only) reads what the live pipeline actually
      *writes* the way a human would — that gap is exactly how a jury
      reference (this is always a bench trial; the judge alone decides) once
      slipped into generated dialogue unnoticed. `.claude/skills/qa-agent/`
      drives a real BYOK-generated case with Playwright end-to-end and, at
      every beat, asks a second, independent Gemini call — playing a
      technically literate human QA tester — to judge the just-revealed
      content for realism/verbiage/UI issues (screenshot included) and to
      choose its own next action, then writes a Markdown findings report.
      Manual-only, like `test:live`: spends real API quota on both case
      generation and every judgment call, and must never run in
      `npm test`/lint/build/CI.
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
      `SentencingControl` (successor to the retired `TrialVerdictForm`),
      versus being displayed as judge's context only (current behavior,
      flagged as an interpretation in the plan).
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
