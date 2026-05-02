# Implementation Plan: Dark Mode Toggle + Expanding/Collapsible Side Panels

> **Status:** PLANNING — no implementation code. Two features, two branches.

---

## Feature 1: Dark Mode Toggle

### Branch
`feature/dark-mode-toggle`

### What We Build
A three-state theme system (`"light" | "dark" | "system"`) with a sun/moon toggle button in the JudicialLayout header. Tailwind's `darkMode: ["class"]` strategy already works (see `tailwind.config.js:3`). The `.dark` class CSS variables are already defined in `src/index.css:29-49`. We just need to wire up the toggle logic.

### Current State Analysis
- **`tailwind.config.js`** — already has `darkMode: ["class"]`. **No changes needed** (per AGENTS.md §7 "Don't Touch").
- **`src/index.css`** — `.dark` class with all CSS variable overrides already present (lines 29-49). Need to add smooth transition on `body`/`html`.
- **`src/components/game/JudicialLayout.tsx`** — `Header` component (line 29-40) is where the toggle button goes. Currently renders: h1, Case badge, Stage badge, ReputationBar.
- **Components already use semantic tokens** — TranscriptArea has `dark:bg-blue-950 dark:text-blue-100` etc. Most panels use `bg-background`, `text-foreground`, `bg-card`, etc. so they'll auto-adapt. But we need to audit for hardcoded light-only colors.

### File Inventory

| # | File | Action | What Changes |
|---|------|--------|-------------|
| 1 | `src/hooks/use-theme.ts` | **CREATE** | Core hook. Returns `{ theme, resolved, setTheme }`. Reads localStorage key `the-bench-theme`. Falls back to `"system"`. Resolves `"system"` → `"light"` or `"dark"` via `window.matchMedia('(prefers-color-scheme: dark)')`. Toggles `document.documentElement.classList` with `"dark"` on resolution change. Listens for system pref changes when mode is `"system"`. |
| 2 | `src/hooks/use-theme.test.ts` | **CREATE** | Vitest tests: (1) default to system, (2) explicit dark/light overrides class, (3) localStorage round-trip, (4) system pref change listener fires when in system mode, (5) does NOT listen for system changes when explicitly set to dark/light |
| 3 | `src/components/game/JudicialLayout.tsx` | **MODIFY** | Import `useTheme`. Add sun/moon `Button variant="ghost" size="icon"` in Header after ReputationBar. Import `Sun` and `Moon` from `lucide-react` (already used in codebase). Click cycles: `system → dark → light → system` (or simpler: just toggle dark/light, skip system cycle in button — see decisions). |
| 4 | `src/index.css` | **MODIFY** | Add `transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease` to the `body` rule inside `@layer base` (line 58). This gives smooth visual transition when toggling. |
| 5 | `src/App.tsx` | **MODIFY** | Call `useTheme()` at top level so the class is applied on app mount, before any rendering. This ensures the first paint already has the correct class (avoids flash-of-wrong-theme). Alternative: call it in `main.tsx` as a side effect, but hook must be inside React tree. |
| 6 | Audit pass (no file changes expected) | **READ-ONLY** | Grep for hardcoded `bg-white`, `bg-gray-*`, `text-gray-*`, `bg-slate-*` etc. in `src/components/game/`. Fix any that break in dark mode by replacing with semantic tokens. TranscriptArea already has `dark:` variants. |

### Implementation Detail: `use-theme.ts`

```
Hook contract:
  theme: "system" | "light" | "dark"     — the user's preference
  resolved: "light" | "dark"             — the computed value (system resolved)
  setTheme(t): void                      — setter that writes localStorage + updates class

Logic:
1. On mount: read localStorage('the-bench-theme')
2. If null/undefined → default "system"
3. Resolve: if theme === "system", check matchMedia('(prefers-color-scheme: dark)')
4. Sync: if resolved === "dark", add "dark" to <html> classList; else remove
5. Effect: when theme === "system", subscribe to matchMedia 'change' event
6. setTheme: write localStorage, update state, re-resolve

Key: use `useSyncExternalStore` or plain `useState` + `useEffect` — no external deps.
```

### Header Button Design

```
Current Header layout (line 31-38):
  <header flex justify-between>
    <div>  [The Bench] [Case badge] [Stage badge]  </div>
    <ReputationBar />
  </header>

Proposed:
  <header flex justify-between>
    <div>  [The Bench] [Case badge] [Stage badge]  </div>
    <div className="flex items-center gap-2">
      <ReputationBar />
      <Button variant="ghost" size="icon" onClick={cycleTheme} aria-label="Toggle theme">
        {resolved === 'dark' ? <Sun /> : <Moon />}
      </Button>
    </div>
  </header>
```

- Use existing `Button` component from `src/components/ui/button.tsx` (shadcn).
- `Sun` and `Moon` icons from `lucide-react` — already a project dependency.
- Button behavior: click cycles `light → dark → system`. Or simpler two-state: `light ↔ dark`. **Recommendation: two-state** — fewer states to reason about, system pref is respected on first visit automatically. User who explicitly toggles gets what they clicked.

### Dark Mode — Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Flash of light theme on dark-system load | Call `useTheme()` in `App.tsx` (top of render, before UI). The `useEffect` that syncs the class runs synchronously in the same paint. If still flashing, add an inline `<script>` in `index.html` that reads localStorage and sets class before React mounts. |
| Hardcoded colors break dark mode | Audit grep for `bg-white|bg-gray|text-gray|bg-slate|text-slate` in `src/components/game/`. Replace with `bg-background`, `text-muted-foreground`, etc. |
| AGENTS.md §7 says don't touch `tailwind.config.js` | **No changes needed.** `darkMode: ["class"]` already there. |
| Phase 2 feature — may conflict with M1-M6 branches | Separate branch. Merge after M6 or parallel. No shared files with M3/M4/M5 except `JudicialLayout.tsx` (coordinate merges). |
| `localStorage('the-bench-theme')` conflicts with Zustand persist | No conflict. This is pure DOM state, not game state. Keep it separate. |

### Definition of Done
- [ ] Toggle button visible in header on both desktop and mobile
- [ ] Clicking toggles between light and dark with 300ms CSS transition on body
- [ ] First visit respects `prefers-color-scheme` system preference
- [ ] Refresh preserves chosen theme via localStorage
- [ ] All game components readable in both themes (no hardcoded white backgrounds)
- [ ] `src/hooks/use-theme.test.ts` passes
- [ ] `npm run test` passes
- [ ] `npx tsc -p tsconfig.app.json --noEmit` clean
- [ ] Log entry written to `log/YYYY-MM-DD-dark-mode-toggle.md`

**Estimated time: 2-3 hours**

---

## Feature 2: Expanding/Collapsible Side Panels (Desktop Only)

### Branch
`feature/expandable-panels`

### What We Build
On desktop (≥768px), replace the outer horizontal `ResizablePanelGroup` with a flex layout where the left (Defendant) and right (Case File) panels become **48px-wide icon bars** by default. Clicking an icon expands the panel to **320px as an overlay**. The center content (Transcript + Motions vertical split) always gets full remaining width. Mobile tab navigation is completely untouched.

### Current State Analysis
- **`JudicialLayout.tsx`** lines 120-155: Desktop uses `ResizablePanelGroup orientation="horizontal"` with three panels at 20%/60%/20%. This entire block gets replaced.
- **Mobile path** (lines 97-117): Separate `if (isMobile) { ... }` block. We **do not touch this**.
- **Verdict/Sentencing full-screen** (lines 75-95): These bypass panels entirely. **Do not touch.**
- **`DefendantPanel.tsx`**: Renders a `Card` with `ScrollArea` for prior history. Already scrollable. Width is fluid from parent. At 320px it will reflow but content fits (text + badges, no wide tables).
- **`CaseFilePanel.tsx`**: Uses `Tabs` (Evidence/Witnesses) with `ScrollArea`. At 320px, `TabsList` and content should still work — shadcn Tabs flex-wrap. Needs testing.
- **`useIsMobile` hook**: Uses 768px breakpoint. Panel system only active above this.

### File Inventory

| # | File | Action | What Changes |
|---|------|--------|-------------|
| 1 | `src/components/game/CollapsiblePanel.tsx` | **CREATE** | Reusable wrapper component. Props: `side: 'left' \| 'right'`, `icon: React.FC`, `label: string`, `children: React.ReactNode`, `isOpen: boolean`, `onToggle: () => void`. Renders the 48px icon bar + optional 320px overlay panel. |
| 2 | `src/components/game/JudicialLayout.tsx` | **MAJOR MODIFY** | Replace desktop `ResizablePanelGroup` (horizontal) with: `<div className="flex flex-1 relative">` containing `<CollapsiblePanel side="left">` + center content + `<CollapsiblePanel side="right">`. Center keeps vertical `ResizablePanelGroup` for Transcript/Motions split. Mobile path unchanged. |
| 3 | `src/components/game/DefendantPanel.tsx` | **MINOR MODIFY** | Wrap content in container that constrains to panel width. Ensure `h-full overflow-auto` works inside overlay. The existing `ScrollArea` at line 31 (200px fixed height) may need to become flex-based. |
| 4 | `src/components/game/CaseFilePanel.tsx` | **MINOR MODIFY** | Ensure `Tabs` and `ScrollArea` work at 320px. The `TabsList` (line 56) should remain usable. Add `min-w-0` to prevent overflow. |
| 5 | `src/hooks/use-panels.ts` | **CREATE** | Hook: manages `{ leftOpen: boolean, rightOpen: boolean }` state. Reads/writes `the-bench-panels` localStorage. Provides `toggleLeft()`, `toggleRight()`, `closeAll()`. |
| 6 | `src/hooks/use-panels.test.ts` | **CREATE** | Vitest tests: (1) default both closed, (2) toggle opens/closes, (3) localStorage persistence, (4) both can be open simultaneously |

### Component Design: `CollapsiblePanel.tsx`

```
Props:
  side: 'left' | 'right'
  icon: LucideIcon component
  label: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode

Structure (collapsed):
  <div
    className="flex flex-col items-center justify-center
               w-[48px] border-r (left) / border-l (right)
               bg-card cursor-pointer hover:bg-accent
               transition-colors"
    onClick={onToggle}
    role="button"
    aria-expanded={isOpen}
    aria-label={`Expand ${label} panel`}
  >
    <Icon className="h-5 w-5 text-muted-foreground" />
    <span className="text-[10px] text-muted-foreground mt-1 [writing-mode:vertical-rl]">
      {label}
    </span>
  </div>

Structure (expanded, as overlay):
  <div className="absolute top-0 bottom-0 z-20 flex"
       style={{ left: side === 'left' ? 0 : 'auto', right: side === 'right' ? 0 : 'auto' }}>
    {/* 48px icon bar (always visible, now acts as collapse handle) */}
    <div className="shrink-0 w-[48px] ..." onClick={onToggle}>
      <Icon /> {/* rotated or with X indicator */}
    </div>
    {/* 320px content overlay */}
    <div
      className="w-[272px] h-full bg-card border-r/l overflow-y-auto
                 animate-in slide-in-from-left/right-4 duration-300"
    >
      {children}
    </div>
  </div>
```

**Alternative (simpler CSS approach):**
A single absolutely-positioned div per panel. When collapsed: `width: 48px, position: relative`. When expanded: `width: 320px, position: absolute, z-20`. Transition on `width`.

```
Collapsed: relative, w-12 (48px), in flow
Expanded:  absolute, w-80 (320px), z-20, over center content
```

### Layout Structure in `JudicialLayout.tsx`

```
Current desktop (lines 120-155):
  <ResizablePanelGroup orientation="horizontal">
    <ResizablePanel 20%>  DefendantPanel  </ResizablePanel>
    <ResizablePanel 60%>
      <ResizablePanelGroup orientation="vertical">
        <ResizablePanel> TranscriptArea </ResizablePanel>
        <ResizablePanel> MotionTray </ResizablePanel>
      </ResizablePanelGroup>
    </ResizablePanel>
    <ResizablePanel 20%>  CaseFilePanel  </ResizablePanel>
  </ResizablePanelGroup>

Proposed desktop:
  <div className="flex flex-1 relative overflow-hidden">
    {/* Left panel bar — always in flow at 48px */}
    <CollapsiblePanel side="left" icon={User} label="Defendant"
                      isOpen={leftOpen} onToggle={toggleLeft}>
      <DefendantPanel defendant={currentCase.defendant} />
    </CollapsiblePanel>

    {/* Center — takes all remaining space */}
    <div className="flex-1 min-w-0">
      <ResizablePanelGroup orientation="vertical">
        <ResizablePanel defaultSize={80}>
          <TranscriptArea />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={20} minSize={15}>
          <MotionTray />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>

    {/* Right panel bar — always in flow at 48px */}
    <CollapsiblePanel side="right" icon={FileText} label="Case File"
                      isOpen={rightOpen} onToggle={toggleRight}>
      <CaseFilePanel caseData={currentCase} />
    </CollapsiblePanel>
  </div>
```

Key: the 48px bars are **in flow** (not absolute) so the center naturally fills the gap. When expanded, the panel content goes **absolute/overlay** so it doesn't push center content.

### CSS Transition Strategy

No Framer Motion. Pure Tailwind + CSS:

- **Collapse → Expand:** `width` transitions from 48px to 320px on the outer wrapper. Content inside fades in with `opacity-0 → opacity-100` transition (300ms).
- **Use Tailwind `animate-in`/`animate-out`** from `tailwindcss-animate` plugin (already in `tailwind.config.js:65`): `data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-left-2`
- **Or manual classes:** `transition-all duration-300 ease-out` on the container div.

### Interaction Details

| Interaction | Behavior |
|-------------|----------|
| Click icon bar (collapsed) | Expand panel to 320px overlay |
| Click icon bar (expanded) | Collapse panel back to 48px |
| Press `Escape` while panel open | Collapse panel |
| Click outside overlay (on center content) | Collapse panel (optional — see open questions) |
| Both panels open simultaneously | Allowed — defendant panel overlays from left, case file from right |
| Verdict/Sentencing stage | Panels still visible but center shows full-screen form. Panels auto-collapse since `Header` re-renders. Or: keep panels available. (See decisions) |

### Accessibility

- `aria-expanded="true/false"` on the toggle icon bar
- `role="button"` on the icon bar
- `aria-label="Expand Defendant panel"` / `"Collapse Defendant panel"`
- `role="region"` + `aria-label="Defendant Profile"` on the expanded panel content
- `Escape` key handler on expanded panel: `useEffect` with `keydown` listener
- Focus trap inside expanded panel? **No** — judge may want to interact with center content simultaneously. Escape is sufficient.

### Edge Cases

| Case | Handling |
|------|----------|
| Window resized from desktop to mobile | `useIsMobile()` re-renders → mobile path ignores panels entirely. No cleanup needed. |
| Window resized from mobile to desktop | Panels default to collapsed. |
| Panel content taller than viewport | ScrollArea inside panel content handles overflow (already present in both panels). |
| Rapid clicking (open/close/open) | CSS transition prevents layout thrash. React state updates are synchronous. |
| localStorage has stale shape | `use-panels` hook validates parsed value. Falls back to `{ leftOpen: false, rightOpen: false }` on parse error. |

### Expanding Panels — Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Breaking mobile layout | Mobile path in `JudicialLayout.tsx` is fully separate (`if (isMobile)` block, lines 97-117). We do not modify it. Add a code comment marking the boundary. |
| Destroying resizable panels | Keep `ResizablePanelGroup` for the **vertical** center split (Transcript vs Motions). Only remove the **horizontal** outer group. This preserves user-adjustable transcript/motion split. |
| Content overflow at 320px | DefendantPanel: existing `ScrollArea` (line 31) handles it. CaseFilePanel: `Tabs` + `ScrollArea` should work. Test with long exhibit descriptions. Add `min-w-0` to prevent flex overflow. |
| Overlay obscures center content | Panels are informational (reference material). The judge reads them, then closes to focus on center where decisions happen. This is acceptable UX for a courtroom context. |
| Conflicts with M3-M6 branches (also modify JudicialLayout) | Merge carefully. Panel changes are structural but isolated to the desktop layout block (lines 120-155). Other M-branches add stage-specific renders (Verdict/Sentencing are already separate return blocks). Coordinate on `JudicialLayout.tsx`. |
| `ResizableHandle` removed | The resize handles for left/right panels go away. Judge can no longer drag panel widths. This is an intentional trade-off: collapsing to icon bars is a better UX for a game than resize handles. The vertical center split keeps its handle. |
| No new deps | Confirmed. `tailwindcss-animate` is already installed. `lucide-react` is already installed. Everything else is React + Tailwind. |

### Definition of Done
- [ ] Desktop: 48px icon bars visible on left and right edges
- [ ] Clicking icon expands 320px overlay with smooth CSS transition (~300ms)
- [ ] Clicking again or pressing Escape collapses panel
- [ ] Both panels can be open simultaneously
- [ ] Panel content is scrollable and readable at 320px width
- [ ] Center content (Transcript + Motions with vertical resize) occupies full remaining width
- [ ] Mobile layout completely unchanged — tab nav still works, no regression
- [ ] Verdict/Sentencing full-screen paths still work
- [ ] `src/hooks/use-panels.test.ts` passes
- [ ] `npm run test` passes
- [ ] `npx tsc -p tsconfig.app.json --noEmit` clean
- [ ] Log entry written to `log/YYYY-MM-DD-expandable-panels.md`

**Estimated time: 4-6 hours**

---

## Implementation Order

### 1. Dark Mode Toggle FIRST

**Why first:**
- Simpler, fewer moving parts, fewer files
- Establishes the `useTheme` hook in `App.tsx` early — panels can read `resolved` for theme-aware styling later if needed
- Adds sun/moon button to `Header` — the expandable-panels branch won't conflict with this since it modifies the body below the header
- The CSS transition addition to `body` in `index.css` is a one-line change with no conflict risk
- Low risk of merge conflicts with M1-M6 branches (Header is only shared surface)

**Steps:**
1. Create `src/hooks/use-theme.ts`
2. Create `src/hooks/use-theme.test.ts` — get tests green
3. Call `useTheme()` in `App.tsx`
4. Add toggle button to `Header` in `JudicialLayout.tsx`
5. Add CSS transition to `body` in `src/index.css`
6. Audit hardcoded colors in game components
7. Run `npm run test` + `tsc --noEmit`
8. Write log entry

### 2. Expanding/Collapsible Panels SECOND

**Why second:**
- Depends on a stable header layout (dark mode may have adjusted header structure)
- Major layout refactor — want to do this on top of a clean base
- If done first, dark mode button insertion could conflict with the restructured header

**Steps:**
1. Create `src/hooks/use-panels.ts`
2. Create `src/hooks/use-panels.test.ts` — get tests green
3. Create `src/components/game/CollapsiblePanel.tsx`
4. Modify `JudicialLayout.tsx` desktop layout (the big one)
5. Minor adjustments to `DefendantPanel.tsx` and `CaseFilePanel.tsx` for 320px constraint
6. Test manually: desktop expand/collapse, mobile untouched, verdict/sentencing paths
7. Run `npm run test` + `tsc --noEmit`
8. Write log entry

---

## Branch Strategy

```
main
  └─ feature/dark-mode-toggle     (merge after DoD complete + tsc clean)
       └─ feature/expandable-panels  (merge after DoD complete + tsc clean)
```

Both branches off main (or dark-mode off main, then panels off dark-mode to avoid merge). **Recommend: both off main** since they're independent features. Resolve any conflicts at merge time.

---

## Open Questions (Decide Before Implementing)

1. **Panel default state on desktop:** Collapsed (max center space, clean look) or expanded (info immediately visible)?
   - **Recommendation:** Collapsed. The game is about decisions in the center. Panels are reference material opened on demand.

2. **Click-outside-to-close:** Should clicking center content close an open panel, or only the icon bar / Escape?
   - **Recommendation:** Click-outside closes. Add a transparent backdrop div (`fixed inset-0 z-10`) when any panel is open. Click on backdrop → close all panels. This is standard overlay behavior.

3. **Dark mode button behavior:** Two-state (`light ↔ dark`) or three-state (`light → dark → system → light`)?
   - **Recommendation:** Two-state. System preference is respected on first visit automatically. Explicit toggle = explicit choice. Simpler to implement and explain.

4. **Verdict/Sentencing stages + panels:** Should panels remain accessible during verdict/sentencing (currently full-screen center forms)?
   - **Recommendation:** Auto-collapse panels when entering Verdict/Sentencing. These stages don't use the three-panel layout (they return separate JSX). No change needed — they already bypass the panel system.

5. **Pre-React flash of wrong theme:** Add inline `<script>` in `index.html` to set `.dark` class before React hydrates?
   - **Recommendation:** Yes, add a 5-line `<script>` in `index.html` `<head>` that reads localStorage and sets class. Prevents white flash on dark-system + returning dark-pref users.