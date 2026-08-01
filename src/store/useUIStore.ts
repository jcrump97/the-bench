import { create } from 'zustand';

export type ActiveModal =
  | { type: 'CHARGE'; chargeId: string }
  | { type: 'EVIDENCE'; evidenceId: string }
  | { type: 'WITNESS'; witnessId: string }
  | { type: 'DEFENDANT' }
  | { type: 'EVENT' }
  | null;

interface UIState {
  casePanelOpen: boolean;
  evidencePanelOpen: boolean;
  activeModal: ActiveModal;
  // How many beats of the courtroom script have been revealed. Pure view
  // state by design: the script itself is derived from validated game state,
  // so the worst a cursor bug can do is pace the reveal wrong — it can never
  // corrupt the record. Decisions still commit through the game store's
  // validated actions regardless of where the cursor sits.
  beatCursor: number;
  // One-shot affordance teaching that the side panels collapse: the drawers
  // peek and the toggle buttons pop the first time the courtroom mounts.
  // In-memory only — once per session by construction, and nothing beyond
  // FinalResult ever persists.
  panelHintActive: boolean;
  panelHintPlayed: boolean;

  toggleCasePanel: () => void;
  toggleEvidencePanel: () => void;
  setCasePanelOpen: (open: boolean) => void;
  setEvidencePanelOpen: (open: boolean) => void;
  openModal: (modal: NonNullable<ActiveModal>) => void;
  closeModal: () => void;
  advanceBeat: () => void;
  // Jump the reveal forward (fast-forward to the next decision on replays).
  // Callers compute the target from the script; moving backwards is not a
  // thing the courtroom does.
  setBeatCursor: (cursor: number) => void;
  resetBeatCursor: () => void;
  // Fires the hint (and marks it spent); ends when the animation finishes.
  beginPanelHint: () => void;
  endPanelHint: () => void;
}

// Both panels default open on desktop, closed on mobile and tablet. 1024px
// matches the lg: classes in GameShell/PanelBackdrop: below it two open 320px
// columns would crush the center column (the 768–1023px band was unplayable
// past Act 1 — see TODO.md, responsive sweep 2026-07-15), so tablets use the
// drawer pattern that already works on phones. This is the only place view
// state needs to know viewport width — the open/closed behavior itself is
// pure CSS (drawer vs. static column).
const isDesktop =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(min-width: 1024px)').matches
    : true;

export const useUIStore = create<UIState>((set) => ({
  casePanelOpen: isDesktop,
  evidencePanelOpen: isDesktop,
  activeModal: null,
  beatCursor: 0,
  panelHintActive: false,
  panelHintPlayed: false,

  toggleCasePanel: () => set((state) => ({ casePanelOpen: !state.casePanelOpen })),
  toggleEvidencePanel: () => set((state) => ({ evidencePanelOpen: !state.evidencePanelOpen })),
  setCasePanelOpen: (open) => set({ casePanelOpen: open }),
  setEvidencePanelOpen: (open) => set({ evidencePanelOpen: open }),
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),
  advanceBeat: () => set((state) => ({ beatCursor: state.beatCursor + 1 })),
  setBeatCursor: (cursor) => set((state) => ({ beatCursor: Math.max(state.beatCursor, cursor) })),
  resetBeatCursor: () => set({ beatCursor: 0 }),
  beginPanelHint: () => set({ panelHintActive: true, panelHintPlayed: true }),
  endPanelHint: () => set({ panelHintActive: false }),
}));
