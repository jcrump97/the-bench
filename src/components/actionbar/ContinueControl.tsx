import { useGameStore } from '../../store/useGameStore';
import { useUIStore } from '../../store/useUIStore';
import { PHASE_RANK } from '../../lib/courtroomScript';
import type { CourtroomScriptView } from '../../hooks/useCourtroomScript';

const PRIMARY_BUTTON =
  'min-h-11 rounded-md bg-(--accent) px-5 py-2 font-medium text-(--bg) hover:opacity-90';
const SECONDARY_BUTTON =
  'min-h-11 rounded-md border border-(--border-strong) px-5 py-2 text-(--text-h) hover:bg-(--bg-elevated)';

// The pending beat is a statement: the court is listening, and the judge
// controls the tempo. Continue reveals the next line of the record; when the
// reveal crosses an act boundary the same click fires the (validated) phase
// transition. Skip fast-forwards a replayed stretch to the next decision —
// never past one.
export function ContinueControl({ view }: { view: CourtroomScriptView }) {
  const currentPhase = useGameStore((state) => state.currentPhase);
  const setPhase = useGameStore((state) => state.setPhase);
  const advanceBeat = useUIStore((state) => state.advanceBeat);
  const setBeatCursor = useUIStore((state) => state.setBeatCursor);

  const pending = view.pendingBeat;
  if (pending === undefined || pending.kind !== 'STATEMENT') return null;

  const crossesPhase = PHASE_RANK[pending.phase] > PHASE_RANK[currentPhase];

  const nextDecisionIndex = view.script.findIndex(
    (beat, index) => index >= view.cursor && beat.kind === 'DECISION',
  );
  const skipTarget = nextDecisionIndex === -1 ? view.script.length : nextDecisionIndex;
  const canSkip = skipTarget - view.cursor > 1;

  const enterPhaseUpTo = (endIndex: number) => {
    // Beats between here and the target all belong to at most one later
    // phase (the script never jumps two acts between decisions).
    const highest = view.script
      .slice(view.cursor, endIndex)
      .reduce((max, beat) => (PHASE_RANK[beat.phase] > PHASE_RANK[max] ? beat.phase : max), currentPhase);
    if (highest !== currentPhase) setPhase(highest);
  };

  const handleContinue = () => {
    if (crossesPhase) setPhase(pending.phase);
    advanceBeat();
  };

  const handleSkip = () => {
    enterPhaseUpTo(skipTarget);
    setBeatCursor(skipTarget);
  };

  const label = pending.entryKind === 'CASE_OPENED'
    ? 'Call the Case'
    : crossesPhase
      ? 'Proceed to Trial'
      : 'Continue';

  return (
    <div className="flex items-center justify-end gap-3">
      {canSkip && (
        <button type="button" onClick={handleSkip} className={SECONDARY_BUTTON}>
          Skip to Next Decision
        </button>
      )}
      <button type="button" onClick={handleContinue} className={PRIMARY_BUTTON}>
        {label}
      </button>
    </div>
  );
}
