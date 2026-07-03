import { useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { usePleaPosture } from '../../hooks/usePleaPosture';
import { SentencePicker } from './SentencePicker';
import { buildSentences, floorAmountFor } from '../../lib/sentenceBounds';
import type { Sentence } from '../../schemas/gameSchemas';

// ACT_3_VERDICT on the accepted-plea path: guilt is established by the plea,
// so there is no verdict step and no motion-derived modifier (motionRulings is
// legitimately empty here — Act 2 was skipped). The negotiated sentence seeds
// the picker; the judge retains final discretion within the statutory range.
export function PleaSentencingForm() {
  const activeCase = useGameStore((state) => state.activeCase);
  const setImposedSentence = useGameStore((state) => state.setImposedSentence);
  const setPhase = useGameStore((state) => state.setPhase);
  const postureResult = usePleaPosture();

  const [amounts, setAmounts] = useState<number[]>(() => {
    if (!activeCase) return [];
    const proposed: Sentence[] =
      postureResult && postureResult.posture.status !== 'NO_OFFER'
        ? postureResult.posture.proposedSentence
        : [];
    return activeCase.maximumPenalties.map((max) => {
      const match = proposed.find((s) => s.type === max.type && s.unit === max.unit);
      const seed = match ? match.amount : max.amount;
      return Math.min(max.amount, Math.max(floorAmountFor(max, activeCase.mandatoryMinimums), seed));
    });
  });

  if (!activeCase) return null;

  const handleImpose = () => {
    setImposedSentence(buildSentences(activeCase.maximumPenalties, amounts));
    setPhase('END_STATE');
  };

  return (
    <div className="space-y-3">
      <h2 className="font-medium text-(--text-h)">Sentencing — Plea Accepted</h2>
      <SentencePicker
        maximums={activeCase.maximumPenalties}
        minimums={activeCase.mandatoryMinimums}
        amounts={amounts}
        onAmountChange={(index, amount) =>
          setAmounts((prev) => prev.map((a, i) => (i === index ? amount : a)))
        }
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleImpose}
          className="min-h-11 rounded-md bg-(--accent) px-5 py-2 font-medium text-(--bg) hover:opacity-90"
        >
          Impose Sentence
        </button>
      </div>
    </div>
  );
}
