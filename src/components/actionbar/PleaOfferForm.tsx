import { useGameStore } from '../../store/useGameStore';
import { usePleaPosture } from '../../hooks/usePleaPosture';
import { SentenceList } from '../common/SentenceList';
import type { CasePayload, PleaPosture } from '../../schemas/gameSchemas';

type OfferPosture = Extract<PleaPosture, { status: 'REJECTED_BY_DEFENSE' | 'PENDING_JUDICIAL_REVIEW' }>;

function chargeNames(caseData: CasePayload, chargeIds: string[]): string {
  return chargeIds.map((id) => caseData.charges.find((c) => c.id === id)?.name ?? 'Unknown charge').join(', ');
}

function OfferTerms({ caseData, posture }: { caseData: CasePayload; posture: OfferPosture }) {
  return (
    <div className="space-y-2">
      <p className="text-(--text)">
        <span className="text-(--text-muted)">Pleads to:</span> {chargeNames(caseData, posture.pleadsToChargeIds)}
      </p>
      {posture.dismissedChargeIds.length > 0 && (
        <p className="text-(--text)">
          <span className="text-(--text-muted)">Dismissed:</span> {chargeNames(caseData, posture.dismissedChargeIds)}
        </p>
      )}
      <div>
        <p className="text-(--text-muted)">Proposed sentence:</p>
        <SentenceList sentences={posture.proposedSentence} />
      </div>
    </div>
  );
}

const PRIMARY_BUTTON =
  'min-h-11 rounded-md bg-(--accent) px-5 py-2 font-medium text-(--bg) hover:opacity-90';
const SECONDARY_BUTTON =
  'min-h-11 rounded-md border border-(--border-strong) px-5 py-2 text-(--text-h) hover:bg-(--bg-elevated)';

export function PleaOfferForm() {
  const activeCase = useGameStore((state) => state.activeCase);
  const setPleaDecision = useGameStore((state) => state.setPleaDecision);
  const setPhase = useGameStore((state) => state.setPhase);
  const postureResult = usePleaPosture();

  if (!activeCase || !postureResult) return null;
  const { posture } = postureResult;

  // No offer reaches the bench in the first two states, so there is nothing to
  // rule on: pleaDecision stays null and the only path is trial.
  if (posture.status === 'NO_OFFER' || posture.status === 'REJECTED_BY_DEFENSE') {
    return (
      <div className="space-y-3">
        <h2 className="font-medium text-(--text-h)">
          {posture.status === 'NO_OFFER' ? 'No Plea Offer Made' : 'Offer Rejected by Defense'}
        </h2>
        {posture.status === 'REJECTED_BY_DEFENSE' && <OfferTerms caseData={activeCase} posture={posture} />}
        <div className="flex justify-end">
          <button type="button" onClick={() => setPhase('ACT_2_MOTIONS')} className={PRIMARY_BUTTON}>
            Proceed to Trial
          </button>
        </div>
      </div>
    );
  }

  const handleAccept = () => {
    setPleaDecision('ACCEPT');
    setPhase('ACT_3_VERDICT');
  };

  const handleReject = () => {
    setPleaDecision('REJECT');
    setPhase('ACT_2_MOTIONS');
  };

  return (
    <div className="space-y-3">
      <h2 className="font-medium text-(--text-h)">Plea Agreement — Pending Judicial Review</h2>
      <OfferTerms caseData={activeCase} posture={posture} />
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
