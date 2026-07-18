import { useGameStore } from '../../store/useGameStore';
import { useUIStore } from '../../store/useUIStore';

const PRIMARY_BUTTON =
  'min-h-11 rounded-md bg-(--accent) px-5 py-2 font-medium text-(--bg) hover:opacity-90';
const OPTION_BUTTON = 'min-h-11 w-full rounded-md border px-4 py-2 text-left text-sm';
const ACCEPT_STYLE = 'border-transparent bg-(--status-admitted-bg) text-(--status-not-guilty) hover:opacity-90';
const REJECT_STYLE = 'border-(--border-strong) text-(--text) hover:bg-(--bg-elevated)';

// The judge's Act 1 decision. The offer's terms and both counsels' arguments
// were just spoken into the record, so the control carries only the ruling —
// voiced through the narrative's authored plea options, each bound to a
// closed ACCEPT/REJECT decision. With no live offer (NO_OFFER /
// REJECTED_BY_DEFENSE) the only available order is trial, no plea decision is
// recorded, and no line is voiced — the phase transition is the ruling.
export function PleaRulingControl({ hasOffer }: { hasOffer: boolean }) {
  const activePleaNarrative = useGameStore((state) => state.activePleaNarrative);
  const setPleaDecision = useGameStore((state) => state.setPleaDecision);
  const setPhase = useGameStore((state) => state.setPhase);
  const recordSpokenJudgeLine = useGameStore((state) => state.recordSpokenJudgeLine);
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

  // pleaRulingOptions is authored exactly when an offer reaches the bench
  // (the same pairing defineDemoCase enforces), so this is never undefined
  // here in practice — the empty fallback only guards a malformed narrative.
  const options = activePleaNarrative?.pleaRulingOptions ?? [];

  const rule = (decision: 'ACCEPT' | 'REJECT', lineText: string) => {
    recordSpokenJudgeLine('plea', lineText);
    setPleaDecision(decision);
    setPhase(decision === 'ACCEPT' ? 'ACT_3_VERDICT' : 'ACT_2_MOTIONS');
    advanceBeat();
  };

  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-medium text-(--text-h)">The plea agreement awaits your ruling.</h2>
      <div className="flex flex-col gap-2">
        {options.map((option) => (
          <button
            key={option.lineText}
            type="button"
            data-choice={option.choice}
            onClick={() => rule(option.choice, option.lineText)}
            className={`${OPTION_BUTTON} ${option.choice === 'ACCEPT' ? ACCEPT_STYLE : REJECT_STYLE}`}
          >
            <span aria-hidden="true">&ldquo;</span>{option.lineText}<span aria-hidden="true">&rdquo;</span>
          </button>
        ))}
      </div>
    </div>
  );
}
