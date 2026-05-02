## Feature: Expandable Side Panels
## Branch: feature/dark-mode-toggle (shared with dark mode, sequential commit)
## Agent: Hermes (kimi-k2.6)

### What changed
- `src/hooks/use-panels.ts` (new): Panel state hook with localStorage persistence (`the-bench-panels`). **Teaser animation**: on first visit, both panels briefly expand (600ms delay → 1800ms open → collapse), then mark `hasSeenTeaser`. ToggleLeft/ToggleRight/CloseAll functions.
- `src/components/game/CollapsiblePanel.tsx` (new): Reusable panel wrapper. Collapsed: 48px vertical bar with icon + rotated text label. Expanded: 320px overlay with header (icon + label + X button), ScrollArea content, chevron hint at edge. Escape key closes. Focus trap on open. CSS transitions `duration-500`.
- `src/components/game/JudicialLayout.tsx` (major): Replaced outer `ResizablePanelGroup` with `DesktopLayout` component using two `CollapsiblePanel` instances around center `ResizablePanelGroup` (vertical Transcript/Motions only). Mobile path completely untouched.

### Tests added
- Existing game store tests still pass (no panel-specific tests yet — UI-only feature)

### Known issues
- Panel teaser animation only fires once per browser (localStorage `hasSeenTeaser` flag). Clearing storage resets it.
- No backdrop dimming when panel is open — user can still interact with center content

### Next features unlocked
- Clean desktop layout with maximum center content space
- Foundation for drawer-based UI patterns
