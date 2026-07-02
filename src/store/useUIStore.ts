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

  toggleCasePanel: () => void;
  toggleEvidencePanel: () => void;
  setCasePanelOpen: (open: boolean) => void;
  setEvidencePanelOpen: (open: boolean) => void;
  openModal: (modal: NonNullable<ActiveModal>) => void;
  closeModal: () => void;
}

// Both panels default open on desktop, closed on mobile. This is the only
// place view state needs to know viewport width — the open/closed behavior
// itself is pure CSS (drawer vs. static column).
const isDesktop =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(min-width: 768px)').matches
    : true;

export const useUIStore = create<UIState>((set) => ({
  casePanelOpen: isDesktop,
  evidencePanelOpen: isDesktop,
  activeModal: null,

  toggleCasePanel: () => set((state) => ({ casePanelOpen: !state.casePanelOpen })),
  toggleEvidencePanel: () => set((state) => ({ evidencePanelOpen: !state.evidencePanelOpen })),
  setCasePanelOpen: (open) => set({ casePanelOpen: open }),
  setEvidencePanelOpen: (open) => set({ evidencePanelOpen: open }),
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),
}));
