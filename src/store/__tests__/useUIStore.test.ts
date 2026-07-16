import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '../useUIStore';

const INITIAL = {
  casePanelOpen: useUIStore.getState().casePanelOpen,
  evidencePanelOpen: useUIStore.getState().evidencePanelOpen,
};

beforeEach(() => {
  useUIStore.setState({ ...INITIAL, activeModal: null, beatCursor: 0 });
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

describe('useUIStore — beatCursor', () => {
  it('starts at zero and advances one beat at a time', () => {
    expect(useUIStore.getState().beatCursor).toBe(0);
    useUIStore.getState().advanceBeat();
    useUIStore.getState().advanceBeat();
    expect(useUIStore.getState().beatCursor).toBe(2);
  });

  it('setBeatCursor fast-forwards but never rewinds the reveal', () => {
    useUIStore.getState().setBeatCursor(7);
    expect(useUIStore.getState().beatCursor).toBe(7);
    useUIStore.getState().setBeatCursor(3);
    expect(useUIStore.getState().beatCursor).toBe(7);
  });

  it('resetBeatCursor returns to zero for a new case', () => {
    useUIStore.getState().setBeatCursor(9);
    useUIStore.getState().resetBeatCursor();
    expect(useUIStore.getState().beatCursor).toBe(0);
  });
});
