import { useEffect, type ReactNode } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { useCourtroomScript } from '../../hooks/useCourtroomScript';
import { TopBar } from './TopBar';
import { Ledger } from '../ledger/Ledger';
import { ActionBar } from '../actionbar/ActionBar';
import { PanelBackdrop } from './PanelBackdrop';
import { CaseFilePanel } from '../panels/CaseFilePanel';
import { EvidenceTestimonyPanel } from '../panels/EvidenceTestimonyPanel';
import { ModalRoot } from '../modals/ModalRoot';

// Panels behave differently per viewport with the same open/closed boolean:
// mobile and tablet (< lg) they are fixed drawers sliding off-canvas; desktop (lg:) they
// are static columns that collapse to zero width. Behavior is pure CSS.
function PanelDrawer({ side, open, hint, children }: { side: 'left' | 'right'; open: boolean; hint: boolean; children: ReactNode }) {
  const mobilePosition =
    side === 'left'
      ? `left-0 ${open ? 'translate-x-0' : '-translate-x-full'}`
      : `right-0 ${open ? 'translate-x-0' : 'translate-x-full'}`;
  const desktopWidth = open ? 'lg:w-80' : 'lg:w-0';
  const border = side === 'left' ? 'lg:border-r' : 'lg:border-l';
  // The first-run peek only animates the closed mobile drawer (the CSS
  // no-ops it at lg:, where the panels are open static columns and the
  // toggle-button pop carries the hint instead).
  const peek = hint && !open ? (side === 'left' ? 'panel-hint-left' : 'panel-hint-right') : '';

  return (
    <aside
      className={`fixed inset-y-0 z-40 w-[85vw] max-w-xs transform bg-(--bg-panel) transition-transform ${mobilePosition} ${peek} lg:static lg:z-auto lg:translate-x-0 lg:transition-none ${desktopWidth} lg:max-w-none lg:overflow-hidden ${border} lg:border-(--border)`}
    >
      <div className="h-full w-[85vw] max-w-xs overflow-y-auto lg:w-80 lg:max-w-none">{children}</div>
    </aside>
  );
}

export function GameShell() {
  const casePanelOpen = useUIStore((state) => state.casePanelOpen);
  const evidencePanelOpen = useUIStore((state) => state.evidencePanelOpen);
  const panelHintActive = useUIStore((state) => state.panelHintActive);
  const { visibleEntries } = useCourtroomScript();

  // Fire the collapse-affordance hint the first time the courtroom mounts
  // this session; the timeout outlives the longest animation so the classes
  // come off cleanly even if animationend never fires (reduced motion).
  useEffect(() => {
    const { panelHintPlayed, beginPanelHint, endPanelHint } = useUIStore.getState();
    if (panelHintPlayed) return;
    beginPanelHint();
    const timer = setTimeout(endPanelHint, 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex h-dvh flex-col bg-(--bg)">
      <TopBar />

      <div className="relative flex min-h-0 flex-1 lg:grid lg:grid-cols-[auto_1fr_auto]">
        <PanelBackdrop />

        <PanelDrawer side="left" open={casePanelOpen} hint={panelHintActive}>
          <CaseFilePanel />
        </PanelDrawer>

        <main className="flex min-w-0 flex-1 flex-col lg:min-h-0">
          <div className="flex-1 overflow-y-auto p-4">
            <Ledger entries={visibleEntries} />
          </div>
          <div className="shrink-0 border-t border-(--border) bg-(--bg-panel) p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <ActionBar />
          </div>
        </main>

        <PanelDrawer side="right" open={evidencePanelOpen} hint={panelHintActive}>
          <EvidenceTestimonyPanel />
        </PanelDrawer>
      </div>

      <ModalRoot />
    </div>
  );
}
