import { useGameStore } from '../../store/useGameStore';
import { useUIStore } from '../../store/useUIStore';

export function ResultActions() {
  const resetGameState = useGameStore((state) => state.resetGameState);
  const resetBeatCursor = useUIStore((state) => state.resetBeatCursor);

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-(--text-muted)">Case closed. The record above is final.</p>
      <button
        type="button"
        onClick={() => {
          resetGameState();
          resetBeatCursor();
        }}
        className="min-h-11 shrink-0 rounded-md bg-(--accent) px-5 py-2 font-medium text-(--bg) hover:opacity-90"
      >
        New Case
      </button>
    </div>
  );
}
