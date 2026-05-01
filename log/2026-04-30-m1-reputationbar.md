## Feature: M1 — ReputationBar
## Branch: master (no feature branch needed — simple additive change)
## Agent: opencode/glm-5.1

### What changed
- `src/components/game/ReputationBar.tsx` — new reusable component with color-coded bar, animated counter, smooth transitions
- `src/components/game/JudicialLayout.tsx` — added ReputationBar to header area
- `src/App.tsx` — added ReputationBar below title on landing screen

### Tests added
- None (pure UI component, no store actions). 9 existing tests still pass.

### Known issues
- No tests for ReputationBar component rendering. Should add component test.
- Reputation impact logic isn't yet visible in action — player will see bar change once M3-M5 land.

### Next features unlocked
- M2 (Real Transcript) — reputation bar is visible when testing transcript interactions
- M3-M5 — player can now see reputation changes in real time as they make rulings
