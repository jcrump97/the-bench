import { useUIStore } from '../../store/useUIStore';

// Mobile-only scrim behind an open drawer; clicking it closes both panels.
// On desktop (md:) panels are static columns and need no backdrop.
export function PanelBackdrop() {
  const casePanelOpen = useUIStore((state) => state.casePanelOpen);
  const evidencePanelOpen = useUIStore((state) => state.evidencePanelOpen);
  const setCasePanelOpen = useUIStore((state) => state.setCasePanelOpen);
  const setEvidencePanelOpen = useUIStore((state) => state.setEvidencePanelOpen);

  if (!casePanelOpen && !evidencePanelOpen) return null;

  return (
    <div
      aria-hidden="true"
      onClick={() => {
        setCasePanelOpen(false);
        setEvidencePanelOpen(false);
      }}
      className="fixed inset-0 z-30 bg-black/50 md:hidden"
    />
  );
}
