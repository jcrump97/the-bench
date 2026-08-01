import { useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useUIStore } from '../../store/useUIStore';
import { usePleaPosture } from '../../hooks/usePleaPosture';
import { useCaseSource } from '../../hooks/useCaseSource';
import { sentencingModifierFromRulings } from '../../lib/pleaAssessment';
import { describeDemeanor } from '../../lib/demeanorNotes';
import { SentencePicker } from './SentencePicker';
import { buildSentences, floorAmountFor } from '../../lib/sentenceBounds';
import { deriveSentencingExposure } from '../../lib/sentencingExposure';
import type { Sentence } from '../../schemas/gameSchemas';

const PRIMARY_BUTTON =
  'min-h-11 rounded-md bg-(--accent) px-5 py-2 font-medium text-(--bg) hover:opacity-90';

// The final decision beat, on both paths. Accepted plea: guilt is
// established by the plea, the negotiated sentence seeds the picker, and the
// judge retains discretion within the statutory range. Trial with any guilty
// count: the full range is open, with the admitted-evidence weight and the
// defendant's profile shown as judge's context (never an algorithmic
// constraint). Trial with a full acquittal: nothing to impose — the court
// adjourns. The modifier is only computed on the trial path, where the state
// machine guarantees Act 2 completed and motionRulings is non-empty.
export function SentencingControl({ anyGuilty }: { anyGuilty: boolean }) {
  const activeCase = useGameStore((state) => state.activeCase);
  const pleaDecision = useGameStore((state) => state.pleaDecision);
  const motionRulings = useGameStore((state) => state.motionRulings);
  const chargeVerdicts = useGameStore((state) => state.chargeVerdicts);
  const setImposedSentence = useGameStore((state) => state.setImposedSentence);
  const setAftermathNarrative = useGameStore((state) => state.setAftermathNarrative);
  const setPhase = useGameStore((state) => state.setPhase);
  const advanceBeat = useUIStore((state) => state.advanceBeat);
  const postureResult = usePleaPosture();
  const caseSource = useCaseSource();

  const isPleaPath = pleaDecision === 'ACCEPT';
  // Guards the async submit against a double-click: a second resolution would
  // call setAftermathNarrative after the END_STATE transition and trip its
  // phase gate, wiping a finished game to ERROR_STATE.
  const [submitting, setSubmitting] = useState(false);
  const exposure = activeCase ? deriveSentencingExposure(activeCase.charges) : null;
  const [amounts, setAmounts] = useState<number[]>(() => {
    if (!exposure) return [];
    // The negotiated sentence seeds the plea path; the trial path opens at
    // the statutory maximums.
    const proposed: Sentence[] =
      isPleaPath && postureResult && postureResult.posture.status !== 'NO_OFFER'
        ? postureResult.posture.proposedSentence
        : [];
    return exposure.maximumPenalties.map((max) => {
      const match = proposed.find((s) => s.type === max.type && s.unit === max.unit);
      const seed = match ? match.amount : max.amount;
      return Math.min(max.amount, Math.max(floorAmountFor(max, exposure.mandatoryMinimums), seed));
    });
  });

  if (!activeCase || !exposure) return null;
  const { defendant } = activeCase;

  // [LLM-FILL: Aftermath] — the CaseSource generates the outcome-conditioned
  // aftermath (GameService's Gemini call on the BYOK path, the authored demo
  // variant today) before the END_STATE transition; any failure, including a
  // sourceless active case, is an ErrorState.
  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    const imposedSentence = anyGuilty ? buildSentences(exposure.maximumPenalties, amounts) : [];
    setImposedSentence(imposedSentence);
    if (caseSource === null) {
      setPhase('ERROR_STATE');
      return;
    }
    try {
      const aftermath = await caseSource.generateAftermath({
        caseData: activeCase,
        pleaDecision,
        verdict: isPleaPath ? null : chargeVerdicts,
        imposedSentence,
      });
      setAftermathNarrative(aftermath);
      setPhase('END_STATE');
      advanceBeat();
    } catch {
      setPhase('ERROR_STATE');
    }
  };

  if (!anyGuilty) {
    return (
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium text-(--text-h)">Acquitted on all counts. There is nothing to impose.</h2>
        <button type="button" disabled={submitting} onClick={() => void handleSubmit()} className={PRIMARY_BUTTON}>
          Adjourn
        </button>
      </div>
    );
  }

  return (
    <div className="max-h-72 space-y-3 overflow-y-auto">
      <h2 className="font-medium text-(--text-h)">
        {isPleaPath ? 'Sentencing — Plea Accepted' : 'Sentencing'}
      </h2>

      {!isPleaPath && (
        <p className="text-sm text-(--text-muted)">
          Admitted-evidence weight: {Math.round(sentencingModifierFromRulings(activeCase, motionRulings) * 100)}%
          of the prosecution&apos;s case
          &middot; Prior convictions: {defendant.pastConvictions.length}
        </p>
      )}

      {/* The traits themselves stay invisible (they drive behavior, not
          display); the judge reads the probation officer's qualitative
          account instead, on both sentencing paths. */}
      <div>
        <h3 className="text-sm font-medium text-(--text-h)">Probation Department — Demeanor Notes</h3>
        <p className="mt-0.5 text-sm text-(--text-muted)">{describeDemeanor(defendant.oceanTraits)}</p>
      </div>

      <SentencePicker
        maximums={exposure.maximumPenalties}
        minimums={exposure.mandatoryMinimums}
        amounts={amounts}
        onAmountChange={(index, amount) =>
          setAmounts((prev) => prev.map((a, i) => (i === index ? amount : a)))
        }
      />

      <div className="flex justify-end">
        <button type="button" disabled={submitting} onClick={() => void handleSubmit()} className={PRIMARY_BUTTON}>
          Impose Sentence
        </button>
      </div>
    </div>
  );
}
