import { useGameStore } from '../../store/useGameStore';
import { useUIStore } from '../../store/useUIStore';

const PRIMARY_BUTTON =
  'min-h-11 rounded-md bg-(--accent) px-5 py-2 font-medium text-(--bg) hover:opacity-90';
const SECONDARY_BUTTON =
  'min-h-11 rounded-md border border-(--border-strong) px-5 py-2 text-(--text-h) hover:bg-(--bg-elevated)';

// The judge's Act 1 decision. The offer's terms and both counsels' arguments
// were just spoken into the record, so the control carries only the ruling.
// With no live offer (NO_OFFER / REJECTED_BY_DEFENSE) the only available
// order is trial, and no plea decision is recorded — the phase transition is
// the ruling.
export function PleaRulingControl({ hasOffer }: { hasOffer: boolean }) {
  const setPleaDecision = useGameStore((state) => state.setPleaDecision);
  const setPhase = useGameStore((state) => state.setPhase);
  const advanceBeat = useUIStore((state) => state.advanceBeat);

  if (!hasOffer) {
    return (
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium text-(--text-h)">No plea is before the bench.</h2>
        <button
          type="button"
          onClick={() => {
            setPhase('ACT_2_MOTIONS');
            advanceBeat();
          }}
          className={PRIMARY_BUTTON}
        >
          Order Trial
        </button>
      </div>
    );
  }

  const handleAccept = () => {
    setPleaDecision('ACCEPT');
    setPhase('ACT_3_VERDICT');
    advanceBeat();
  };

  const handleReject = () => {
    setPleaDecision('REJECT');
    setPhase('ACT_2_MOTIONS');
    advanceBeat();
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-medium text-(--text-h)">The plea agreement awaits your ruling.</h2>
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={handleReject} className={SECONDARY_BUTTON}>
          Reject &amp; Force Trial
        </button>
        <button type="button" onClick={handleAccept} className={PRIMARY_BUTTON}>
          Accept Plea
        </button>
      </div>
    </div>
  );
}
