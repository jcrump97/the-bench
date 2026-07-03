import { useGameStore } from '../../store/useGameStore';
import type { MotionRuling } from '../../schemas/gameSchemas';

const RULING_BUTTON = 'min-h-11 rounded-md border px-4 py-2';

function rulingClasses(active: boolean, tone: 'good' | 'bad'): string {
  if (!active) return `${RULING_BUTTON} border-(--border-strong) text-(--text) hover:bg-(--bg-elevated)`;
  return tone === 'good'
    ? `${RULING_BUTTON} border-transparent bg-(--status-admitted-bg) text-(--status-admitted)`
    : `${RULING_BUTTON} border-transparent bg-(--status-excluded-bg) text-(--status-excluded)`;
}

export function MotionRulingForm() {
  const activeCase = useGameStore((state) => state.activeCase);
  const motionRulings = useGameStore((state) => state.motionRulings);
  const addMotionRuling = useGameStore((state) => state.addMotionRuling);
  const setPhase = useGameStore((state) => state.setPhase);

  if (!activeCase) return null;

  const rulingByEvidenceId = new Map<string, MotionRuling['ruling']>(
    motionRulings.map((r) => [r.evidenceId, r.ruling])
  );
  const ruledCount = activeCase.evidence.filter((e) => rulingByEvidenceId.has(e.id)).length;
  const allRuled = ruledCount === activeCase.evidence.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-medium text-(--text-h)">Evidentiary Motions</h2>
        <p className="text-sm text-(--text-muted)">
          {ruledCount} of {activeCase.evidence.length} ruled
        </p>
      </div>

      <ul className="max-h-56 space-y-2 overflow-y-auto">
        {activeCase.evidence.map((evidence) => {
          const ruling = rulingByEvidenceId.get(evidence.id) ?? null;
          return (
            <li key={evidence.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 flex-1 truncate text-(--text)">{evidence.name}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => addMotionRuling({ evidenceId: evidence.id, ruling: 'ADMITTED' })}
                  aria-pressed={ruling === 'ADMITTED'}
                  className={rulingClasses(ruling === 'ADMITTED', 'good')}
                >
                  Admit
                </button>
                <button
                  type="button"
                  onClick={() => addMotionRuling({ evidenceId: evidence.id, ruling: 'EXCLUDED' })}
                  aria-pressed={ruling === 'EXCLUDED'}
                  className={rulingClasses(ruling === 'EXCLUDED', 'bad')}
                >
                  Exclude
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex justify-end">
        {/* This gate is what guarantees TrialVerdictForm a non-empty motionRulings. */}
        <button
          type="button"
          disabled={!allRuled}
          onClick={() => setPhase('ACT_3_VERDICT')}
          className={`min-h-11 rounded-md px-5 py-2 font-medium ${
            allRuled
              ? 'bg-(--accent) text-(--bg) hover:opacity-90'
              : 'cursor-not-allowed border border-(--border-strong) text-(--text-muted)'
          }`}
        >
          Continue to Trial Verdict
        </button>
      </div>
    </div>
  );
}
