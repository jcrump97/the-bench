# Mobile Responsive Refactor — Task Spec

## Goal
Make The Bench fully responsive and playable on mobile (390px+ width) while maintaining desktop UX.

## Current Problems (from audit)
1. **JudicialLayout.tsx** uses `ResizablePanelGroup` with horizontal orientation — three rigid panels at 20/60/20. On mobile, this creates horizontal overflow and unusable 65px-wide sidebars.
2. **ArraignmentView.tsx** uses `grid-cols-1 md:grid-cols-4` which is correct, but no `md:` query is actually loaded — the `md:` breakpoint may not exist in the config. Additionally, on desktop the four-column grid is fine, but the card padding/spacing may be too tight on mobile.
3. **EvidenceRulingDialog.tsx** uses `DialogContent` with `sm:max-w-[625px]` — on mobile this creates an off-center, too-wide dialog. Should be full-width with max-w on mobile.
4. **VerdictForm.tsx** buttons are `size="sm"` — too small for mobile touch targets (44px min needed).
5. **SentencingForm.tsx** condition checkboxes use `grid grid-cols-2` — cramped on mobile. Should be single-column on small screens.
6. **Missing shadcn components**: Need `Sheet` (slide-out drawer) for mobile navigation of panels.
7. **No device detection hook**: Need a `useMediaQuery` hook to conditionally swap layouts.

## What to Change

### A. Add `useMediaQuery` hook
Create `src/hooks/use-media-query.ts`:
```typescript
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false);
  React.useEffect(() => {
    const m = window.matchMedia(query);
    setMatches(m.matches);
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    m.addEventListener('change', listener);
    return () => m.removeEventListener('change', listener);
  }, [query]);
  return matches;
}
```

### B. Add `useIsMobile` hook
Create `src/hooks/use-is-mobile.ts`:
```typescript
import { useMediaQuery } from './use-media-query';
export function useIsMobile() {
  return useMediaQuery('(max-width: 768px)');
}
```

### C. Refactor `JudicialLayout.tsx`
On mobile (`isMobile` from `useIsMobile()`):
- Replace `ResizablePanelGroup` with a **single-column stacked layout**.
- Add a **bottom tab bar** (or floating action buttons) for switching between: `Defendant`, `Transcript`, `Motions`, `Case File`.
- Use `state` to track which panel is visible.
- Keep the **header** (title, docket, stage badge, `ReputationBar`) always visible.
- On desktop: keep existing `ResizablePanelGroup` exactly as-is.

On mobile layout structure:
```
<header> (fixed)
<main> (scrollable)
  {activePanel === 'defendant' && <DefendantPanel ... />}
  {activePanel === 'transcript' && <TranscriptArea />}
  {activePanel === 'motions' && <MotionTray />}
  {activePanel === 'casefile' && <CaseFilePanel ... />}
</main>
<bottom-nav> (fixed, tab buttons)
```

Tab buttons must be ≥44px tall, full-width row, icons + labels. Use `lucide-react` icons (already installed): `User`, `MessageSquare`, `Gavel`, `FileText`.

### D. Refactor `ArraignmentView.tsx`
- The `grid-cols-1 md:grid-cols-4` is actually correct. But verify Tailwind `md:` breakpoint is configured in `tailwind.config.js`. If missing `screens` key, add it.
- Add padding/margin adjustments: on mobile (`<md`) reduce `p-4` to `p-2` on the grid container.
- The Controls Section (`col-span-1 md:col-span-4`) should have `px-2 md:px-4` to avoid edge overflow.
- Evidence Summary card: the inner `grid grid-cols-2 gap-2` (Pros/Def) should become `grid-cols-1 md:grid-cols-2` on mobile.

### E. Refactor `EvidenceRulingDialog.tsx`
- Change `DialogContent className="sm:max-w-[625px]"` to use responsive sizing:
  ```
  className="w-[95vw] max-w-[625px] sm:w-auto sm:max-w-[625px]"
  ```
- The footer buttons (`flex gap-2 w-full sm:w-auto`) are already responsive. But on mobile, the `flex` layout may stack buttons awkwardly. Change footer to:
  ```
  <DialogFooter className="flex-col sm:flex-row gap-2">
  ```

### F. Refactor `VerdictForm.tsx`
- Change `Button size="sm"` to `size="default"` (or remove `size` prop) — mobile needs ≥44px touch targets.
- The verdict buttons row `flex gap-2` should wrap on mobile: `flex flex-wrap gap-2`.
- Ensure the `Textarea` has `min-h-[100px]` on mobile so it's tappable.

### G. Refactor `SentencingForm.tsx`
- Change condition checkboxes grid from `grid grid-cols-2 gap-2` to `grid grid-cols-1 sm:grid-cols-2 gap-2`.
- Remove any `size="sm"` on inputs if present.
- Slider should have enough vertical padding for touch.

### H. Add `tailwind.config.js` breakpoints (if missing)
Check `tailwind.config.js` for `screens` key. If absent, add:
```js
screens: {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
},
```

## Constraints
- Do NOT modify `src/components/ui/` files.
- Do NOT add new dependencies.
- Use existing shadcn components (`Button`, `Card`, `Dialog`, `Badge`, etc.).
- Every change must keep desktop layout identical to before.
- Run `npm run test` after changes — 36 tests must pass.
- Run `npx tsc -p tsconfig.app.json --noEmit` — must pass.
- Run `npm run build` — must pass.

## Definition of Done
- [ ] `JudicialLayout` shows tab-nav on mobile, resizable panels on desktop
- [ ] `ArraignmentView` stacks to single column on mobile, 4-col on desktop
- [ ] Evidence dialog is usable on 390px width
- [ ] Verdict buttons are ≥44px tall and wrap on mobile
- [ ] Sentencing conditions stack vertically on mobile
- [ ] No horizontal scroll on mobile landing or in-game
- [ ] All 36 tests pass
- [ ] `tsc --noEmit` clean
- [ ] `npm run build` clean
