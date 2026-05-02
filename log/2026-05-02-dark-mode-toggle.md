## Feature: Dark Mode Toggle
## Branch: feature/dark-mode-toggle
## Agent: Hermes (kimi-k2.6)

### What changed
- `src/hooks/use-theme.ts` (new): Theme hook with system preference detection, localStorage persistence (`the-bench-theme`), `toggleTheme` cycles light↔dark
- `src/hooks/use-theme.test.ts` (new): 4 tests — default system, toggle, persist, read from storage. Fixed jsdom env with `// @vitest-environment jsdom` annotation
- `src/components/game/JudicialLayout.tsx`: Added `useTheme` import, sun/moon icon toggle button in header next to ReputationBar
- `src/index.css`: Added `transition: background-color 300ms, color 300ms, border-color 300ms` to `body` for smooth theme switching

### Tests added
- `useTheme > defaults to system theme`
- `useTheme > toggles between light and dark`
- `useTheme > persists to localStorage`
- `useTheme > reads from localStorage on mount`

### Known issues
- None

### Next features unlocked
- Theme-aware styling for all UI components
- Foundation for dark-mode-first design system
