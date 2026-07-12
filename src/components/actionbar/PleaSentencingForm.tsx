import { useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { usePleaPosture } from '../../hooks/usePleaPosture';
import { useCaseSource } from '../../hooks/useCaseSource';
import { SentencePicker } from './SentencePicker';
import { buildSentences, floorAmountFor } from '../../lib/sentenceBounds';
import { deriveSentencingExposure } from '../../lib/sentencingExposure';
import type { Sentence } from '../../schemas/gameSchemas';

// ACT_3_VERDICT on the accepted-plea path: guilt is established by the plea,
// so there is no verdict step and no motion-derived modifier (motionRulings is
// legitimately empty here — Act 2 was skipped). The negotiated sentence seeds
// the picker; the judge retains final discretion within the statutory range.
export function PleaSentencingForm() {
  const activeCase = useGameStore((state) => state.activeCase);
  const pleaDecision = useGameStore((state) => state.pleaDecision);
  const setImposedSentence = useGameStore((state) => state.setImposedSentence);
  const setAftermathNarrative = useGameStore((state) => state.setAftermathNarrative);
  const setPhase = useGameStore((state) => state.setPhase);
  const postureResult = usePleaPosture();
  const caseSource = useCaseSource();

  const exposure = activeCase ? deriveSentencingExposure(activeCase.charges) : null;
  const [amounts, setAmounts] = useState<number[]>(() => {
    if (!exposure) return [];
    const proposed: Sentence[] =
      postureResult && postureResult.posture.status !== 'NO_OFFER'
        ? postureResult.posture.proposedSentence
        : [];
    return exposure.maximumPenalties.map((max) => {
      const match = proposed.find((s) => s.type === max.type && s.unit === max.unit);
      const seed = match ? match.amount : max.amount;
      return Math.min(max.amount, Math.max(floorAmountFor(max, exposure.mandatoryMinimums), seed));
    });
  });

  if (!activeCase || !exposure) return null;

  // [LLM-FILL: Aftermath] — the CaseSource generates the outcome-conditioned
  // aftermath (GameService's Gemini call on the BYOK path, the authored demo
  // variant today) before the END_STATE transition; any failure, including a
  // sourceless active case, is an ErrorState.
  const handleImpose = async () => {
    const imposedSentence = buildSentences(exposure.maximumPenalties, amounts);
    setImposedSentence(imposedSentence);
    if (caseSource === null) {
      setPhase('ERROR_STATE');
      return;
    }
    try {
      const aftermath = await caseSource.generateAftermath({
        caseData: activeCase,
        pleaDecision,
        verdict: null,
        imposedSentence,
      });
      setAftermathNarrative(aftermath);
      setPhase('END_STATE');
    } catch {
      setPhase('ERROR_STATE');
    }
  };

  return (
    <div className="space-y-3">
      <h2 className="font-medium text-(--text-h)">Sentencing — Plea Accepted</h2>
      <SentencePicker
        maximums={exposure.maximumPenalties}
        minimums={exposure.mandatoryMinimums}
        amounts={amounts}
        onAmountChange={(index, amount) =>
          setAmounts((prev) => prev.map((a, i) => (i === index ? amount : a)))
        }
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void handleImpose()}
          className="min-h-11 rounded-md bg-(--accent) px-5 py-2 font-medium text-(--bg) hover:opacity-90"
        >
          Impose Sentence
        </button>
      </div>
    </div>
  );
}
