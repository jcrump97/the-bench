import { useGameStore } from '../../store/useGameStore';
import { useUIStore } from '../../store/useUIStore';

const RULING_BUTTON = 'min-h-11 rounded-md border px-4 py-2';

// One exhibit is before the court: the People have offered it and the defense
// has objected (or waived) in the record above. The judge rules, and the next
// exhibit is called.
export function MotionRulingControl({ evidenceId }: { evidenceId: string }) {
  const activeCase = useGameStore((state) => state.activeCase);
  const motionRulings = useGameStore((state) => state.motionRulings);
  const addMotionRuling = useGameStore((state) => state.addMotionRuling);
  const advanceBeat = useUIStore((state) => state.advanceBeat);

  const evidence = activeCase?.evidence.find((e) => e.id === evidenceId);
  if (!activeCase || !evidence) return null;

  const rule = (ruling: 'ADMITTED' | 'EXCLUDED') => {
    addMotionRuling({ evidenceId, ruling });
    advanceBeat();
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-(--text-muted)">
          Exhibit {motionRulings.length + 1} of {activeCase.evidence.length} — how does the court rule?
        </p>
        <h2 className="truncate font-medium text-(--text-h)">{evidence.name}</h2>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => rule('EXCLUDED')}
          className={`${RULING_BUTTON} border-(--border-strong) text-(--text) hover:bg-(--status-excluded-bg) hover:text-(--status-guilty)`}
        >
          Exclude
        </button>
        <button
          type="button"
          onClick={() => rule('ADMITTED')}
          className={`${RULING_BUTTON} border-transparent bg-(--status-admitted-bg) text-(--status-not-guilty) hover:opacity-90`}
        >
          Admit
        </button>
      </div>
    </div>
  );
}
