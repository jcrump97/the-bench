import { useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useCaseSource } from '../../hooks/useCaseSource';
import { sentencingModifierFromRulings } from '../../lib/pleaAssessment';
import { SentencePicker } from './SentencePicker';
import { buildSentences } from '../../lib/sentenceBounds';
import { deriveSentencingExposure } from '../../lib/sentencingExposure';

type ChargeCall = 'GUILTY' | 'NOT_GUILTY';

const VERDICT_BUTTON = 'min-h-11 rounded-md border px-4 py-2';

function verdictClasses(active: boolean, tone: 'good' | 'bad'): string {
  if (!active) return `${VERDICT_BUTTON} border-(--border-strong) text-(--text) hover:bg-(--bg-elevated)`;
  return tone === 'bad'
    ? `${VERDICT_BUTTON} border-transparent bg-(--status-excluded-bg) text-(--status-guilty)`
    : `${VERDICT_BUTTON} border-transparent bg-(--status-admitted-bg) text-(--status-not-guilty)`;
}

// ACT_3_VERDICT on the trial path. Only reachable through ACT_2_MOTIONS'
// completion gate, so motionRulings is guaranteed non-empty and calling
// sentencingModifierFromRulings here is safe. The modifier and the defendant's
// profile are judge's context, not an algorithmic constraint — the full
// statutory range stays selectable.
export function TrialVerdictForm() {
  const activeCase = useGameStore((state) => state.activeCase);
  const motionRulings = useGameStore((state) => state.motionRulings);
  const pleaDecision = useGameStore((state) => state.pleaDecision);
  const addChargeVerdict = useGameStore((state) => state.addChargeVerdict);
  const setImposedSentence = useGameStore((state) => state.setImposedSentence);
  const setAftermathNarrative = useGameStore((state) => state.setAftermathNarrative);
  const setPhase = useGameStore((state) => state.setPhase);
  const caseSource = useCaseSource();

  const exposure = activeCase ? deriveSentencingExposure(activeCase.charges) : null;
  const [calls, setCalls] = useState<Record<string, ChargeCall>>({});
  const [amounts, setAmounts] = useState<number[]>(() =>
    exposure ? exposure.maximumPenalties.map((max) => max.amount) : []
  );

  if (!activeCase || !exposure) return null;

  const allCalled = activeCase.charges.every((charge) => calls[charge.id] !== undefined);
  const anyGuilty = activeCase.charges.some((charge) => calls[charge.id] === 'GUILTY');
  const modifier = sentencingModifierFromRulings(activeCase, motionRulings);
  const { defendant } = activeCase;

  // [LLM-FILL: Aftermath] — the CaseSource generates the outcome-conditioned
  // aftermath (GameService's Gemini call on the BYOK path, the authored demo
  // variant today) before the END_STATE transition; any failure, including a
  // sourceless active case, is an ErrorState.
  const handleSubmit = async () => {
    const verdict = activeCase.charges.map((charge) => ({
      chargeId: charge.id,
      chargeName: charge.name,
      classification: charge.classification,
      verdict: calls[charge.id] ?? 'NOT_GUILTY',
    }));
    const imposedSentence = anyGuilty ? buildSentences(exposure.maximumPenalties, amounts) : [];
    for (const chargeVerdict of verdict) {
      addChargeVerdict(chargeVerdict);
    }
    setImposedSentence(imposedSentence);
    if (caseSource === null) {
      setPhase('ERROR_STATE');
      return;
    }
    try {
      const aftermath = await caseSource.generateAftermath({
        caseData: activeCase,
        pleaDecision,
        verdict,
        imposedSentence,
      });
      setAftermathNarrative(aftermath);
      setPhase('END_STATE');
    } catch {
      setPhase('ERROR_STATE');
    }
  };

  return (
    <div className="max-h-72 space-y-3 overflow-y-auto">
      <h2 className="font-medium text-(--text-h)">Verdict &amp; Sentencing</h2>

      <p className="text-sm text-(--text-muted)">
        Admitted-evidence weight: {Math.round(modifier * 100)}% of the prosecution&apos;s case
        &middot; Prior convictions: {defendant.pastConvictions.length}
        &middot; Conscientiousness {defendant.oceanTraits.conscientiousness}/10, Neuroticism{' '}
        {defendant.oceanTraits.neuroticism}/10
      </p>

      <ul className="space-y-2">
        {activeCase.charges.map((charge) => {
          const call = calls[charge.id] ?? null;
          return (
            <li key={charge.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 flex-1 truncate text-(--text)">{charge.name}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCalls((prev) => ({ ...prev, [charge.id]: 'GUILTY' }))}
                  aria-pressed={call === 'GUILTY'}
                  className={verdictClasses(call === 'GUILTY', 'bad')}
                >
                  Guilty
                </button>
                <button
                  type="button"
                  onClick={() => setCalls((prev) => ({ ...prev, [charge.id]: 'NOT_GUILTY' }))}
                  aria-pressed={call === 'NOT_GUILTY'}
                  className={verdictClasses(call === 'NOT_GUILTY', 'good')}
                >
                  Not Guilty
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {anyGuilty && (
        <SentencePicker
          maximums={exposure.maximumPenalties}
          minimums={exposure.mandatoryMinimums}
          amounts={amounts}
          onAmountChange={(index, amount) =>
            setAmounts((prev) => prev.map((a, i) => (i === index ? amount : a)))
          }
        />
      )}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!allCalled}
          onClick={() => void handleSubmit()}
          className={`min-h-11 rounded-md px-5 py-2 font-medium ${
            allCalled
              ? 'bg-(--accent) text-(--bg) hover:opacity-90'
              : 'cursor-not-allowed border border-(--border-strong) text-(--text-muted)'
          }`}
        >
          {anyGuilty ? 'Enter Verdict & Impose Sentence' : 'Enter Verdict'}
        </button>
      </div>
    </div>
  );
}
