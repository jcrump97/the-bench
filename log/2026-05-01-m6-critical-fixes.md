## Feature: M6 Critical Fixes
## Branch: feature/m6-critical-fixes
## Agent: opencode/glm-5.1

### What changed
- src/types/game.ts: Defined ResolvedCase interface (extends CourtCase with required outcome, verdict_rulings, sentence_ruling). Made bailType required in ArraignmentRuling.
- src/store/game-store.ts: Fixed dual stage tracking (gameStage mirrors current_stage via stageToGameStage map). Added sessionCaseCount state + increment in resolveCurrentCase + persist in partialize. Added startNextCase action. Fixed updateReputation cap at 100. Fixed verdict reputation to be evidence-aware (strong evidence → Guilty correct, weak → Not Guilty correct). Added guard against re-ruling evidence. Fixed gameover to set gameStage only, not current_stage.
- src/lib/gemini/schemas.ts: Added ArraignmentRulingSchema, TranscriptEntrySchema, ResolvedCaseSchema. Added arraignment_ruling to CourtCaseSchema.
- src/lib/gemini/service.ts: Unified generateOutcome into single async function with demo fallback + live Gemini call + Zod parse. Removed old sync generateOutcomeWithFallback and duplicate generateOutcome.
- src/store/__tests__/game-store.test.ts: Updated tests for new evidence-aware verdict logic, re-ruling guard, reputation cap at 100, sessionCaseCount reset, gameover behavior.

### Tests added/modified
- Updated verdict tests to use evidence-aware expectations
- Fixed updateReputation cap test (110 → 100)
- Fixed re-ruling test (now prevents re-ruling)
- Fixed gameover test (current_stage stays at courtroom stage)

### Known issues
- C5 generateOutcome wiring: function exists but not yet called from SentencingForm — needs async integration in component
- Evidence pre-admitted in demo cases (E-001, E-002) makes evidence stage short — intentional or should reset to Pending?
- Session score formula exists in AGENTS.md but no code yet

### Next features unlocked
- M6 proper: next case flow, outcome card, game over screen, session score