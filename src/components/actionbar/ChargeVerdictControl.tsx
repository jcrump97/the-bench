import { useGameStore } from '../../store/useGameStore';
import { useUIStore } from '../../store/useUIStore';
import { enumLabel } from '../../lib/format';

const OPTION_BUTTON = 'min-h-11 w-full rounded-md border px-4 py-2 text-left text-sm';
const GUILTY_STYLE = 'border-transparent bg-(--status-excluded-bg) text-(--status-guilty) hover:opacity-90';
const NOT_GUILTY_STYLE = 'border-transparent bg-(--status-admitted-bg) text-(--status-not-guilty) hover:opacity-90';

// One charge is before the court for verdict. Testimony and closings sit in
// the record above; the judge calls the count by choosing the words spoken
// from the bench — each authored option is bound to a closed verdict, and
// the chosen line enters the record verbatim via spokenJudgeLines.
export function ChargeVerdictControl({ chargeId }: { chargeId: string }) {
  const activeCase = useGameStore((state) => state.activeCase);
  const chargeVerdicts = useGameStore((state) => state.chargeVerdicts);
  const addChargeVerdict = useGameStore((state) => state.addChargeVerdict);
  const recordSpokenJudgeLine = useGameStore((state) => state.recordSpokenJudgeLine);
  const advanceBeat = useUIStore((state) => state.advanceBeat);

  const charge = activeCase?.charges.find((c) => c.id === chargeId);
  if (!activeCase || !charge) return null;

  const call = (verdict: 'GUILTY' | 'NOT_GUILTY', lineText: string) => {
    recordSpokenJudgeLine(`verdict-${chargeId}`, lineText);
    addChargeVerdict({
      chargeId: charge.id,
      chargeName: charge.name,
      classification: charge.classification,
      verdict,
    });
    advanceBeat();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="min-w-0">
        <p className="text-xs text-(--text-muted)">
          Count {chargeVerdicts.length + 1} of {activeCase.charges.length} — {enumLabel(charge.classification)}. How does the court find?
        </p>
        <h2 className="truncate font-medium text-(--text-h)">{charge.name}</h2>
      </div>
      <div className="flex flex-col gap-2">
        {charge.verdictOptions.map((option) => (
          <button
            key={option.lineText}
            type="button"
            data-choice={option.choice}
            onClick={() => call(option.choice, option.lineText)}
            className={`${OPTION_BUTTON} ${option.choice === 'GUILTY' ? GUILTY_STYLE : NOT_GUILTY_STYLE}`}
          >
            <span aria-hidden="true">&ldquo;</span>{option.lineText}<span aria-hidden="true">&rdquo;</span>
          </button>
        ))}
      </div>
    </div>
  );
}
