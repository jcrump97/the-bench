import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '../useUIStore';

const INITIAL = {
  casePanelOpen: useUIStore.getState().casePanelOpen,
  evidencePanelOpen: useUIStore.getState().evidencePanelOpen,
};

beforeEach(() => {
  useUIStore.setState({ ...INITIAL, activeModal: null });
});

describe('useUIStore', () => {
  it('starts with no active modal', () => {
    expect(useUIStore.getState().activeModal).toBeNull();
  });

  it('opens and closes a modal', () => {
    useUIStore.getState().openModal({ type: 'EVIDENCE', evidenceId: 'ev-1' });
    expect(useUIStore.getState().activeModal).toEqual({ type: 'EVIDENCE', evidenceId: 'ev-1' });

    useUIStore.getState().closeModal();
    expect(useUIStore.getState().activeModal).toBeNull();
  });

  it('opening a second modal replaces the first', () => {
    useUIStore.getState().openModal({ type: 'DEFENDANT' });
    useUIStore.getState().openModal({ type: 'EVENT' });
    expect(useUIStore.getState().activeModal).toEqual({ type: 'EVENT' });
  });

  it('toggles the case panel independently of the evidence panel', () => {
    useUIStore.getState().setCasePanelOpen(true);
    useUIStore.getState().setEvidencePanelOpen(true);

    useUIStore.getState().toggleCasePanel();
    expect(useUIStore.getState().casePanelOpen).toBe(false);
    expect(useUIStore.getState().evidencePanelOpen).toBe(true);

    useUIStore.getState().toggleEvidencePanel();
    expect(useUIStore.getState().evidencePanelOpen).toBe(false);
  });

  it('setCasePanelOpen/setEvidencePanelOpen set an explicit value', () => {
    useUIStore.getState().setCasePanelOpen(false);
    useUIStore.getState().setEvidencePanelOpen(false);
    expect(useUIStore.getState().casePanelOpen).toBe(false);
    expect(useUIStore.getState().evidencePanelOpen).toBe(false);

    useUIStore.getState().setCasePanelOpen(true);
    expect(useUIStore.getState().casePanelOpen).toBe(true);
  });
});
