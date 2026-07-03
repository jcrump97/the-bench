import { useGameStore } from '../../store/useGameStore';
import { ModalRoot } from '../modals/ModalRoot';

// Minimal stub: Phase 3 fleshes this out into the full responsive layout
// (TopBar, panels, Ledger, ActionBar). Kept just complete enough that the
// demo case can enter ACT_1_INTAKE without hitting a dead end.
export function GameShell() {
  const currentPhase = useGameStore((state) => state.currentPhase);
  const activeCase = useGameStore((state) => state.activeCase);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-(--bg) px-4 text-center">
      <h1 className="text-xl font-medium text-(--text-h)">
        {activeCase ? `People v. ${activeCase.defendant.lastName}` : 'The Bench'}
      </h1>
      <p className="text-(--text-muted)">{currentPhase}</p>
      <ModalRoot />
    </div>
  );
}
