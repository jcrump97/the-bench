import type { ReactNode } from 'react';
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
function PanelDrawer({ side, open, children }: { side: 'left' | 'right'; open: boolean; children: ReactNode }) {
  const mobilePosition =
    side === 'left'
      ? `left-0 ${open ? 'translate-x-0' : '-translate-x-full'}`
      : `right-0 ${open ? 'translate-x-0' : 'translate-x-full'}`;
  const desktopWidth = open ? 'lg:w-80' : 'lg:w-0';
  const border = side === 'left' ? 'lg:border-r' : 'lg:border-l';

  return (
    <aside
      className={`fixed inset-y-0 z-40 w-[85vw] max-w-xs transform bg-(--bg-panel) transition-transform ${mobilePosition} lg:static lg:z-auto lg:translate-x-0 lg:transition-none ${desktopWidth} lg:max-w-none lg:overflow-hidden ${border} lg:border-(--border)`}
    >
      <div className="h-full w-[85vw] max-w-xs overflow-y-auto lg:w-80 lg:max-w-none">{children}</div>
    </aside>
  );
}

export function GameShell() {
  const casePanelOpen = useUIStore((state) => state.casePanelOpen);
  const evidencePanelOpen = useUIStore((state) => state.evidencePanelOpen);
  const { visibleEntries } = useCourtroomScript();

  return (
    <div className="flex h-dvh flex-col bg-(--bg)">
      <TopBar />

      <div className="relative flex min-h-0 flex-1 lg:grid lg:grid-cols-[auto_1fr_auto]">
        <PanelBackdrop />

        <PanelDrawer side="left" open={casePanelOpen}>
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

        <PanelDrawer side="right" open={evidencePanelOpen}>
          <EvidenceTestimonyPanel />
        </PanelDrawer>
      </div>

      <ModalRoot />
    </div>
  );
}
