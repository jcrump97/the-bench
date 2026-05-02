## Feature: M2 — Real Transcript System
## Branch: master
## Agent: opencode/glm-5.1

### What changed
- `src/components/game/TranscriptArea.tsx` — full rewrite. Reads from `currentCase.transcript` instead of MOCK_TRANSCRIPT. Formats by type (testimony/ruling/procedure). Auto-scroll. Empty state.
- `src/store/game-store.ts` — added `makeTranscriptEntry()` helper. Auto-injects entries on `setCurrentCase`, `submitArraignmentRuling`. New `setCaseStage()` action adds stage-change procedure entries.
- `src/store/__tests__/game-store.test.ts` — 4 new transcript tests, updated existing tests for new auto-injection behavior.

### Tests added
- `should add transcript entries when setting a case`
- `should add transcript entries when submitting arraignment ruling`
- `should add transcript entry via addTranscriptEntry`
- `should update case stage and add transcript entry via setCaseStage`

### Known issues
- No component test for TranscriptArea rendering.
- Test expectation `toContainEqual(entry)` may be brittle (exact object match).

### Next features unlocked
- M3 (Motions) — now has real transcript system to log motion rulings
- M4 (Evidence) — now has real transcript system to log evidence rulings
- M5 (Verdict) — now has real transcript system for verdict/sentencing entries
