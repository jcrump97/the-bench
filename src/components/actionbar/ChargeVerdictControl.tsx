import { useGameStore } from '../../store/useGameStore';
import { useUIStore } from '../../store/useUIStore';
import { enumLabel } from '../../lib/format';

const VERDICT_BUTTON = 'min-h-11 rounded-md border px-4 py-2';

// One charge is before the court for verdict. Testimony and closings sit in
// the record above; the judge calls this count, and the next is read.
export function ChargeVerdictControl({ chargeId }: { chargeId: string }) {
  const activeCase = useGameStore((state) => state.activeCase);
  const chargeVerdicts = useGameStore((state) => state.chargeVerdicts);
  const addChargeVerdict = useGameStore((state) => state.addChargeVerdict);
  const advanceBeat = useUIStore((state) => state.advanceBeat);

  const charge = activeCase?.charges.find((c) => c.id === chargeId);
  if (!activeCase || !charge) return null;

  const call = (verdict: 'GUILTY' | 'NOT_GUILTY') => {
    addChargeVerdict({
      chargeId: charge.id,
      chargeName: charge.name,
      classification: charge.classification,
      verdict,
    });
    advanceBeat();
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-(--text-muted)">
          Count {chargeVerdicts.length + 1} of {activeCase.charges.length} — {enumLabel(charge.classification)}. How does the court find?
        </p>
        <h2 className="truncate font-medium text-(--text-h)">{charge.name}</h2>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => call('GUILTY')}
          className={`${VERDICT_BUTTON} border-transparent bg-(--status-excluded-bg) text-(--status-guilty) hover:opacity-90`}
        >
          Guilty
        </button>
        <button
          type="button"
          onClick={() => call('NOT_GUILTY')}
          className={`${VERDICT_BUTTON} border-transparent bg-(--status-admitted-bg) text-(--status-not-guilty) hover:opacity-90`}
        >
          Not Guilty
        </button>
      </div>
    </div>
  );
}
