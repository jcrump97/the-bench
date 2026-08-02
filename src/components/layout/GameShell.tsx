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
  // The first-run hint animates whichever state the panel is actually in:
  // closed (mobile/tablet drawer) peeks out and retreats; open (desktop
  // static column, or a panel a player already opened) flashes an inset
  // highlight instead, since there's no closed edge to peek from. Either
  // way the toggle buttons (panel-hint-toggle, delayed via CSS) glow next
  // to point at the control that shows/hides it.
  const peek = hint && !open ? (side === 'left' ? 'panel-hint-left' : 'panel-hint-right') : '';
  const highlight = hint && open ? 'panel-hint-highlight' : '';

  return (
    <aside
      className={`fixed inset-y-0 z-40 w-[85vw] max-w-xs transform bg-(--bg-panel) transition-transform ${mobilePosition} ${peek} ${highlight} lg:static lg:z-auto lg:translate-x-0 lg:transition-none ${desktopWidth} lg:max-w-none lg:overflow-hidden ${border} lg:border-(--border)`}
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
  // come off cleanly even if animationend never fires (reduced motion). The
  // sequence is panel highlight (900ms) then, via CSS animation-delay, the
  // toggle-button glow (550ms x2 = 1100ms starting at 900ms) — 2000ms total.
  // Deliberately no cleanup-cancel: React 18 StrictMode's dev-only
  // mount→cleanup→mount double-invoke would otherwise cancel this same
  // timer on the first cleanup, and the second mount's panelHintPlayed
  // guard (already flipped true by the first) would skip scheduling a
  // replacement — leaving panelHintActive stuck true forever. Letting the
  // original timer run past its own unmount is harmless: endPanelHint()
  // only writes to the store.
  useEffect(() => {
    const { panelHintPlayed, beginPanelHint, endPanelHint } = useUIStore.getState();
    if (panelHintPlayed) return;
    beginPanelHint();
    setTimeout(endPanelHint, 2200);
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
          <div data-action-bar className="shrink-0 border-t border-(--border) bg-(--bg-panel) p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
