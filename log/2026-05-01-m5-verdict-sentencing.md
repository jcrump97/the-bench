## Feature: Verdict + Sentencing (M5)
## Branch: feature/m5-verdict-sentencing
## Agent: OpenCode (glm-5.1) + manual fixup

### What changed
- `src/types/game.ts`: Added `ChargeVerdict`, `SentenceRuling` interfaces; added optional `severity` to `Charge`
- `src/lib/gemini/schemas.ts`: Added `ChargeVerdictSchema`, `SentenceRulingSchema`, integrated into `CourtCaseSchema`
- `src/store/game-store.ts`: 
  - Expanded `gameStage` type to full 8-stage flow (landing through gameover)
  - `submitVerdict`: per-charge reputation impact scaled by severity, auto-transcript, stage→Sentencing, gameover at 0
  - `submitSentence`: statutory range validation, reputation ±5/±8, stage→Outcome
- `src/components/game/VerdictForm.tsx`: NEW — Guilty/Not Guilty/No Contest per charge with reasoning validation
- `src/components/game/SentencingForm.tsx`: NEW — Slider within statutory range, condition checkboxes, reasoning
- `src/components/game/JudicialLayout.tsx`: Wired VerdictForm for 'Verdict' stage, SentencingForm for 'Sentencing'
- `src/lib/gemini/service.ts`: Added `generateDemoOutcome` deterministic fallback
- `src/store/__tests__/game-store.test.ts`: 7 new tests (4 verdict + 3 sentencing)

### Tests added
- submitVerdict Guilty: +reputation, stage→Sentencing
- submitVerdict Not Guilty: -reputation
- submitVerdict No Contest: neutral +3
- submitVerdict gameover: reputation 0 triggers gameover stage
- submitSentence within range: +5 reputation, stage→Outcome
- submitSentence outside range: -8 reputation
- submitSentence no guilty: 0 months allowed

### Known issues
- No actual OutcomeCard UI yet — stage shows blank after Sentencing (M6)
- `gameStage` state variable and `currentCase.game_state.current_stage` are duplicative — should unify in refactor
- Demo cases don't have `charge.severity` populated yet — defaults to 'Med'

### Next features unlocked
- M6: OutcomeCard + Next Case Flow + Session Score + Game Over screen
