# The Bench

[![Verify](https://github.com/jcrump97/the-bench/actions/workflows/verify.yml/badge.svg)](https://github.com/jcrump97/the-bench/actions/workflows/verify.yml)

A client-side judge simulation game. You are the judge in a California criminal court. A case lands on your desk. You make decisions regarding pleas, rule on evidentiary motions, and hand down sentences according to the statutes as charged. Powered by your own Gemini API key or a hardcoded demo case.

This is a single-page React application deployed to GitHub Pages. Zero backend. Zero server-side secrets. The architecture forces a non-deterministic LLM into a deterministic state machine using strict JSON schemas and Zod validation.

## Why This Exists

This is my first portfolio project as I transition from the Service Desk to AI Systems Architecture. I chose to do this because I have always had an interest in the criminal legal system. This project was born from countless hours of listening to actual court proceedings, researching different perspectives of the legal system, brainstorming with family/friends and AI, as well as a desire to take a complex system and to create some form of it while demonstrating the skills I have been learning over the past couple of years. I am building it in public using AI tools, mainly Cursor, but with an abundance of thought, planning, consideration, and passion injected as well. The commit history is the real documentation of the process. This was NOT "vibe" coded. I believe the best results come from collaborating with AI, leaving the decisions to the human, not the AI. This repo proves that.

## Who It's For

One courtroom, written to hold up for three very different players:

| If you are… | Look for |
|---|---|
| **An attorney** | Procedure that follows a California criminal courtroom — arraignment, discovery, a §1192.5 plea the court may refuse, Miranda and voluntariness fights over a recorded interview, allocution under §1200, a sentence chosen inside the statutory range. The **Bench Book** cites the authority behind each term and lists, plainly, where the game simplifies the law. |
| **An AI architect** | A non-deterministic model forced through a deterministic state machine. Start a case with your own Gemini key and the generating screen draws the pipeline as it runs — which steps are model calls, which are computed and never generated. Then read on below. |
| **A high-school student** | The **guided tutorial case** (marked *Start here*), a title card at each act saying what you're deciding, and the Bench Book's plain-English definitions for every term the courtroom throws at you. |

## Tech Stack

- Vite + React 19 + TypeScript (strict)
- Zustand (state management)
- Zod (validation gatekeeper)
- Tailwind CSS (presentation layer only)
- GitHub Pages (static hosting)

## Testing

Four gates run in CI on every pull request and every push to `main`
(`.github/workflows/verify.yml`). The deploy job publishes the exact artifact
the E2E suite passed against.

```bash
npm run lint       # ESLint — no-explicit-any, ban-ts-comment, no-console
npm test           # Vitest — hermetic, never calls the Gemini API
npm run build      # tsc -b (enforces the @ts-expect-error gates) + vite build
npm run test:e2e   # Playwright — full demo docket, headless, no API key needed
```

`npm run test:e2e` drives the committed driver at
`.claude/skills/run-the-bench/driver.mjs`: six runs across all five demo cases,
both the plea and trial branches, desktop and mobile viewports, asserting
speaker order, beat ordering, progressive-reveal gating, act title cards, the
Bench Book, and outcome-conditioned endings — plus a seventh run over the BYOK
generating screen, where Playwright answers every Gemini request inside the
browser (no key, no quota) to check the progress panel, that the key travels
only in a request header, and that Cancel aborts the request in flight and
returns to the docket — and an eighth that blocks the Bench Book's chunk
mid-case to prove a failed load cannot unmount the courtroom. It needs a server to point at — `npm run dev` locally, or
`npm run preview` with `BASE_URL=http://localhost:4173/the-bench/` to test the
production build the way CI does. Playwright is deliberately **not** a project
dependency; see the skill's `SKILL.md` for the throwaway-prefix install.

Two further checks are **manual only** — both call the real Gemini API and spend
real quota, and neither is wired into CI:

```bash
npm run test:live                             # live pipeline suite + 5-run diagnostic sweep
node .claude/skills/qa-agent/qa-agent.mjs     # LLM-as-judge playthrough of a generated case
```

`test:live` validates the generation pipeline against the actual API (it found a
retired model build, a structured-output null mismatch, and the root cause of a
reported "Mistrial most of the time"). `qa-agent` is the only check that reads
what the pipeline *writes* — it drives a live BYOK case and has an independent
Gemini call judge every beat for realism the way a human tester would.

## Architecture

### Trust Boundaries & Data Flow

```mermaid
%%{init:{'flowchart':{'defaultRenderer':'elk'}}}%%
flowchart LR
    subgraph Presentation["Presentation Layer"]
        UI[PlayerUI]
        PROG["Generation Progress (display only)"]
        BB["Bench Book (static reference, no case data)"]
    end

    subgraph ServiceCore["Service Core"]
        GS["GameService (lazy chunk, BYOK only)"]
        RG[ResultGenerator]
        VL[ValidationLayer]
        DEMO[DemoCase Hardcoded JSON]
    end

    subgraph StateStore["State Store (Zustand — three isolated slices)"]
        GAME[GameState]
        ERR[ErrorState]
        VAULT[BYOKVault]
        UIS[UIStore View State]
    end

    subgraph Persistence["Persistence"]
        LS[LocalStorage FinalResult]
    end

    subgraph External["External Boundary"]
        LLM[LLM API JSON Mode]
    end

    UI -->|"Action Trigger"| GS
    UI -->|"User Key Input"| VAULT
    UI -->|"Select Demo Case"| DEMO
    VAULT -->|"Transient Secure Injection"| GS
    GS -->|"POST Strict Schema (key in x-goog-api-key header, 120s timeout)"| LLM
    GS -.->|"Step started / done"| PROG
    PROG -.->|"Cancel (abandons the run)"| GS
    UI -->|"Open any time"| BB
    DEMO -->|"Hardcoded Payload"| VL
    LLM -->|"Raw JSON Payload"| VL
    GS -->|"Unvalidated Data"| VL
    RG -->|"Unvalidated FinalResult"| VL
    VL -->|"Validated Schema"| GAME
    VL -->|"Schema / API Violation"| ERR
    VL -->|"Persist Immutable Object"| LS
    LS -->|"Re-validated Bench Record"| VL
    ERR -->|"Recovery UI"| UI
    UI -->|"Retry Action"| GS
    UI <-->|"Panels / Modals (unvalidated view state)"| UIS
```

### Game State Machine and Generation Pipeline

```mermaid
%%{init:{'flowchart':{'defaultRenderer':'elk'}}}%%
flowchart LR
    subgraph GameService["GameService"]
        GS[Orchestrator]
    end

    subgraph GenPipeline["Generation Pipeline"]
        STAT[StatuteSelection]
        ENV[EnvironmentGen]
        CHAR[CharacterGen]
        INTG[InterrogationGen]
        EVID[EvidenceGen]
        VERD[VerdictVoice]
        FIN["finalizeCasePayload (assembly + cross-stage repair)"]
        PLEN[PleaNarrative]
    end

    subgraph Deterministic["Deterministic Derivations (no LLM)"]
        PLEA["buildPleaPosture (plea structure)"]
        INTP["deriveInterrogationProfile (OCEAN + priors → interview outcome + suppression ground)"]
        DEM["describeDemeanor (OCEAN → probation demeanor notes)"]
        EXPO["deriveSentencingExposure (ranges of the counts of conviction → case exposure)"]
        MOD["sentencingModifierFromRulings (Act 2 → Act 3)"]
        SCRIPT["buildCourtroomScript (statement + decision beats; spokenJudgeLines voice record; choice-keyed reaction beats)"]
        REVEAL["deriveRevealState (revealed transcript → disclosure tiers)"]
    end

    subgraph ViewState["View State (useUIStore, unvalidated)"]
        CURSOR["beatCursor (forward-only reveal)"]
    end

    subgraph GamePhases["Game Phases"]
        WEL[Welcome]
        A1["Act1 Intake and Plea"]
        A2["Act2 Evidentiary Motions"]
        A3["Act3 Verdict and Sentencing"]
        END[EndState Aftermath]
    end

    WEL -->|"Initialize Game"| GS
    GS -->|"Trigger Pipeline"| STAT
    STAT -->|"Charges + ranges"| ENV
    STAT -->|"Charges + ranges (concurrent with scene)"| CHAR
    ENV -->|"Established facts"| INTG
    CHAR -->|"OCEAN + priors"| INTP
    INTP -->|"Outcome + challenge ground (echo-validated)"| INTG
    INTG -->|"Interview transcript"| EVID
    CHAR -->|"Defendant (concurrent with interview + evidence)"| VERD
    EVID -->|"Evidence + witnesses"| FIN
    VERD -->|"Voiced verdict layer (reactions, bench lines)"| FIN
    FIN -->|"Assembled Case Payload"| PLEA
    PLEA -->|"Band, offer terms, defense posture"| PLEN
    PLEN -->|"Plea Narrative (color only)"| A1
    DEM -->|"Demeanor notes (traits stay invisible)"| A3
    SCRIPT --> REVEAL
    REVEAL -->|"DISCLOSED / PRESENTED gating"| UI2["Panels + Detail Modals"]
    PLEA -->|"Offer / No-Offer / Rejected"| A1
    A1 -->|"Trial Forced"| A2
    A1 -->|"Plea Deal Accepted"| A3
    A2 -->|"Rulings"| MOD
    MOD -->|"Admitted-Evidence Weight"| A3
    EXPO -->|"Statutory Floor and Ceiling"| A3
    A3 -->|"Sentence Entered"| END
    END -->|"Trigger Final Snapshot"| GS
    SCRIPT -->|"Ordered beats, truncated at first unresolved decision"| CURSOR
    CURSOR -->|"Reveal one beat at a time"| GamePhases
```

The LLM provides color; deterministic code provides structure. Plea structure, case-level sentencing exposure, and the Act 2 → Act 3 penalty modifier are all pure functions of validated data — the LLM's only plea contribution is narrative strings (rationales, arguments, testimony, allocution). Exposure aggregates the statutory ranges of the counts a sentence can actually reach: every count on the plea path, but only the counts of conviction after a trial, so an acquitted count's range can't reshape the sentence for the counts that were proven. Where a case mixes prison-eligible and jail-only counts, the exposure collapses to one custody type rather than narrating both as separately imposed — counts sentenced together aggregate into a single commitment (Cal. Penal Code §669).

The case plays out **one beat at a time**: `buildCourtroomScript` projects validated state into an ordered screenplay of speaker-attributed statements and decision points, truncated at the first unresolved decision (no spoilers) and prefix-stable (resolving a decision never rewrites the past). A reveal cursor in the view-state slice paces the courtroom — the prosecutor offers each exhibit, the defense objects or waives, witnesses testify, and the judge rules from the bench at every pause. The judge's rulings are *voiced*: each decision point presents authored bench lines bound to the closed decision enums (variants multiply voice, never the state space), the chosen words enter the record verbatim, and the courtroom reacts in character to every ruling. The record itself reads as a spoken transcript — every line led by the party speaking (witnesses and the allocuting defendant by name), each party in its own accent, with the court's rulings and the press aftermath set apart from the flowing testimony. Even the closing arguments answer to what happened: each side's per-exhibit points are assembled onto its closing according to the ruling the judge actually entered, so neither counsel can argue the merits of an exhibit the court suppressed.

Act 1 follows real procedure: the clerk performs only the call and the charges, the defense enters the not-guilty plea, the People state the facts, and both sides disclose their exhibits and witnesses before any plea offer lands. What the judge can browse follows the record — the panels and detail modals are gated by a derived reveal state (`DISCLOSED` at discovery with counsel's brief unverified summary, `PRESENTED` with full detail once the item is offered or the witness sworn), and any transcript line that presents an item clicks through to its detail view. Police interrogations are *simulated at generation time*: a pure function of the defendant's OCEAN traits and priors decides what the interview room produced (confession, partial admission, denial, or lawyering up — in which case no tape exists) and which ground the defense attacks it on; the authored transcript dramatizes exactly that structure, and the tape is played into the record line by line before the suppression ruling. The traits themselves are never displayed — at sentencing the judge reads a derived probation demeanor note instead.

## Status

**Feature-complete and playable end to end, offline or with your own key.**

- **The demo docket** — five hand-authored cases, every branch reachable: **People v. Eli Navarro** (the guided tutorial), **People v. Marcus Webb** (MODERATE offer), **People v. Curtis Boone** (WEAK, no offer), **People v. Dominic Reyes** (STRONG, offer rejected) and **People v. Teresa Vaughn** (multi-charge, split verdict).
- **The courtroom** — arraignment and discovery before the plea; the record unfolding one statement at a time; exhibits offered, argued and ruled on individually, with recorded interrogations played line by line before the suppression fight; direct and cross; closings that answer to your rulings; per-count verdicts; allocution on the plea path; a sentence chosen inside the statutory range.
- **The close** — a minute order filed under the record that reads the sentence back as consequence, an aftermath that answers *how hard* the sentence landed and not just the verdict, and a bench record that follows the judge across cases.
- **Generated cases** — a seven-stage Gemini pipeline behind your own key, drawn live on the generating screen, cancellable, and loaded only for players who use it.
- **Orientation** — act title cards, the guided tutorial, and the Bench Book (plain-English terms, California authority, an honest list of simplifications, and what code decides versus what the model writes).
- **Quality gates** — lint, 539 unit tests, the type-negative build, and a seven-run Playwright suite against the production bundle run in CI on every pull request; the deploy publishes only the artifact the end-to-end suite passed against.

**Open, and deliberately left to the author** (see [`TODO.md`](./TODO.md)): a per-count custody election for wobblers (S1), a unit-safe sentencing floor (S2), whether an off-phase store write should vacate the game or reject only the write (A7), generating the Gemini response schema from Zod (A2, which needs a live measurement either side), and the concurrent pipeline's first live sweep.

### How it got here

Foundation, UI layer, the beat-by-beat courtroom loop, and the courtroom-realism overhaul complete. Schemas, state machine, security vault, deterministic plea/sentencing/interrogation/demeanor derivations, and the full game shell (progressively revealed panels, tiered detail modals, transcript click-through) are implemented — and the game now plays as a living courtroom: arraignment and discovery precede the plea, the record unfolds one statement at a time behind a click-to-advance cursor, exhibits are offered, argued, and ruled on individually (recorded interrogations played line by line before the suppression fight), witnesses take the stand for direct and cross, closings precede per-charge verdicts, and defendants allocute before sentencing on the plea path. Five hardcoded demo cases — **People v. Eli Navarro** (the guided tutorial), **People v. Marcus Webb** (MODERATE offer), **People v. Curtis Boone** (WEAK/no offer), **People v. Dominic Reyes** (STRONG/rejected), and **People v. Teresa Vaughn** (multi-charge, split-verdict) — are playable end-to-end on every branch.

`GameService` and the multi-stage LLM generation pipeline are now implemented (`src/lib/llm/`) and wired to the BYOK path — a real Gemini key plays a generated case through the same seam as the demo docket. The default test suite mocks every Gemini call; a separate opt-in live suite (`npm run test:live`, gated behind a real API key) validates the whole pipeline against the actual API and has caught and fixed reliability gaps invisible to mocks — a retired model build ranked ahead of a stable alias, a structured-output null/undefined mismatch on an optional field, and, most recently, a player-reported "Mistrial most of the time." A live diagnostic sweep measured that failure rather than guessing at it: 5/5 case generations succeeded end to end, but with one stage failing its first attempt in 3 of 5 runs because two confidence scores were specified as 1-10 in validation with no range ever stated to the model. Carrying every such constraint from validation into the generation schema and prompts — plus hardening the transport and turning failed retries into repairs instead of blind re-rolls — took the same sweep to 5/5 with zero failed attempts. A second, separate skill, `qa-agent`, closes a different gap: it plays a live BYOK-generated case and has an independent Gemini call judge each beat for realism and UI issues the way a human tester would, since neither the mocked suite nor the live schema checks read what the pipeline actually *writes*.

Since then the work has moved from *does it generate* to *does it cohere*: the scene's established facts are now a canonical block threaded verbatim into every downstream stage rather than each one paraphrasing the description and drifting; the voiced verdict layer is authored in its own stage after the defendant exists, with the charge ids it echoes validated against the ones it was asked for; and sentencing exposure is scoped to the counts of conviction, so acquitting the only prison-eligible count no longer offers prison anyway.

The game loop now closes: `ResultGenerator` — the last box in the diagram that was designed rather than built — assembles an immutable `FinalResult` from the state the player's own rulings produced, the store's schema gate validates it, and only what passes is persisted. A minute order is filed under the record when the case closes (disposition, plea posture, evidentiary tally, per-count verdicts, sentence), and the judge's bench record greets them on the docket screen next time: cases heard, pleas taken, trials held, the share of tried counts returned guilty, and the recent judgments. Nothing about that assembly is generated — `resolutionPath` falls out of the plea decision and `pleaOutcome` off the computed posture. `localStorage` is treated as hostile in both directions: every snapshot read back is re-parsed through `FinalResultSchema` and a failing entry dropped individually, and every access is wrapped, so blocked site data or an exceeded quota costs the record rather than the finished game.

And the record now answers the one decision the judge makes alone. Where the term sits between the lightest sentence available and the statutory ceiling is read deterministically, and every closing surface consumes it: each demo case carries three authored codas so a sentence at the floor and one at the ceiling tell different stories about the same people, the Aftermath prompt is given the range, the refused plea, the suppressed exhibits and the household rather than a bare number, and the minute order reads the term back as consequence — release year and age, the dependents that time is taken from, the job it ends, what the conviction carries. The bench record totals the custody ordered across a whole career.

A review pass over the finished branch then corrected six defects in that new arithmetic — a release year that could land before the term ran out, a sentence with one lawful option reported as the maximum, an offer comparison that put fine dollars against prison days, and an aftermath prompt telling the reporter a defendant had refused the plea they took — the kind of bug that produces a confident wrong sentence rather than a crash.

The road to 1.0 then turned to who the game is for. The key moved out of the request URL into a header, plea and verdict lines began failing at the stage that wrote them (so they are repaired rather than ending the run), and every request gained a timeout. The pipeline's independent stages now run concurrently and report their progress, which the generating screen draws — model calls and computed steps side by side — with a Cancel that abandons the run cleanly. The pipeline itself became a separate chunk only key-holders download, and act title cards and the Bench Book gave the courtroom's language and its simplifications a plain explanation.

## License

MIT