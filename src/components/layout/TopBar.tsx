import { FolderOpen, Scale } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { useUIStore } from '../../store/useUIStore';
import { PanelToggleButton } from './PanelToggleButton';
import { enumLabel } from '../../lib/format';
import { actTitleFor } from '../../lib/actTitles';

export function TopBar() {
  const currentPhase = useGameStore((state) => state.currentPhase);
  const activeCase = useGameStore((state) => state.activeCase);
  const pleaDecision = useGameStore((state) => state.pleaDecision);
  const casePanelOpen = useUIStore((state) => state.casePanelOpen);
  const evidencePanelOpen = useUIStore((state) => state.evidencePanelOpen);
  const toggleCasePanel = useUIStore((state) => state.toggleCasePanel);
  const toggleEvidencePanel = useUIStore((state) => state.toggleEvidencePanel);
  const panelHintActive = useUIStore((state) => state.panelHintActive);

  return (
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-(--border) bg-(--bg-panel) px-2 py-1">
      <PanelToggleButton label="Toggle case file panel" pressed={casePanelOpen} hint={panelHintActive} onClick={toggleCasePanel}>
        <FolderOpen size={20} />
      </PanelToggleButton>

      <div className="min-w-0 text-center">
        <p className="truncate font-medium text-(--text-h)">
          {activeCase ? `People v. ${activeCase.defendant.lastName}` : 'The Bench'}
        </p>
        <p className="truncate text-sm text-(--text-muted)">
          {actTitleFor(currentPhase, pleaDecision)?.label ?? enumLabel(currentPhase)}
        </p>
      </div>

      <PanelToggleButton label="Toggle evidence panel" pressed={evidencePanelOpen} hint={panelHintActive} onClick={toggleEvidencePanel}>
        <Scale size={20} />
      </PanelToggleButton>
    </header>
  );
}
